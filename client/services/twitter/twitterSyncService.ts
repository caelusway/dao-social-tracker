import axios, { AxiosInstance } from 'axios';
import { BioDAOService } from '../biodao/biodaoService';
import { TwitterPostData, BioDAO, BioDAOSocialAccount } from '../types/biodao';
import { TWITTER_CONFIG, RATE_LIMITS, ENDPOINTS } from './config';

export class TwitterSyncService {
  private apiClient: AxiosInstance;
  private biodaoService: BioDAOService;
  private rateLimitCounter: number = 0;
  private lastResetTime: number = Date.now();

  constructor(bearerToken: string) {
    this.apiClient = axios.create({
      baseURL: TWITTER_CONFIG.BASE_URL,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      }
    });

    this.biodaoService = new BioDAOService();

    // Reset rate limit counter every 15 minutes
    setInterval(() => {
      this.rateLimitCounter = 0;
      this.lastResetTime = Date.now();
    }, 15 * 60 * 1000);
  }

  private async checkRateLimit(): Promise<void> {
    if (this.rateLimitCounter >= RATE_LIMITS.TWEETS_PER_15_MIN) {
      const waitTime = (15 * 60 * 1000) - (Date.now() - this.lastResetTime);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.rateLimitCounter = 0;
    }
    await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.DELAY_BETWEEN_REQUESTS));
    this.rateLimitCounter++;
  }

  async getUserByUsername(username: string) {
    try {
      await this.checkRateLimit();
      const response = await this.apiClient.get(
        ENDPOINTS.USER_BY_USERNAME(username),
        {
          params: {
            'user.fields': 'id,username,name,public_metrics,verified'
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching user ${username}:`, error);
      throw error;
    }
  }

  async fetchUserTweets(userId: string, sinceId?: string): Promise<any[]> {
    try {
      await this.checkRateLimit();
      const params = {
        'tweet.fields': 'created_at,public_metrics,context_annotations,entities,referenced_tweets',
        'user.fields': 'id,username,name,verified,public_metrics',
        'expansions': 'author_id,referenced_tweets.id',
        'max_results': TWITTER_CONFIG.MAX_TWEETS_PER_REQUEST,
        ...(sinceId && { since_id: sinceId })
      };

      const response = await this.apiClient.get(
        ENDPOINTS.USER_TWEETS(userId),
        { params }
      );

      return response.data.data || [];
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error);
      return [];
    }
  }

  private transformTwitterDataToBioDAOFormat(tweet: any, userInfo: any): Omit<TwitterPostData, 'id' | 'synced_at' | 'created_at'> {
    return {
      platform: 'twitter',
      post_id: tweet.id,
      post_type: 'post',
      content: tweet.text,
      author_info: {
        username: userInfo.username,
        display_name: userInfo.name,
        user_id: userInfo.id,
        follower_count: userInfo.public_metrics?.followers_count,
        verified: userInfo.verified || false
      },
      engagement_metrics: {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        quotes: tweet.public_metrics?.quote_count || 0,
        views: tweet.public_metrics?.impression_count
      },
      platform_data: {
        tweet_type: this.determineTweetType(tweet),
        hashtags: tweet.entities?.hashtags?.map((h: any) => h.tag) || [],
        mentions: tweet.entities?.mentions?.map((m: any) => m.username) || [],
        urls: tweet.entities?.urls?.map((u: any) => u.expanded_url) || [],
        context_annotations: tweet.context_annotations || [],
        referenced_tweets: tweet.referenced_tweets || []
      },
      posted_at: tweet.created_at
    };
  }

  private determineTweetType(tweet: any): 'original' | 'retweet' | 'reply' | 'quote' {
    if (tweet.referenced_tweets) {
      const refType = tweet.referenced_tweets[0]?.type;
      if (refType === 'retweeted') return 'retweet';
      if (refType === 'replied_to') return 'reply';
      if (refType === 'quoted') return 'quote';
    }
    return 'original';
  }

  async syncBioDAOTwitterData(bioDAO: BioDAO): Promise<void> {
    try {
      // Get Twitter accounts for this BioDAO
      const twitterAccounts = await this.biodaoService.getSocialAccounts(bioDAO.id, 'twitter');
      
      if (twitterAccounts.length === 0) {
        console.log(`No Twitter accounts found for ${bioDAO.name}`);
        return;
      }

      for (const account of twitterAccounts) {
        try {
          console.log(`Syncing Twitter data for ${bioDAO.name} (@${account.account_identifier})`);
          
          // Get user details
          const userInfo = await this.getUserByUsername(account.account_identifier);
          if (!userInfo) {
            console.error(`User not found: @${account.account_identifier}`);
            continue;
          }

          // Get last sync data
          const syncStatus = await this.biodaoService.getSyncStatus(bioDAO.id, 'twitter');
          const lastTweetId = syncStatus[0]?.last_sync_data?.last_tweet_id;

          // Fetch new tweets
          const tweets = await this.fetchUserTweets(userInfo.id, lastTweetId);
          
          if (tweets.length > 0) {
            // Transform and store tweets
            for (const tweet of tweets) {
              const twitterData = this.transformTwitterDataToBioDAOFormat(tweet, userInfo);
              await this.biodaoService.storeSocialData(bioDAO.slug, twitterData);
            }

            // Update sync status
            await this.biodaoService.updateSyncStatus(bioDAO.id, 'twitter', {
              last_sync_time: new Date().toISOString(),
              last_sync_data: {
                last_tweet_id: tweets[0].id,
                tweets_count: tweets.length,
                user_info: {
                  username: userInfo.username,
                  followers: userInfo.public_metrics?.followers_count
                }
              },
              sync_errors: [],
              is_syncing: false
            });

            console.log(`✅ Synced ${tweets.length} tweets for ${bioDAO.name} (@${account.account_identifier})`);
          } else {
            console.log(`No new tweets for ${bioDAO.name} (@${account.account_identifier})`);
            
            // Update sync status even if no new tweets
            await this.biodaoService.updateSyncStatus(bioDAO.id, 'twitter', {
              last_sync_time: new Date().toISOString(),
              is_syncing: false
            });
          }

        } catch (error) {
          console.error(`Error syncing Twitter for ${bioDAO.name} (@${account.account_identifier}):`, error);
          
          // Update sync status with error
          await this.biodaoService.updateSyncStatus(bioDAO.id, 'twitter', {
            last_sync_time: new Date().toISOString(),
            sync_errors: [{ 
              timestamp: new Date().toISOString(), 
              error: error instanceof Error ? error.message : String(error),
              account: account.account_identifier
            }],
            is_syncing: false
          });
        }
      }

    } catch (error) {
      console.error(`Error in Twitter sync for ${bioDAO.name}:`, error);
      throw error;
    }
  }

  async syncAllBioDAOs(): Promise<void> {
    try {
      const bioDAOs = await this.biodaoService.getAllBioDAOs();
      console.log(`🔄 Starting Twitter sync for ${bioDAOs.length} BioDAOs`);

      for (const bioDAO of bioDAOs) {
        await this.syncBioDAOTwitterData(bioDAO);
        // Small delay between DAOs to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Completed Twitter sync for all BioDAOs');
    } catch (error) {
      console.error('❌ Error in Twitter sync:', error);
      throw error;
    }
  }
} 