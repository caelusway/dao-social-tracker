import { initializeTwitterSync } from '../services/twitter';
import { supabase } from '../services/supabase/client';

// Example: How to use the Twitter sync service
export async function setupTwitterSync() {
  try {
    // Initialize the Twitter sync service
    // It will use the TWITTER_BEARER_TOKEN from environment variables
    const syncManager = initializeTwitterSync();
    
    console.log('Twitter sync service started successfully!');
    
    // The service will now:
    // 1. Run immediately to sync existing tweets
    // 2. Continue syncing every 15 minutes
    
    return syncManager;
  } catch (error) {
    console.error('Failed to initialize Twitter sync:', error);
    throw error;
  }
}

// Example: How to manually add Account Twitter accounts
export async function addAccountTwitterAccount(accountId: string, twitterUsername: string) {
  try {
    const { data, error } = await supabase
      .from('account_twitter_accounts')
      .insert({
        account_id: accountId,
        username: twitterUsername
      })
      .select();

    if (error) throw error;
    
    console.log(`Added Twitter account @${twitterUsername} for Account ${accountId}`);
    return data;
  } catch (error) {
    console.error('Error adding Account Twitter account:', error);
    throw error;
  }
}

// Example: How to get Twitter data for a specific Account
export async function getAccountTwitterData(accountId: string) {
  try {
    const { data, error } = await supabase
      .from('account_twitter_posts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching Account Twitter data:', error);
    throw error;
  }
}

// Example: How to get engagement metrics for an Account
export async function getAccountEngagementMetrics(accountId: string) {
  try {
    const { data, error } = await supabase
      .from('account_twitter_posts')
      .select(`
        retweet_count,
        reply_count,
        like_count,
        quote_count,
        created_at
      `)
      .eq('account_id', accountId);

    if (error) throw error;

    // Calculate total engagement
    const totalEngagement = data.reduce((acc, post) => ({
      retweets: acc.retweets + post.retweet_count,
      replies: acc.replies + post.reply_count,
      likes: acc.likes + post.like_count,
      quotes: acc.quotes + post.quote_count,
    }), { retweets: 0, replies: 0, likes: 0, quotes: 0 });

    return {
      totalPosts: data.length,
      totalEngagement,
      averageEngagement: {
        retweets: Math.round(totalEngagement.retweets / data.length),
        replies: Math.round(totalEngagement.replies / data.length),
        likes: Math.round(totalEngagement.likes / data.length),
        quotes: Math.round(totalEngagement.quotes / data.length),
      }
    };
  } catch (error) {
    console.error('Error calculating engagement metrics:', error);
    throw error;
  }
}

// Backward compatibility functions
export const addDAOTwitterAccount = addAccountTwitterAccount;
export const getDAOTwitterData = getAccountTwitterData;
export const getDAOEngagementMetrics = getAccountEngagementMetrics; 