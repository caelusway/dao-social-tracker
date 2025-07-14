import { supabase } from '../supabase/client.js';

export interface TwitterPost {
  id: string;
  type?: string;
  url?: string;
  twitter_url?: string;
  text?: string;
  source?: string;
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  view_count?: number;
  bookmark_count?: number;
  created_at?: string;
  lang?: string;
  is_reply?: boolean;
  in_reply_to_id?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  in_reply_to_username?: string;
  author_username?: string;
  author_name?: string;
  author_id?: string;
  mentions?: any[];
  hashtags?: any[];
  urls?: any[];
  media?: any[];
  raw_data?: any;
  synced_at?: string;
  updated_at?: string;
}

export interface TwitterAnalytics {
  total_tweets: number;
  total_likes: number;
  total_retweets: number;
  total_views: number;
  avg_likes_per_tweet: number;
  avg_retweets_per_tweet: number;
  avg_views_per_tweet: number;
  most_liked_tweet: TwitterPost | null;
  most_retweeted_tweet: TwitterPost | null;
  recent_tweets: TwitterPost[];
}

export class AccountTwitterService {
  
  // Get table name for an Account
  private getTableName(accountSlug: string): string {
    return `account_${accountSlug}_tweets`;
  }

  // Create a new Account Twitter table
  async createAccountTwitterTable(accountSlug: string): Promise<void> {
    const { error } = await supabase.rpc('create_account_twitter_table', {
      account_slug: accountSlug
    });
    
    if (error) {
      throw new Error(`Failed to create Twitter table for ${accountSlug}: ${error.message}`);
    }
  }

  // Insert Twitter posts for a DAO
  async insertTwitterPosts(accountSlug: string, posts: TwitterPost[]): Promise<void> {
    const tableName = this.getTableName(accountSlug);
    
    // Transform posts to match database schema
    const transformedPosts = posts.map(post => ({
      id: post.id,
      type: post.type || 'tweet',
      url: post.url,
      twitter_url: post.twitter_url,
      text: post.text,
      source: post.source,
      retweet_count: post.retweet_count || 0,
      reply_count: post.reply_count || 0,
      like_count: post.like_count || 0,
      quote_count: post.quote_count || 0,
      view_count: post.view_count || 0,
      bookmark_count: post.bookmark_count || 0,
      created_at: post.created_at ? new Date(post.created_at).toISOString() : null,
      lang: post.lang,
      is_reply: post.is_reply || false,
      in_reply_to_id: post.in_reply_to_id,
      conversation_id: post.conversation_id,
      in_reply_to_user_id: post.in_reply_to_user_id,
      in_reply_to_username: post.in_reply_to_username,
      author_username: post.author_username,
      author_name: post.author_name,
      author_id: post.author_id,
      mentions: post.mentions || [],
      hashtags: post.hashtags || [],
      urls: post.urls || [],
      media: post.media || [],
      raw_data: post.raw_data || post,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(tableName)
      .upsert(transformedPosts, { onConflict: 'id' });
    
    if (error) {
      throw new Error(`Failed to insert Twitter posts for ${accountSlug}: ${error.message}`);
    }
  }

  // Get Twitter posts for a DAO
  async getTwitterPosts(
    accountSlug: string, 
    options: {
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'like_count' | 'retweet_count' | 'view_count';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<TwitterPost[]> {
    const tableName = this.getTableName(accountSlug);
    const { 
      limit = 50, 
      offset = 0, 
      orderBy = 'created_at', 
      orderDirection = 'desc' 
    } = options;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Failed to fetch Twitter posts for ${accountSlug}: ${error.message}`);
    }
    
    return data || [];
  }

  // Get Twitter analytics for a DAO
  async getTwitterAnalytics(accountSlug: string): Promise<TwitterAnalytics> {
    const tableName = this.getTableName(accountSlug);
    
    // Get basic stats
    const { data: stats, error: statsError } = await supabase
      .from(tableName)
      .select('like_count, retweet_count, view_count')
      .not('like_count', 'is', null)
      .not('retweet_count', 'is', null)
      .not('view_count', 'is', null);
    
    if (statsError) {
      throw new Error(`Failed to fetch analytics for ${accountSlug}: ${statsError.message}`);
    }

    // Get most liked tweet
    const { data: mostLiked, error: likedError } = await supabase
      .from(tableName)
      .select('*')
      .order('like_count', { ascending: false })
      .limit(1);
    
    // Get most retweeted tweet
    const { data: mostRetweeted, error: retweetError } = await supabase
      .from(tableName)
      .select('*')
      .order('retweet_count', { ascending: false })
      .limit(1);
    
    // Get recent tweets
    const { data: recent, error: recentError } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (likedError || retweetError || recentError) {
      console.warn('Some analytics queries failed, returning partial data');
    }

    const totalTweets = stats?.length || 0;
    const totalLikes = stats?.reduce((sum, tweet) => sum + (tweet.like_count || 0), 0) || 0;
    const totalRetweets = stats?.reduce((sum, tweet) => sum + (tweet.retweet_count || 0), 0) || 0;
    const totalViews = stats?.reduce((sum, tweet) => sum + (tweet.view_count || 0), 0) || 0;

    return {
      total_tweets: totalTweets,
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      total_views: totalViews,
      avg_likes_per_tweet: totalTweets > 0 ? Math.round(totalLikes / totalTweets) : 0,
      avg_retweets_per_tweet: totalTweets > 0 ? Math.round(totalRetweets / totalTweets) : 0,
      avg_views_per_tweet: totalTweets > 0 ? Math.round(totalViews / totalTweets) : 0,
      most_liked_tweet: mostLiked?.[0] || null,
      most_retweeted_tweet: mostRetweeted?.[0] || null,
      recent_tweets: recent || []
    };
  }

  // Search tweets for a DAO
  async searchTwitterPosts(
    accountSlug: string, 
    query: string, 
    options: { limit?: number } = {}
  ): Promise<TwitterPost[]> {
    const tableName = this.getTableName(accountSlug);
    const { limit = 50 } = options;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .textSearch('text', query)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to search Twitter posts for ${accountSlug}: ${error.message}`);
    }
    
    return data || [];
  }

  // Get engagement metrics over time
  async getEngagementMetrics(
    accountSlug: string,
    days: number = 30
  ): Promise<Array<{
    date: string;
    tweet_count: number;
    total_likes: number;
    total_retweets: number;
    total_views: number;
  }>> {
    const tableName = this.getTableName(accountSlug);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from(tableName)
      .select('created_at, like_count, retweet_count, view_count')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch engagement metrics for ${accountSlug}: ${error.message}`);
    }
    
    // Group by date
    const metrics = new Map();
    data?.forEach(tweet => {
      if (!tweet.created_at) return;
      
      const date = new Date(tweet.created_at).toISOString().split('T')[0];
      if (!metrics.has(date)) {
        metrics.set(date, {
          date,
          tweet_count: 0,
          total_likes: 0,
          total_retweets: 0,
          total_views: 0
        });
      }
      
      const dayMetrics = metrics.get(date);
      dayMetrics.tweet_count++;
      dayMetrics.total_likes += tweet.like_count || 0;
      dayMetrics.total_retweets += tweet.retweet_count || 0;
      dayMetrics.total_views += tweet.view_count || 0;
    });
    
    return Array.from(metrics.values());
  }
}

// Backward compatibility - export the old class name
export class DAOTwitterService extends AccountTwitterService {
  // All methods are inherited from AccountTwitterService
  // This class exists for backward compatibility only
}

// Also export as default for backward compatibility
export default AccountTwitterService; 