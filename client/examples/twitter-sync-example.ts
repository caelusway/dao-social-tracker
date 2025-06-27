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

// Example: How to manually add DAO Twitter accounts
export async function addDAOTwitterAccount(daoId: string, twitterUsername: string) {
  try {
    const { data, error } = await supabase
      .from('dao_twitter_accounts')
      .insert({
        dao_id: daoId,
        username: twitterUsername
      })
      .select();

    if (error) throw error;
    
    console.log(`Added Twitter account @${twitterUsername} for DAO ${daoId}`);
    return data;
  } catch (error) {
    console.error('Error adding DAO Twitter account:', error);
    throw error;
  }
}

// Example: How to get Twitter data for a specific DAO
export async function getDAOTwitterData(daoId: string) {
  try {
    const { data, error } = await supabase
      .from('dao_twitter_posts')
      .select('*')
      .eq('dao_id', daoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching DAO Twitter data:', error);
    throw error;
  }
}

// Example: How to get engagement metrics for a DAO
export async function getDAOEngagementMetrics(daoId: string) {
  try {
    const { data, error } = await supabase
      .from('dao_twitter_posts')
      .select(`
        retweet_count,
        reply_count,
        like_count,
        quote_count,
        created_at
      `)
      .eq('dao_id', daoId);

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