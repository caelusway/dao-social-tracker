import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import TwitterFollowerService from '../services/twitter/twitterFollowerService';
import { AccountService } from '../services/dao/daoService';

// Load environment variables
dotenv.config();

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

if (!TWITTER_BEARER_TOKEN) {
  console.error('❌ TWITTER_BEARER_TOKEN environment variable is required');
  process.exit(1);
}

class FollowerCountSyncManager {
  private followerService: TwitterFollowerService;
  private accountService: AccountService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.followerService = new TwitterFollowerService(TWITTER_BEARER_TOKEN!);
    this.accountService = new AccountService();
  }

  /**
   * Run initial follower count sync for all accounts
   */
  async runInitialSync(): Promise<void> {
    console.log('🚀 Starting initial follower count sync...');
    
    try {
      const result = await this.followerService.updateAllFollowerCounts();
      
      console.log('\n📊 Initial Sync Results:');
      console.log(`✅ Successfully updated: ${result.success} accounts`);
      console.log(`❌ Errors: ${result.errors} accounts`);
      
      if (result.success > 0) {
        console.log('\n🎉 Initial follower count sync completed successfully!');
        
        // Show top accounts by followers
        const topAccounts = await this.followerService.getTopAccountsByFollowers(5);
        console.log('\n🏆 Top 5 Accounts by Followers:');
        topAccounts.forEach((account, index) => {
          console.log(`${index + 1}. ${account.name} (@${account.twitter_handle}): ${account.follower_count?.toLocaleString()} followers`);
        });
      }
    } catch (error: any) {
      console.error('❌ Error during initial sync:', error.message);
      throw error;
    }
  }

  /**
   * Run daily follower count sync (only for accounts that need updates)
   */
  async runDailySync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Daily sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting daily follower count sync...');
    
    try {
      const accountsNeedingUpdate = await this.followerService.getAccountsNeedingUpdate();
      
      if (accountsNeedingUpdate.length === 0) {
        console.log('✅ All accounts are up to date!');
        return;
      }

      console.log(`📊 Found ${accountsNeedingUpdate.length} accounts needing follower count updates`);
      
      let success = 0;
      let errors = 0;

      // Process accounts in small batches to respect rate limits
      const batchSize = 25;
      for (let i = 0; i < accountsNeedingUpdate.length; i += batchSize) {
        const batch = accountsNeedingUpdate.slice(i, i + batchSize);
        const usernames = batch.map(account => account.twitter_handle).filter(Boolean) as string[];
        
        if (usernames.length === 0) continue;

        try {
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(accountsNeedingUpdate.length / batchSize)}`);
          
          const usersInfo = await this.followerService.getMultipleUsersInfo(usernames);
          
          // Create a map for quick lookup
          const userInfoMap = new Map();
          usersInfo.forEach(user => {
            userInfoMap.set(user.username.toLowerCase(), user);
          });

          // Update each account in the batch
          for (const account of batch) {
            if (!account.twitter_handle) continue;
            
            const userInfo = userInfoMap.get(account.twitter_handle.toLowerCase());
            if (userInfo) {
              try {
                await this.followerService.updateAccountFollowerCount(account.id, userInfo.public_metrics.followers_count);
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

          // Add delay between batches
          if (i + batchSize < accountsNeedingUpdate.length) {
            console.log('⏳ Waiting 3 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (error) {
          console.error(`❌ Error processing batch starting at index ${i}:`, error);
          errors += batch.length;
        }
      }

      console.log('\n📊 Daily Sync Results:');
      console.log(`✅ Successfully updated: ${success} accounts`);
      console.log(`❌ Errors: ${errors} accounts`);
      
    } catch (error: any) {
      console.error('❌ Error during daily sync:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the daily sync scheduler
   */
  startDailyScheduler(): void {
    if (this.syncInterval) {
      console.log('⚠️ Daily scheduler already running');
      return;
    }

    // Run daily sync every 24 hours (86400000 ms)
    this.syncInterval = setInterval(() => {
      this.runDailySync().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('🕒 Daily follower count sync scheduler started (runs every 24 hours)');
  }

  /**
   * Stop the daily sync scheduler
   */
  stopDailyScheduler(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Daily scheduler stopped');
    }
  }

  /**
   * Get statistics about follower counts
   */
  async getFollowerStats(): Promise<void> {
    try {
      console.log('\n📊 Follower Count Statistics:');
      
      // Get all accounts with follower counts
      const allAccounts = await this.accountService.getAllAccounts();
      const accountsWithFollowers = allAccounts.filter(account => 
        account.twitter_handle && account.follower_count !== null && account.follower_count !== undefined
      );

      if (accountsWithFollowers.length === 0) {
        console.log('No accounts with follower data found. Run initial sync first.');
        return;
      }

      // Calculate stats
      const totalFollowers = accountsWithFollowers.reduce((sum, account) => sum + (account.follower_count || 0), 0);
      const avgFollowers = Math.round(totalFollowers / accountsWithFollowers.length);
      const maxFollowers = Math.max(...accountsWithFollowers.map(account => account.follower_count || 0));
      const minFollowers = Math.min(...accountsWithFollowers.map(account => account.follower_count || 0));

      console.log(`📈 Total accounts tracked: ${accountsWithFollowers.length}`);
      console.log(`👥 Total followers across all accounts: ${totalFollowers.toLocaleString()}`);
      console.log(`📊 Average followers per account: ${avgFollowers.toLocaleString()}`);
      console.log(`🏆 Highest follower count: ${maxFollowers.toLocaleString()}`);
      console.log(`📉 Lowest follower count: ${minFollowers.toLocaleString()}`);

      // Show top 10 accounts
      const topAccounts = await this.followerService.getTopAccountsByFollowers(10);
      console.log('\n🏆 Top 10 Accounts by Followers:');
      topAccounts.forEach((account, index) => {
        const lastUpdated = account.follower_count_updated_at 
          ? new Date(account.follower_count_updated_at).toLocaleDateString()
          : 'Never';
        console.log(`${index + 1}. ${account.name} (@${account.twitter_handle}): ${account.follower_count?.toLocaleString()} followers (Updated: ${lastUpdated})`);
      });

    } catch (error: any) {
      console.error('❌ Error getting follower stats:', error.message);
    }
  }
}

// Main function to handle different commands
async function main() {
  const command = process.argv[2];
  const syncManager = new FollowerCountSyncManager();

  switch (command) {
    case 'initial':
      console.log('🚀 Running initial follower count sync...');
      await syncManager.runInitialSync();
      break;

    case 'daily':
      console.log('🔄 Running daily follower count sync...');
      await syncManager.runDailySync();
      break;

    case 'stats':
      console.log('📊 Getting follower count statistics...');
      await syncManager.getFollowerStats();
      break;

    case 'scheduler':
      console.log('🕒 Starting daily scheduler...');
      syncManager.startDailyScheduler();
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping scheduler...');
        syncManager.stopDailyScheduler();
        process.exit(0);
      });
      
      console.log('Press Ctrl+C to stop the scheduler');
      break;

    default:
      console.log(`
🚀 Twitter Follower Count Sync Tool

Usage: npm run sync:followers <command>

Commands:
  initial   - Run initial sync for all accounts (use this first time)
  daily     - Run daily sync for accounts that need updates
  stats     - Show follower count statistics
  scheduler - Start daily scheduler (runs every 24 hours)

Examples:
  npm run sync:followers initial   # First time setup
  npm run sync:followers daily     # Manual daily sync
  npm run sync:followers stats     # Show statistics
  npm run sync:followers scheduler # Start automatic daily sync
      `);
      break;
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

export default FollowerCountSyncManager; 