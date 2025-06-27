import { supabase } from '../supabase/client.js';
import TwitterService from './twitterService.js';
import { TwitterPost } from './types.js';
import { RateLimitManager } from './rateLimitManager.js';
import { SyncLogger } from './syncLogger.js';

export interface EngagementSyncOptions {
  daysToLookBack: number;
  syncIntervalHours: number;
  maxRequestsPerBatch: number;
}

export interface SyncStats {
  totalTweetsProcessed: number;
  tweetsUpdated: number;
  tweetsAdded: number;
  apiRequestsUsed: number;
  syncDuration: number;
  errors: string[];
}

export class EngagementSyncService {
  private twitterService: TwitterService;
  private rateLimitManager: RateLimitManager;
  private logger: SyncLogger;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    bearerToken: string,
    private options: EngagementSyncOptions = {
      daysToLookBack: 5,
      syncIntervalHours: 2,
      maxRequestsPerBatch: 5  // Conservative batch size for 15 req/15min limit
    }
  ) {
    this.twitterService = new TwitterService(bearerToken);
    this.rateLimitManager = new RateLimitManager();
    this.logger = new SyncLogger('EngagementSync');
  }

  /**
   * Get all DAOs with their Twitter handles
   */
  private async getDAOTwitterAccounts() {
    const { data, error } = await supabase
      .from('daos')
      .select(`
        id,
        slug,
        twitter_handle,
        name
      `)
      .not('twitter_handle', 'is', null);

    if (error) {
      this.logger.error('Failed to fetch DAO Twitter accounts', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get Twitter user ID from username
   */
  private async getTwitterUserId(username: string): Promise<string | null> {
    try {
      await this.rateLimitManager.checkRateLimit();
      const user = await this.twitterService.getUserByUsername(username);
      this.rateLimitManager.incrementRequestCount();
      return user ? user.id : null;
    } catch (error) {
      this.logger.error(`Failed to get Twitter user ID for @${username}`, error);
      return null;
    }
  }

  /**
   * Get the last synced tweet ID for a DAO to avoid duplicates  
   */
  private async getLastSyncedTweetId(daoSlug: string): Promise<string | null> {
    const tableName = `dao_${daoSlug}_tweets`;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error(`Failed to get last synced tweet for ${daoSlug}`, error);
      return null;
    }

    return data && data.length > 0 && data[0] ? data[0].id : null;
  }

  /**
   * Fetch new tweets from Twitter timeline for a DAO
   */
  private async fetchNewTweetsFromTimeline(dao: any): Promise<TwitterPost[]> {
    try {
      // Get Twitter user ID
      const userId = await this.getTwitterUserId(dao.twitter_handle);
      if (!userId) {
        this.logger.warn(`Could not find Twitter user ID for @${dao.twitter_handle}`);
        return [];
      }

      // Get last synced tweet ID to avoid duplicates
      const lastTweetId = await this.getLastSyncedTweetId(dao.slug);
      
      this.logger.info(`Fetching new tweets for ${dao.name} since ${lastTweetId || 'beginning'}`);

      // Fetch new tweets from timeline
      await this.rateLimitManager.checkRateLimit();
      const newTweets = await this.twitterService.fetchUserTweets(userId, lastTweetId || undefined);
      this.rateLimitManager.incrementRequestCount();

      this.logger.info(`Found ${newTweets.length} new tweets for ${dao.name}`);
      return newTweets;

    } catch (error) {
      this.logger.error(`Failed to fetch new tweets for ${dao.name}`, error);
      return [];
    }
  }

  /**
   * Store new tweets in the database
   */
  private async storeNewTweets(dao: any, tweets: TwitterPost[]): Promise<number> {
    if (tweets.length === 0) return 0;

    const tableName = `dao_${dao.slug}_tweets`;
    let stored = 0;

    for (const tweet of tweets) {
      try {
        const tweetData = {
          id: tweet.id,
          type: 'tweet',
          url: `https://x.com/${dao.twitter_handle}/status/${tweet.id}`,
          twitter_url: `https://twitter.com/${dao.twitter_handle}/status/${tweet.id}`,
          text: tweet.text,
          source: (tweet as any).source || '',
          retweet_count: tweet.public_metrics ? tweet.public_metrics.retweet_count : 0,
          reply_count: tweet.public_metrics ? tweet.public_metrics.reply_count : 0,
          like_count: tweet.public_metrics ? tweet.public_metrics.like_count : 0,
          quote_count: tweet.public_metrics ? tweet.public_metrics.quote_count : 0,
          view_count: tweet.public_metrics?.impression_count || 0,
          bookmark_count: 0, // Not available in Twitter API v2
          created_at: tweet.created_at,
          lang: (tweet as any).lang || 'en',
          is_reply: (tweet as any).in_reply_to_user_id ? true : false,
          in_reply_to_id: (tweet as any).in_reply_to_status_id || null,
          conversation_id: (tweet as any).conversation_id || tweet.id,
          in_reply_to_user_id: (tweet as any).in_reply_to_user_id || null,
          in_reply_to_username: null,
          author_username: dao.twitter_handle,
          author_name: dao.name,
          author_id: tweet.author_id,
          mentions: (tweet as any).entities?.mentions || [],
          hashtags: (tweet as any).entities?.hashtags || [],
          urls: (tweet as any).entities?.urls || [],
          media: (tweet as any).attachments?.media_keys || [],
          raw_data: tweet,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from(tableName)
          .insert(tweetData);

        if (error) {
          // Skip if already exists (duplicate key)
          if (error.code === '23505') {
            this.logger.debug(`Tweet ${tweet.id} already exists, skipping`);
          } else {
            this.logger.error(`Failed to store tweet ${tweet.id}`, error);
          }
        } else {
          stored++;
          this.logger.debug(`Stored new tweet ${tweet.id}`);
        }
      } catch (error) {
        this.logger.error(`Error storing tweet ${tweet.id}`, error);
      }
    }

    return stored;
  }

  /**
   * Get tweets from the last N days for a specific DAO
   */
  private async getRecentTweets(daoSlug: string, days: number = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const tableName = `dao_${daoSlug}_tweets`;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch recent tweets for ${daoSlug}`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Fetch latest engagement data for a batch of tweet IDs
   */
  private async fetchEngagementData(tweetIds: string[]): Promise<TwitterPost[]> {
    await this.rateLimitManager.checkRateLimit();
    
    try {
      // Use Twitter API v2 to get tweet details by IDs
      const response = await this.twitterService.getTweetsByIds(tweetIds);
      this.rateLimitManager.incrementRequestCount();
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch engagement data', error);
      throw error;
    }
  }

  /**
   * Update engagement metrics in Supabase
   */
  private async updateEngagementMetrics(
    daoSlug: string,
    tweets: TwitterPost[]
  ): Promise<{ updated: number; added: number }> {
    const tableName = `dao_${daoSlug}_tweets`;
    let updated = 0;
    let added = 0;

    for (const tweet of tweets) {
      try {
        const { data: existingTweet } = await supabase
          .from(tableName)
          .select('id, like_count, retweet_count, reply_count, quote_count')
          .eq('id', tweet.id)
          .single();

        const tweetData = {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          like_count: tweet.public_metrics ? tweet.public_metrics.like_count : 0,
          retweet_count: tweet.public_metrics ? tweet.public_metrics.retweet_count : 0,
          reply_count: tweet.public_metrics ? tweet.public_metrics.reply_count : 0,
          quote_count: tweet.public_metrics ? tweet.public_metrics.quote_count : 0,
          view_count: tweet.public_metrics?.impression_count || 0,
          author_id: tweet.author_id,
          updated_at: new Date().toISOString()
        };

        if (existingTweet) {
          // Update existing tweet
          const { error } = await supabase
            .from(tableName)
            .update(tweetData)
            .eq('id', tweet.id);

          if (error) {
            this.logger.error(`Failed to update tweet ${tweet.id}`, error);
          } else {
            updated++;
            this.logger.debug(`Updated engagement for tweet ${tweet.id}`);
          }
        } else {
          // Add new tweet
          const { error } = await supabase
            .from(tableName)
            .insert(tweetData);

          if (error) {
            this.logger.error(`Failed to insert tweet ${tweet.id}`, error);
          } else {
            added++;
            this.logger.debug(`Added new tweet ${tweet.id}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing tweet ${tweet.id}`, error);
      }
    }

    return { updated, added };
  }

  /**
   * Sync engagement data for a specific DAO
   */
  private async syncDAOEngagement(dao: any): Promise<Partial<SyncStats>> {
    const startTime = Date.now();
    const stats: Partial<SyncStats> = {
      totalTweetsProcessed: 0,
      tweetsUpdated: 0,
      tweetsAdded: 0,
      apiRequestsUsed: 0,
      errors: []
    };

    try {
      this.logger.info(`Starting engagement sync for ${dao.name} (@${dao.twitter_handle})`);

      // Step 1: Fetch and store new tweets from Twitter timeline
      this.logger.info(`Fetching new tweets from timeline for ${dao.name}`);
      const newTweets = await this.fetchNewTweetsFromTimeline(dao);
      const newTweetsStored = await this.storeNewTweets(dao, newTweets);
      
      stats.tweetsAdded = newTweetsStored;
      stats.apiRequestsUsed = (stats.apiRequestsUsed || 0) + (newTweets.length > 0 ? 2 : 1); // User lookup + timeline fetch
      
      this.logger.info(`Stored ${newTweetsStored} new tweets for ${dao.name}`);

      // Step 2: Get recent tweets from our database (including newly added ones)
      const recentTweets = await this.getRecentTweets(dao.slug, this.options.daysToLookBack);
      
      if (recentTweets.length === 0) {
        this.logger.info(`No recent tweets found for ${dao.name}`);
        return stats;
      }

      this.logger.info(`Found ${recentTweets.length} recent tweets to update engagement for ${dao.name}`);

      // Step 3: Process tweets in batches to respect rate limits
      const batchSize = this.options.maxRequestsPerBatch;
      const tweetIds = recentTweets.map(tweet => tweet.id);
      
      for (let i = 0; i < tweetIds.length; i += batchSize) {
        const batch = tweetIds.slice(i, i + batchSize);
        
        // Check if we have enough rate limit quota
        if (!this.rateLimitManager.canMakeRequest()) {
          this.logger.warn('Rate limit reached, waiting...');
          await this.rateLimitManager.waitForRateLimit();
        }

        try {
          // Fetch fresh engagement data
          const freshTweets = await this.fetchEngagementData(batch);
          stats.apiRequestsUsed = (stats.apiRequestsUsed || 0) + 1;

          // Update engagement metrics
          const { updated, added } = await this.updateEngagementMetrics(dao.slug, freshTweets);
          
          stats.tweetsUpdated = (stats.tweetsUpdated || 0) + updated;
          stats.tweetsAdded = (stats.tweetsAdded || 0) + added;
          stats.totalTweetsProcessed = (stats.totalTweetsProcessed || 0) + freshTweets.length;

          this.logger.info(`Processed batch: ${updated} updated, ${added} added`);
          
        } catch (error) {
          const errorMsg = `Failed to process batch for ${dao.name}: ${error}`;
          stats.errors?.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      const duration = Date.now() - startTime;
      stats.syncDuration = duration;

      this.logger.info(`Completed sync for ${dao.name}: ${stats.totalTweetsProcessed} tweets processed in ${duration}ms`);

    } catch (error) {
      const errorMsg = `Failed to sync ${dao.name}: ${error}`;
      stats.errors?.push(errorMsg);
      this.logger.error(errorMsg, error);
    }

    return stats;
  }

  /**
   * Run engagement sync for all DAOs
   */
  async runEngagementSync(): Promise<SyncStats> {
    if (this.isRunning) {
      this.logger.warn('Engagement sync already running, skipping...');
      throw new Error('Sync already in progress');
    }

    this.isRunning = true;
    const overallStartTime = Date.now();
    
    const aggregateStats: SyncStats = {
      totalTweetsProcessed: 0,
      tweetsUpdated: 0,
      tweetsAdded: 0,
      apiRequestsUsed: 0,
      syncDuration: 0,
      errors: []
    };

    try {
      this.logger.info('Starting Twitter engagement sync cycle');

      const daos = await this.getDAOTwitterAccounts();
      this.logger.info(`Found ${daos.length} DAOs with Twitter handles`);

      for (const dao of daos) {
        try {
          const daoStats = await this.syncDAOEngagement(dao);
          
          // Aggregate stats
          aggregateStats.totalTweetsProcessed += daoStats.totalTweetsProcessed || 0;
          aggregateStats.tweetsUpdated += daoStats.tweetsUpdated || 0;
          aggregateStats.tweetsAdded += daoStats.tweetsAdded || 0;
          aggregateStats.apiRequestsUsed += daoStats.apiRequestsUsed || 0;
          aggregateStats.errors.push(...(daoStats.errors || []));

        } catch (error) {
          const errorMsg = `Failed to sync DAO ${dao.name}: ${error}`;
          aggregateStats.errors.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      aggregateStats.syncDuration = Date.now() - overallStartTime;

      // Log final stats
      await this.logger.logSyncStats(aggregateStats);
      
      this.logger.info(`Engagement sync completed: ${aggregateStats.totalTweetsProcessed} tweets processed, ${aggregateStats.apiRequestsUsed} API requests used`);

    } catch (error) {
      this.logger.error('Fatal error in engagement sync', error);
      aggregateStats.errors.push(`Fatal error: ${error}`);
    } finally {
      this.isRunning = false;
    }

    return aggregateStats;
  }

  /**
   * Start automated engagement sync
   */
  startAutomaticSync(): void {
    if (this.syncInterval) {
      this.logger.warn('Automatic sync already started');
      return;
    }

    this.logger.info(`Starting automatic engagement sync every ${this.options.syncIntervalHours} hours`);

    // Run initial sync
    this.runEngagementSync().catch(error => {
      this.logger.error('Initial sync failed', error);
    });

    // Set up interval
    this.syncInterval = setInterval(
      () => {
        this.runEngagementSync().catch(error => {
          this.logger.error('Scheduled sync failed', error);
        });
      },
      this.options.syncIntervalHours * 60 * 60 * 1000
    );

    this.logger.info('Automatic engagement sync started');
  }

  /**
   * Stop automated engagement sync
   */
  stopAutomaticSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('Automatic engagement sync stopped');
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      isAutomatic: !!this.syncInterval,
      rateLimitStatus: this.rateLimitManager.getStatus(),
      rateLimitUsage: this.rateLimitManager.getUsageStats(),
      options: this.options
    };
  }
} 