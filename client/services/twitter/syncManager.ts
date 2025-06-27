import { supabase } from '../supabase/client';
import TwitterService from './twitterService';
import { TWITTER_CONFIG } from './config';
import { DAOTwitterAccount } from './types';

class TwitterSyncManager {
  private twitterService: TwitterService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(bearerToken: string) {
    this.twitterService = new TwitterService(bearerToken);
  }

  private async getSyncStatus(daoId: string) {
    const { data, error } = await supabase
      .from('dao_twitter_sync_status')
      .select('last_tweet_id')
      .eq('dao_id', daoId)
      .single();

    if (error) {
      console.error('Error fetching sync status:', error);
      return null;
    }

    return data?.last_tweet_id;
  }

  private async getDAOAccounts(): Promise<DAOTwitterAccount[]> {
    const { data, error } = await supabase
      .from('dao_twitter_accounts')
      .select('*');

    if (error) {
      console.error('Error fetching DAO accounts:', error);
      return [];
    }

    return data || [];
  }

  async syncDaoTwitterData() {
    if (this.isRunning) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const daoAccounts = await this.getDAOAccounts();

      for (const account of daoAccounts) {
        try {
          // Get user details first
          const user = await this.twitterService.getUserByUsername(account.username);
          if (!user) {
            console.error(`User not found for username: ${account.username}`);
            continue;
          }

          // Get last synced tweet ID
          const lastTweetId = await this.getSyncStatus(account.dao_id);

          // Fetch new tweets
          const tweets = await this.twitterService.fetchUserTweets(user.id, lastTweetId);

          if (tweets.length > 0) {
            // Store the tweets
            await this.twitterService.storeTwitterData(tweets, account.dao_id);

            // Update sync status with the most recent tweet ID
            await this.twitterService.updateSyncStatus(account.dao_id, tweets[0]?.id || '');

            console.log(`Successfully synced ${tweets.length} tweets for ${account.username}`);
          } else {
            console.log(`No new tweets found for ${account.username}`);
          }
        } catch (error) {
          console.error(`Error processing DAO ${account.username}:`, error);
          // Continue with next DAO even if one fails
          continue;
        }
      }
    } catch (error) {
      console.error('Error in Twitter sync:', error);
    } finally {
      this.isRunning = false;
    }
  }

  startSync() {
    if (this.syncInterval) {
      console.log('Sync already started');
      return;
    }

    // Run initial sync
    this.syncDaoTwitterData();

    // Set up interval for future syncs
    this.syncInterval = setInterval(
      () => this.syncDaoTwitterData(),
      TWITTER_CONFIG.FETCH_INTERVAL
    );

    console.log('Twitter sync started');
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Twitter sync stopped');
    }
  }
}

export default TwitterSyncManager; 