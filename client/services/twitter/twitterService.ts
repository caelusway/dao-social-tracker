import axios, { AxiosInstance } from 'axios';
import { TwitterPost, AccountTwitterAccount } from './types';
import { TWITTER_CONFIG, RATE_LIMITS, ENDPOINTS } from './config';
import { supabase } from '../supabase/client';

class TwitterService {
  private apiClient: AxiosInstance;
  private rateLimitCounter: number = 0;
  private lastResetTime: number = Date.now();

  constructor(bearerToken: string) {
    this.apiClient = axios.create({
      baseURL: TWITTER_CONFIG.BASE_URL,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      }
    });

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
            'user.fields': 'id,username,public_metrics'
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching user by username ${username}:`, error);
      return null;
    }
  }

  async fetchUserTweets(userId: string, lastTweetId?: string): Promise<TwitterPost[]> {
    try {
      await this.checkRateLimit();
      const params: any = {
        'tweet.fields': 'created_at,public_metrics,author_id'
      };
      
      if (lastTweetId) {
        params.since_id = lastTweetId;
      }

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

  async storeTwitterData(posts: TwitterPost[], accountId: string) {
    try {
      const { error } = await supabase
        .from('account_twitter_posts')
        .upsert(
          posts.map(post => ({
            tweet_id: post.id,
            account_id: accountId,
            content: post.text,
            created_at: post.created_at,
            retweet_count: post.public_metrics.retweet_count,
            reply_count: post.public_metrics.reply_count,
            like_count: post.public_metrics.like_count,
            quote_count: post.public_metrics.quote_count,
            synced_at: new Date().toISOString()
          }))
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error storing twitter data:', error);
      throw error;
    }
  }

  async updateSyncStatus(accountId: string, lastTweetId: string) {
    try {
      const { error } = await supabase
        .from('account_twitter_sync_status')
        .upsert({
          account_id: accountId,
          last_tweet_id: lastTweetId,
          last_sync_time: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  async getTweetsByIds(tweetIds: string[]): Promise<TwitterPost[]> {
    try {
      await this.checkRateLimit();
      
      // Twitter API v2 allows up to 100 tweet IDs per request
      const idsParam = tweetIds.slice(0, 100).join(',');
      
      const response = await this.apiClient.get('/tweets', {
        params: {
          ids: idsParam,
          'tweet.fields': 'created_at,public_metrics,author_id'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error(`Error fetching tweets by IDs:`, error);
      throw error;
    }
  }
}

export default TwitterService; 