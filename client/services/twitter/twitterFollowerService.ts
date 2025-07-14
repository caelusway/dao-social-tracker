import axios, { AxiosInstance } from 'axios';
import { supabase } from '../supabase/client';
import { Account, FollowerHistory, FollowerTrend } from '../types/dao';
import { TWITTER_CONFIG, RATE_LIMITS } from './config';

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

export class TwitterFollowerService {
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
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.rateLimitCounter = 0;
    }
    await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.DELAY_BETWEEN_REQUESTS));
    this.rateLimitCounter++;
  }

  /**
   * Fetch user information including follower count by username
   */
  async getUserInfo(username: string): Promise<TwitterUserInfo | null> {
    try {
      await this.checkRateLimit();
      
      const response = await this.apiClient.get(`/users/by/username/${username}`, {
        params: {
          'user.fields': 'public_metrics,verified,created_at'
        }
      });

      return response.data.data as TwitterUserInfo;
    } catch (error: any) {
      console.error(`Error fetching user info for ${username}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Fetch follower count for multiple users by usernames
   */
  async getMultipleUsersInfo(usernames: string[]): Promise<TwitterUserInfo[]> {
    try {
      await this.checkRateLimit();
      
      // Twitter API allows up to 100 usernames per request
      const usernameParam = usernames.slice(0, 100).join(',');
      
      const response = await this.apiClient.get('/users/by', {
        params: {
          usernames: usernameParam,
          'user.fields': 'public_metrics,verified,created_at'
        }
      });

      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching multiple users info:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Update follower count for a specific account
   */
  async updateAccountFollowerCount(accountId: string, followerCount: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_account_follower_count', {
        p_account_id: accountId,
        p_new_follower_count: followerCount
      });

      if (error) {
        throw new Error(`Failed to update follower count: ${error.message}`);
      }

      console.log(`✅ Updated follower count for account ${accountId}: ${followerCount}`);
    } catch (error: any) {
      console.error(`❌ Error updating follower count for account ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all accounts with Twitter handles
   */
  async getAccountsWithTwitterHandles(): Promise<Account[]> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .not('twitter_handle', 'is', null)
        .not('twitter_handle', 'eq', '');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching accounts with Twitter handles:', error.message);
      return [];
    }
  }

  /**
   * Update follower counts for all accounts
   */
  async updateAllFollowerCounts(): Promise<{ success: number; errors: number }> {
    console.log('🚀 Starting follower count update for all accounts...');
    
    const accounts = await this.getAccountsWithTwitterHandles();
    let success = 0;
    let errors = 0;

    console.log(`📊 Found ${accounts.length} accounts with Twitter handles`);

    // Process accounts in batches to respect rate limits
    const batchSize = 50; // Conservative batch size
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      const usernames = batch.map(account => account.twitter_handle).filter(Boolean) as string[];
      
      if (usernames.length === 0) continue;

      try {
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(accounts.length / batchSize)}`);
        
        const usersInfo = await this.getMultipleUsersInfo(usernames);
        
        // Create a map for quick lookup
        const userInfoMap = new Map<string, TwitterUserInfo>();
        usersInfo.forEach(user => {
          userInfoMap.set(user.username.toLowerCase(), user);
        });

        // Update each account in the batch
        for (const account of batch) {
          if (!account.twitter_handle) continue;
          
          const userInfo = userInfoMap.get(account.twitter_handle.toLowerCase());
          if (userInfo) {
            try {
              await this.updateAccountFollowerCount(account.id, userInfo.public_metrics.followers_count);
              success++;
            } catch (error) {
              console.error(`❌ Failed to update ${account.name} (${account.twitter_handle}):`, error);
              errors++;
            }
          } else {
            console.warn(`⚠️ User info not found for ${account.name} (${account.twitter_handle})`);
            errors++;
          }
        }

        // Add delay between batches to be respectful to the API
        if (i + batchSize < accounts.length) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error processing batch starting at index ${i}:`, error);
        errors += batch.length;
      }
    }

    console.log(`✅ Follower count update completed! Success: ${success}, Errors: ${errors}`);
    return { success, errors };
  }

  /**
   * Get follower history for an account
   */
  async getFollowerHistory(accountId: string, limit: number = 30): Promise<FollowerHistory[]> {
    try {
      const { data, error } = await supabase
        .from('account_follower_history')
        .select('*')
        .eq('account_id', accountId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching follower history for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get follower trends for an account
   */
  async getFollowerTrends(accountId: string, daysBack: number = 30): Promise<FollowerTrend[]> {
    try {
      const { data, error } = await supabase.rpc('get_account_follower_trends', {
        p_account_id: accountId,
        p_days_back: daysBack
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching follower trends for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get accounts with the highest follower counts
   */
  async getTopAccountsByFollowers(limit: number = 10): Promise<Account[]> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .not('follower_count', 'is', null)
        .order('follower_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching top accounts by followers:', error.message);
      return [];
    }
  }

  /**
   * Get accounts that need follower count updates (older than 24 hours)
   */
  async getAccountsNeedingUpdate(): Promise<Account[]> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .not('twitter_handle', 'is', null)
        .not('twitter_handle', 'eq', '')
        .or('follower_count_updated_at.is.null,follower_count_updated_at.lt.' + 
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching accounts needing update:', error.message);
      return [];
    }
  }
}

export default TwitterFollowerService; 