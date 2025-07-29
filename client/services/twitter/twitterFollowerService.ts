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

export interface FollowerGrowthPeriod {
  start_date: string;
  end_date: string;
  start_followers: number;
  end_followers: number;
  growth_count: number;
  growth_percentage: number;
}

export interface WeeklyGrowth extends FollowerGrowthPeriod {
  week_start_date: string;
  week_end_date: string;
}

export interface MonthlyGrowth extends FollowerGrowthPeriod {
  month_start_date: string;
  month_end_date: string;
}

export interface YearlyGrowth extends FollowerGrowthPeriod {
  year_start_date: string;
  year_end_date: string;
}

export interface GrowthSummary {
  period_type: 'weekly' | 'monthly' | 'yearly';
  recent_growth_count: number;
  recent_growth_percentage: number;
  average_growth_count: number;
  average_growth_percentage: number;
}

export interface TopGrowingAccount {
  account_id: string;
  account_name: string;
  twitter_handle: string;
  total_growth: number;
  average_growth_percentage: number;
  current_followers: number;
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
   * Update follower count for a specific account (with automatic growth calculation)
   */
  async updateAccountFollowerCount(accountId: string, followerCount: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_account_follower_count_with_auto_growth', {
        p_account_id: accountId,
        p_new_follower_count: followerCount
      });

      if (error) {
        throw new Error(`Failed to update follower count: ${error.message}`);
      }

      console.log(`✅ Updated follower count with auto-growth calculation for account ${accountId}: ${followerCount}`);
    } catch (error: any) {
      console.error(`❌ Error updating follower count for account ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update follower count only (without growth calculation for bulk operations)
   */
  async updateAccountFollowerCountOnly(accountId: string, followerCount: number): Promise<void> {
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

        // Update each account in the batch (growth will be auto-calculated by trigger)
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
    console.log('📈 Growth metrics automatically calculated by database triggers');
    
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

  /**
   * Get weekly follower growth for an account
   */
  async getWeeklyFollowerGrowth(accountId: string, weeksBack: number = 4): Promise<WeeklyGrowth[]> {
    try {
      const { data, error } = await supabase.rpc('get_weekly_follower_growth', {
        p_account_id: accountId,
        p_weeks_back: weeksBack
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching weekly growth for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get monthly follower growth for an account
   */
  async getMonthlyFollowerGrowth(accountId: string, monthsBack: number = 12): Promise<MonthlyGrowth[]> {
    try {
      const { data, error } = await supabase.rpc('get_monthly_follower_growth', {
        p_account_id: accountId,
        p_months_back: monthsBack
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching monthly growth for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get yearly follower growth for an account
   */
  async getYearlyFollowerGrowth(accountId: string, yearsBack: number = 3): Promise<YearlyGrowth[]> {
    try {
      const { data, error } = await supabase.rpc('get_yearly_follower_growth', {
        p_account_id: accountId,
        p_years_back: yearsBack
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching yearly growth for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get growth summary across all time periods for an account
   */
  async getAccountGrowthSummary(accountId: string): Promise<GrowthSummary[]> {
    try {
      const { data, error } = await supabase.rpc('get_account_growth_summary', {
        p_account_id: accountId
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching growth summary for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get top growing accounts by period
   */
  async getTopGrowingAccounts(
    periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly', 
    limit: number = 10
  ): Promise<TopGrowingAccount[]> {
    try {
      const { data, error } = await supabase.rpc('get_top_growing_accounts', {
        p_period_type: periodType,
        p_limit: limit
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching top growing accounts for ${periodType}:`, error.message);
      return [];
    }
  }

  /**
   * Get comprehensive growth analytics for an account
   */
  async getComprehensiveGrowthAnalytics(accountId: string): Promise<{
    summary: GrowthSummary[];
    weekly: WeeklyGrowth[];
    monthly: MonthlyGrowth[];
    yearly: YearlyGrowth[];
  }> {
    try {
      const [summary, weekly, monthly, yearly] = await Promise.all([
        this.getAccountGrowthSummary(accountId),
        this.getWeeklyFollowerGrowth(accountId, 8), // Last 8 weeks
        this.getMonthlyFollowerGrowth(accountId, 12), // Last 12 months
        this.getYearlyFollowerGrowth(accountId, 3) // Last 3 years
      ]);

      return {
        summary,
        weekly,
        monthly,
        yearly
      };
    } catch (error: any) {
      console.error(`Error fetching comprehensive growth analytics for account ${accountId}:`, error.message);
      return {
        summary: [],
        weekly: [],
        monthly: [],
        yearly: []
      };
    }
  }

  /**
   * Update growth periods for a specific account
   */
  async updateAccountGrowthPeriods(accountId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_account_growth_periods', {
        p_account_id: accountId
      });

      if (error) {
        throw new Error(`Failed to update growth periods: ${error.message}`);
      }

      console.log(`✅ Growth periods updated for account ${accountId}`);
    } catch (error: any) {
      console.error(`❌ Error updating growth periods for account ${accountId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get growth metrics for an account by period type
   */
  async getAccountGrowthMetrics(
    accountId: string, 
    periodType?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    limit: number = 10
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('account_growth_metrics')
        .select('*')
        .eq('account_id', accountId)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (periodType) {
        query = query.eq('period_type', periodType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching growth metrics for account ${accountId}:`, error.message);
      return [];
    }
  }

  /**
   * Get latest growth metrics for all accounts (from the view)
   */
  async getLatestGrowthMetrics(periodType?: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<any[]> {
    try {
      let query = supabase
        .from('account_latest_growth')
        .select('*')
        .order('follower_count', { ascending: false });

      if (periodType) {
        query = query.eq('period_type', periodType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching latest growth metrics:', error.message);
      return [];
    }
  }

  /**
   * Get top growing accounts by period
   */
  async getTopGrowingAccountsByPeriod(
    periodType: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    limit: number = 10
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('account_latest_growth')
        .select('*')
        .eq('period_type', periodType)
        .order('growth_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching top growing accounts for ${periodType}:`, error.message);
      return [];
    }
  }

  /**
   * Get comprehensive growth data for an account
   */
  async getAccountComprehensiveGrowth(accountId: string): Promise<{
    daily: any[];
    weekly: any[];
    monthly: any[];
    yearly: any[];
  }> {
    try {
      const [daily, weekly, monthly, yearly] = await Promise.all([
        this.getAccountGrowthMetrics(accountId, 'daily', 30),
        this.getAccountGrowthMetrics(accountId, 'weekly', 12),
        this.getAccountGrowthMetrics(accountId, 'monthly', 12),
        this.getAccountGrowthMetrics(accountId, 'yearly', 3)
      ]);

      return { daily, weekly, monthly, yearly };
    } catch (error: any) {
      console.error(`Error fetching comprehensive growth for account ${accountId}:`, error.message);
      return { daily: [], weekly: [], monthly: [], yearly: [] };
    }
  }
}

export default TwitterFollowerService; 