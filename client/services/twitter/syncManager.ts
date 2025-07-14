import { supabase } from '../supabase/client';
import TwitterService from './twitterService';
import { TWITTER_CONFIG } from './config';
import { AccountTwitterAccount } from './types';

class TwitterSyncManager {
  private twitterService: TwitterService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(bearerToken: string) {
    this.twitterService = new TwitterService(bearerToken);
  }

  private async getSyncStatus(accountId: string) {
    const { data, error } = await supabase
      .from('account_twitter_sync_status')
      .select('last_tweet_id')
      .eq('account_id', accountId)
      .single();

    if (error) {
      console.error('Error fetching sync status:', error);
      return null;
    }

    return data?.last_tweet_id;
  }

  private async getAccountAccounts(): Promise<AccountTwitterAccount[]> {
    const { data, error } = await supabase
      .from('account_twitter_accounts')
      .select('*');

    if (error) {
      console.error('Error fetching Account accounts:', error);
      return [];
    }

    return data || [];
  }

  async syncAccountTwitterData() {
    if (this.isRunning) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const accountAccounts = await this.getAccountAccounts();

      for (const account of accountAccounts) {
        try {
          // Get user details first
          const user = await this.twitterService.getUserByUsername(account.username);
          if (!user) {
            console.error(`User not found for username: ${account.username}`);
            continue;
          }

          // Get last synced tweet ID
          const lastTweetId = await this.getSyncStatus(account.account_id);

          // Fetch new tweets
          const tweets = await this.twitterService.fetchUserTweets(user.id, lastTweetId);

          if (tweets.length > 0) {
            // Store the tweets
            await this.twitterService.storeTwitterData(tweets, account.account_id);

            // Update sync status with the most recent tweet ID
            await this.twitterService.updateSyncStatus(account.account_id, tweets[0]?.id || '');

            console.log(`Successfully synced ${tweets.length} tweets for ${account.username}`);
          } else {
            console.log(`No new tweets found for ${account.username}`);
          }
        } catch (error) {
          console.error(`Error processing Account ${account.username}:`, error);
          // Continue with next Account even if one fails
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
    this.syncAccountTwitterData();

    // Set up interval for future syncs
    this.syncInterval = setInterval(
      () => this.syncAccountTwitterData(),
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