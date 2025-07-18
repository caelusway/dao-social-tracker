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
  private lastApiErrorTime: number = 0;

  /**
   * Safely convert Twitter date to PostgreSQL timestamp format
   */
  private formatTwitterDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString();
    } catch (error) {
      this.logger.warn(`Invalid date format: ${dateString}, using current timestamp`);
      return new Date().toISOString();
    }
  }

  /**
   * Validate and sanitize tweet data before database insertion
   */
  private validateTweetData(tweet: any, account: any): { isValid: boolean; data?: any; error?: string } {
    try {
      // Check required fields
      if (!tweet.id || typeof tweet.id !== 'string') {
        return { isValid: false, error: 'Missing or invalid tweet ID' };
      }

      if (!tweet.text || typeof tweet.text !== 'string') {
        return { isValid: false, error: 'Missing or invalid tweet text' };
      }

      if (!tweet.created_at || typeof tweet.created_at !== 'string') {
        return { isValid: false, error: 'Missing or invalid tweet created_at' };
      }

      // Ensure text is not too long (PostgreSQL text limit)
      const truncatedText = tweet.text.length > 5000 ? tweet.text.substring(0, 5000) + '...' : tweet.text;

      // Format and validate date
      const formattedDate = this.formatTwitterDate(tweet.created_at);

      // Sanitize metrics
      const metrics = tweet.public_metrics || {};
      const safeMetrics = {
        retweet_count: Math.max(0, parseInt(metrics.retweet_count) || 0),
        reply_count: Math.max(0, parseInt(metrics.reply_count) || 0),
        like_count: Math.max(0, parseInt(metrics.like_count) || 0),
        quote_count: Math.max(0, parseInt(metrics.quote_count) || 0),
        view_count: Math.max(0, parseInt(metrics.impression_count) || 0)
      };

      const tweetData = {
        id: tweet.id,
        type: 'tweet',
        url: `https://x.com/${account.twitter_handle}/status/${tweet.id}`,
        twitter_url: `https://twitter.com/${account.twitter_handle}/status/${tweet.id}`,
        text: truncatedText,
        source: (tweet.source || '').toString().substring(0, 255), // Limit source length
        retweet_count: safeMetrics.retweet_count,
        reply_count: safeMetrics.reply_count,
        like_count: safeMetrics.like_count,
        quote_count: safeMetrics.quote_count,
        view_count: safeMetrics.view_count,
        bookmark_count: 0, // Not available in Twitter API v2
        created_at: formattedDate,
        lang: ((tweet.lang || 'en').toString().substring(0, 10)), // Limit language code length
        is_reply: Boolean(tweet.in_reply_to_user_id),
        in_reply_to_id: tweet.in_reply_to_status_id || null,
        conversation_id: tweet.conversation_id || tweet.id,
        in_reply_to_user_id: tweet.in_reply_to_user_id || null,
        in_reply_to_username: null,
        author_username: account.twitter_handle,
        author_name: account.name,
        author_id: tweet.author_id || null,
        mentions: Array.isArray(tweet.entities?.mentions) ? tweet.entities.mentions : [],
        hashtags: Array.isArray(tweet.entities?.hashtags) ? tweet.entities.hashtags : [],
        urls: Array.isArray(tweet.entities?.urls) ? tweet.entities.urls : [],
        media: Array.isArray(tweet.attachments?.media_keys) ? tweet.attachments.media_keys : [],
        raw_data: tweet,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return { isValid: true, data: tweetData };
    } catch (error) {
      return { isValid: false, error: `Data validation failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

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
   * Wait for 15 minutes after API error before retrying
   */
  private async waitForApiErrorCooldown(): Promise<void> {
    const now = Date.now();
    const timeSinceLastError = now - this.lastApiErrorTime;
    const waitTime = 15 * 60 * 1000; // 15 minutes in milliseconds
    
    if (timeSinceLastError < waitTime) {
      const remainingWait = waitTime - timeSinceLastError;
      this.logger.warn(`API error cooldown: waiting ${Math.round(remainingWait / 1000 / 60)} minutes before retry`);
      await new Promise(resolve => setTimeout(resolve, remainingWait));
    }
  }

  /**
   * Handle API errors with automatic retry after 15 minutes
   */
  private async handleApiError(error: any, context: string): Promise<void> {
    this.lastApiErrorTime = Date.now();
    this.logger.error(`API error in ${context}: ${error.message || error}`, error);
    
    // Check if it's a rate limit or API error that should trigger cooldown
    const errorMessage = (error.message || error.toString()).toLowerCase();
    const shouldWait = errorMessage.includes('rate limit') || 
                      errorMessage.includes('too many requests') ||
                      errorMessage.includes('429') ||
                      errorMessage.includes('service unavailable') ||
                      errorMessage.includes('503');
    
    if (shouldWait) {
      this.logger.warn('API error detected - will wait 15 minutes before next retry');
    }
  }

  /**
   * Get all accounts with their Twitter handles
   */
  private async getDAOTwitterAccounts() {
    const { data, error } = await supabase
      .from('accounts')
      .select(`
        id,
        slug,
        twitter_handle,
        name
      `)
      .not('twitter_handle', 'is', null);

    if (error) {
      this.logger.error('Failed to fetch account Twitter handles', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get Twitter user ID from username
   */
  private async getTwitterUserId(username: string): Promise<string | null> {
    try {
      await this.waitForApiErrorCooldown();
      await this.rateLimitManager.checkRateLimit();
      const user = await this.twitterService.getUserByUsername(username);
      this.rateLimitManager.incrementRequestCount();
      return user ? user.id : null;
    } catch (error) {
      await this.handleApiError(error, `getTwitterUserId(@${username})`);
      return null;
    }
  }

  /**
   * Get the last synced tweet ID for an account to avoid duplicates  
   */
  private async getLastSyncedTweetId(accountSlug: string): Promise<string | null> {
    const tableName = `account_${accountSlug}_tweets`;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error(`Failed to get last synced tweet for ${accountSlug}`, error);
      return null;
    }

    return data && data.length > 0 && data[0] ? data[0].id : null;
  }

  /**
   * Fetch new tweets from Twitter timeline for an account
   */
  private async fetchNewTweetsFromTimeline(account: any): Promise<TwitterPost[]> {
    try {
      // Get Twitter user ID
      const userId = await this.getTwitterUserId(account.twitter_handle);
      if (!userId) {
        this.logger.warn(`Could not find Twitter user ID for @${account.twitter_handle}`);
        return [];
      }

      // Get last synced tweet ID to avoid duplicates
      const lastTweetId = await this.getLastSyncedTweetId(account.slug);
      
      this.logger.info(`Fetching new tweets for ${account.name} since ${lastTweetId || 'beginning'}`);

      // Fetch new tweets from timeline
      await this.waitForApiErrorCooldown();
      await this.rateLimitManager.checkRateLimit();
      const newTweets = await this.twitterService.fetchUserTweets(userId, lastTweetId || undefined);
      this.rateLimitManager.incrementRequestCount();

      this.logger.info(`Found ${newTweets.length} new tweets for ${account.name}`);
      return newTweets;

    } catch (error) {
      await this.handleApiError(error, `fetchNewTweetsFromTimeline(${account.name})`);
      return [];
    }
  }

  /**
   * Store new tweets in the database
   */
  private async storeNewTweets(account: any, tweets: TwitterPost[]): Promise<number> {
    if (tweets.length === 0) return 0;

    const tableName = `account_${account.slug}_tweets`;
    let stored = 0;

    for (const tweet of tweets) {
      try {
        // Validate and sanitize tweet data
        const validation = this.validateTweetData(tweet, account);
        if (!validation.isValid) {
          this.logger.error(`Invalid tweet data for ${tweet.id || 'unknown'}: ${validation.error}`, {
            tweetId: tweet.id,
            accountSlug: account.slug,
            validationError: validation.error
          });
          continue;
        }

        const { error } = await supabase
          .from(tableName)
          .insert(validation.data);

        if (error) {
          // Skip if already exists (duplicate key)
          if (error.code === '23505') {
            this.logger.debug(`Tweet ${tweet.id} already exists, skipping`);
          } else {
            this.logger.error(`Failed to store tweet ${tweet.id}: ${error.message}`, {
              error: error,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
              tweetId: tweet.id,
              accountSlug: account.slug,
              tableName: tableName,
              tweetData: validation.data
            });
          }
        } else {
          stored++;
          this.logger.debug(`Stored new tweet ${tweet.id}`);
        }
      } catch (error) {
        this.logger.error(`Error storing tweet ${tweet.id}: ${error instanceof Error ? error.message : String(error)}`, {
          error: error,
          tweetId: tweet.id,
          accountSlug: account.slug,
          tableName: tableName,
          errorStack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    return stored;
  }

  /**
   * Get tweets from the last N days for a specific account
   */
  private async getRecentTweets(accountSlug: string, days: number = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const tableName = `account_${accountSlug}_tweets`;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch recent tweets for ${accountSlug}`, error);
      return [];
    }

    return data || [];
  }

  /**
   * Fetch latest engagement data for a batch of tweet IDs
   */
  private async fetchEngagementData(tweetIds: string[]): Promise<TwitterPost[]> {
    try {
      await this.waitForApiErrorCooldown();
      await this.rateLimitManager.checkRateLimit();
      
      // Use Twitter API v2 to get tweet details by IDs
      const response = await this.twitterService.getTweetsByIds(tweetIds);
      this.rateLimitManager.incrementRequestCount();
      return response;
    } catch (error) {
      await this.handleApiError(error, `fetchEngagementData(${tweetIds.length} tweets)`);
      throw error;
    }
  }

  /**
   * Update engagement metrics in Supabase
   */
  private async updateEngagementMetrics(
    accountSlug: string,
    tweets: TwitterPost[]
  ): Promise<{ updated: number; added: number }> {
    const tableName = `account_${accountSlug}_tweets`;
    let updated = 0;
    let added = 0;

    for (const tweet of tweets) {
      try {
        // Find the account info for validation
        const account = { slug: accountSlug, twitter_handle: 'unknown', name: 'unknown' };
        
        // Validate and sanitize tweet data
        const validation = this.validateTweetData(tweet, account);
        if (!validation.isValid) {
          this.logger.error(`Invalid tweet data for ${tweet.id || 'unknown'}: ${validation.error}`, {
            tweetId: tweet.id,
            accountSlug: accountSlug,
            validationError: validation.error
          });
          continue;
        }

        const { data: existingTweet } = await supabase
          .from(tableName)
          .select('id, like_count, retweet_count, reply_count, quote_count')
          .eq('id', tweet.id)
          .single();

        // For updates, we only need engagement metrics and timestamps
        const updateData = {
          id: validation.data.id,
          text: validation.data.text,
          created_at: validation.data.created_at,
          like_count: validation.data.like_count,
          retweet_count: validation.data.retweet_count,
          reply_count: validation.data.reply_count,
          quote_count: validation.data.quote_count,
          view_count: validation.data.view_count,
          author_id: validation.data.author_id,
          updated_at: new Date().toISOString()
        };

        if (existingTweet) {
          // Update existing tweet
          const { error } = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', tweet.id);

          if (error) {
            this.logger.error(`Failed to update tweet ${tweet.id}: ${error.message}`, {
              error: error,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
              tweetId: tweet.id,
              accountSlug: accountSlug,
              tableName: tableName,
              updateData: updateData
            });
          } else {
            updated++;
            this.logger.debug(`Updated engagement for tweet ${tweet.id}`);
          }
        } else {
          // Add new tweet (use full validated data)
          const { error } = await supabase
            .from(tableName)
            .insert(validation.data);

          if (error) {
            this.logger.error(`Failed to insert tweet ${tweet.id}: ${error.message}`, {
              error: error,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
              tweetId: tweet.id,
              accountSlug: accountSlug,
              tableName: tableName,
              insertData: validation.data
            });
          } else {
            added++;
            this.logger.debug(`Added new tweet ${tweet.id}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error processing tweet ${tweet.id}: ${error instanceof Error ? error.message : String(error)}`, {
          error: error,
          tweetId: tweet.id,
          accountSlug: accountSlug,
          tableName: tableName,
          errorStack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    return { updated, added };
  }

  /**
   * Sync engagement data for a specific account
   */
  private async syncDAOEngagement(account: any): Promise<Partial<SyncStats>> {
    const startTime = Date.now();
    const stats: Partial<SyncStats> = {
      totalTweetsProcessed: 0,
      tweetsUpdated: 0,
      tweetsAdded: 0,
      apiRequestsUsed: 0,
      errors: []
    };

    try {
      this.logger.info(`Starting engagement sync for ${account.name} (@${account.twitter_handle})`);

      // Step 1: Fetch and store new tweets from Twitter timeline
      this.logger.info(`Fetching new tweets from timeline for ${account.name}`);
      const newTweets = await this.fetchNewTweetsFromTimeline(account);
      const newTweetsStored = await this.storeNewTweets(account, newTweets);
      
      stats.tweetsAdded = newTweetsStored;
      stats.apiRequestsUsed = (stats.apiRequestsUsed || 0) + (newTweets.length > 0 ? 2 : 1); // User lookup + timeline fetch
      
      this.logger.info(`Stored ${newTweetsStored} new tweets for ${account.name}`);

      // Step 2: Get recent tweets from our database (including newly added ones)
      const recentTweets = await this.getRecentTweets(account.slug, this.options.daysToLookBack);
      
      if (recentTweets.length === 0) {
        this.logger.info(`No recent tweets found for ${account.name}`);
        return stats;
      }

      this.logger.info(`Found ${recentTweets.length} recent tweets to update engagement for ${account.name}`);

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
          const { updated, added } = await this.updateEngagementMetrics(account.slug, freshTweets);
          
          stats.tweetsUpdated = (stats.tweetsUpdated || 0) + updated;
          stats.tweetsAdded = (stats.tweetsAdded || 0) + added;
          stats.totalTweetsProcessed = (stats.totalTweetsProcessed || 0) + freshTweets.length;

          this.logger.info(`Processed batch: ${updated} updated, ${added} added`);
          
        } catch (error) {
          const errorMsg = `Failed to process batch for ${account.name}: ${error}`;
          stats.errors?.push(errorMsg);
          this.logger.error(errorMsg, error);
        }
      }

      const duration = Date.now() - startTime;
      stats.syncDuration = duration;

      this.logger.info(`Completed sync for ${account.name}: ${stats.totalTweetsProcessed} tweets processed in ${duration}ms`);

    } catch (error) {
      const errorMsg = `Failed to sync ${account.name}: ${error}`;
      stats.errors?.push(errorMsg);
      this.logger.error(errorMsg, error);
    }

    return stats;
  }

  /**
   * Run engagement sync for all accounts
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

      const accounts = await this.getDAOTwitterAccounts();
      this.logger.info(`Found ${accounts.length} accounts with Twitter handles`);

      for (const account of accounts) {
        try {
          const accountStats = await this.syncDAOEngagement(account);
          
          // Aggregate stats
          aggregateStats.totalTweetsProcessed += accountStats.totalTweetsProcessed || 0;
          aggregateStats.tweetsUpdated += accountStats.tweetsUpdated || 0;
          aggregateStats.tweetsAdded += accountStats.tweetsAdded || 0;
          aggregateStats.apiRequestsUsed += accountStats.apiRequestsUsed || 0;
          aggregateStats.errors.push(...(accountStats.errors || []));

        } catch (error) {
          const errorMsg = `Failed to sync account ${account.name}: ${error}`;
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
    this.logger.info('📋 Note: API errors will trigger 15-minute cooldown periods');

    // Run initial sync
    this.runEngagementSync().catch(error => {
      this.logger.error('Initial sync failed', error);
    });

    // Set up interval
    this.syncInterval = setInterval(
      () => {
        // Check if we're in API error cooldown before running sync
        const timeSinceLastError = Date.now() - this.lastApiErrorTime;
        if (timeSinceLastError < 15 * 60 * 1000) {
          this.logger.info('Skipping scheduled sync - still in API error cooldown period');
          return;
        }
        
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