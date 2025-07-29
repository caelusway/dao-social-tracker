import dotenv from 'dotenv';
import TwitterFollowerService from '../services/twitter/twitterFollowerService';
import { AccountService } from '../services/dao/daoService';

// Load environment variables
dotenv.config();

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

if (!TWITTER_BEARER_TOKEN) {
  console.error('❌ TWITTER_BEARER_TOKEN environment variable is required');
  process.exit(1);
}

class GrowthDataPopulator {
  private followerService: TwitterFollowerService;
  private accountService: AccountService;

  constructor() {
    this.followerService = new TwitterFollowerService(TWITTER_BEARER_TOKEN!);
    this.accountService = new AccountService();
  }

  /**
   * Populate growth data for all existing accounts
   */
  async populateAllGrowthData(): Promise<void> {
    try {
      console.log('🚀 Starting growth data population for all accounts...');
      console.log('━'.repeat(60));

      // Get all accounts with Twitter handles
      const accounts = await this.followerService.getAccountsWithTwitterHandles();
      console.log(`📊 Found ${accounts.length} accounts with Twitter handles`);

      if (accounts.length === 0) {
        console.log('⚠️ No accounts with Twitter handles found.');
        console.log('💡 Make sure you have accounts in your database with twitter_handle field populated.');
        return;
      }

      // Update growth periods for all accounts
      console.log('\n🔄 Updating growth periods for all accounts...');
      let success = 0;
      let errors = 0;
      
      for (const account of accounts) {
        try {
          await this.followerService.updateAccountGrowthPeriods(account.id);
          success++;
        } catch (error) {
          console.error(`Failed to update growth for ${account.name}:`, error);
          errors++;
        }
      }
      
      const result = { updated: success, errors };

      console.log('\n📈 Growth Data Population Results:');
      console.log(`✅ Successfully calculated: ${result.updated} accounts`);
      console.log(`❌ Errors: ${result.errors} accounts`);

      if (result.updated > 0) {
        // Show some sample results
        await this.showSampleResults();
      }

    } catch (error: any) {
      console.error('❌ Error during growth data population:', error.message);
      throw error;
    }
  }

  /**
   * Show sample results of the populated growth data
   */
  async showSampleResults(): Promise<void> {
    try {
      console.log('\n📊 SAMPLE GROWTH DATA RESULTS');
      console.log('━'.repeat(60));

      // Get accounts with growth data
      const accountsWithGrowth = await this.followerService.getLatestGrowthMetrics();
      
      if (accountsWithGrowth.length === 0) {
        console.log('⚠️ No accounts found with growth data.');
        return;
      }

      // Group by account and show sample data
      console.log('\n🏆 SAMPLE ACCOUNTS WITH GROWTH DATA:');
      console.log('─'.repeat(50));
      
      const uniqueAccounts = accountsWithGrowth.reduce((acc: any[], account: any) => {
        if (!acc.find((a: any) => a.account_id === account.account_id)) {
          acc.push(account);
        }
        return acc;
      }, []);
      
      uniqueAccounts.slice(0, 5).forEach((account: any, index: number) => {
        console.log(`${index + 1}. ${account.name} (@${account.twitter_handle})`);
        console.log(`   Current: ${account.follower_count?.toLocaleString() || 'N/A'} followers`);
        console.log(`   Period: ${account.period_type} (${account.period_start} to ${account.period_end})`);
        console.log(`   Growth: ${account.growth_count > 0 ? '+' : ''}${account.growth_count} (${account.growth_percentage}%)`);
        console.log(`   Last Updated: ${account.calculated_at ? new Date(account.calculated_at).toLocaleString() : 'Never'}`);
        console.log('');
      });

      // Show top growing accounts by period
      console.log('\n📈 TOP GROWING ACCOUNTS BY PERIOD:');
      console.log('─'.repeat(50));
      
      const periods: Array<'weekly' | 'monthly' | 'yearly'> = ['weekly', 'monthly', 'yearly'];
      
      for (const period of periods) {
        const topGrowing = await this.followerService.getTopGrowingAccountsByPeriod(period, 3);
        
        if (topGrowing.length > 0) {
          console.log(`\n🚀 Top 3 ${period.toUpperCase()} Growth:`);
          topGrowing.forEach((account: any, index: number) => {
            const growth = account.growth_count;
            const growthPct = account.growth_percentage;
            const emoji = growth > 0 ? '📈' : growth < 0 ? '📉' : '➖';
            console.log(`  ${index + 1}. ${emoji} ${account.name}: ${growth > 0 ? '+' : ''}${growth} (${growthPct}%)`);
          });
        }
      }

      // Show growth trends
      console.log('\n📊 GROWTH TREND SUMMARY:');
      console.log('─'.repeat(40));
      
      const growingAccounts = accountsWithGrowth.filter((a: any) => a.growth_count > 0).length;
      const decliningAccounts = accountsWithGrowth.filter((a: any) => a.growth_count < 0).length;
      const stableAccounts = accountsWithGrowth.filter((a: any) => a.growth_count === 0).length;
      
      console.log(`📈 Growing: ${growingAccounts} records`);
      console.log(`📉 Declining: ${decliningAccounts} records`);
      console.log(`➖ Stable: ${stableAccounts} records`);
      console.log(`📊 Total growth records: ${accountsWithGrowth.length}`);

    } catch (error: any) {
      console.error('❌ Error showing sample results:', error.message);
    }
  }

  /**
   * Recalculate growth data for a specific account
   */
  async recalculateAccount(accountId: string): Promise<void> {
    try {
      const accounts = await this.accountService.getAllAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.error(`❌ Account with ID ${accountId} not found`);
        return;
      }

      console.log(`🔄 Recalculating growth data for: ${account.name} (@${account.twitter_handle})`);
      
      await this.followerService.updateAccountGrowthPeriods(accountId);
      
      // Show updated data
      const updatedAccounts = await this.followerService.getAccountGrowthMetrics(accountId);
      const updatedAccount = updatedAccounts[0];
      
      if (updatedAccount) {
        console.log('\n📈 Updated Growth Data:');
        console.log(`Period: ${updatedAccount.period_type} (${updatedAccount.period_start} to ${updatedAccount.period_end})`);
        console.log(`Growth: ${updatedAccount.growth_count > 0 ? '+' : ''}${updatedAccount.growth_count} (${updatedAccount.growth_percentage}%)`);
        console.log(`Last Updated: ${new Date(updatedAccount.calculated_at).toLocaleString()}`);
      }
      
      console.log('✅ Growth data recalculated successfully!');

    } catch (error: any) {
      console.error(`❌ Error recalculating account ${accountId}:`, error.message);
    }
  }

  /**
   * Show current status of growth data across all accounts
   */
  async showGrowthDataStatus(): Promise<void> {
    try {
      console.log('\n📊 GROWTH DATA STATUS');
      console.log('━'.repeat(40));

      const allAccounts = await this.accountService.getAllAccounts();
      const accountsWithTwitter = allAccounts.filter(acc => acc.twitter_handle);
      const accountsWithGrowth = await this.followerService.getLatestGrowthMetrics();

      console.log(`📈 Total accounts: ${allAccounts.length}`);
      console.log(`🐦 Accounts with Twitter handles: ${accountsWithTwitter.length}`);
      console.log(`📊 Accounts with growth data: ${accountsWithGrowth.length}`);
      console.log(`⚠️ Missing growth data: ${accountsWithTwitter.length - accountsWithGrowth.length}`);

      // Show unique accounts with growth data
      const uniqueAccountIds = [...new Set(accountsWithGrowth.map((a: any) => a.account_id))];
      console.log(`📊 Unique accounts with growth data: ${uniqueAccountIds.length}`);
      console.log(`⚠️ Missing growth data: ${accountsWithTwitter.length - uniqueAccountIds.length}`);

      // Show accounts that need growth data calculation
      const needsCalculation = accountsWithTwitter.filter(account => 
        !uniqueAccountIds.includes(account.id)
      );

      if (needsCalculation.length > 0) {
        console.log('\n⚠️ ACCOUNTS MISSING GROWTH DATA:');
        needsCalculation.slice(0, 5).forEach((account: any, index: number) => {
          console.log(`${index + 1}. ${account.name} (@${account.twitter_handle})`);
        });
        if (needsCalculation.length > 5) {
          console.log(`... and ${needsCalculation.length - 5} more`);
        }
        console.log('\n💡 Run "npm run populate:growth all" to calculate growth data for all accounts');
      }

      // Show data freshness
      if (accountsWithGrowth.length > 0) {
        const now = new Date();
        const recentUpdates = accountsWithGrowth.filter((account: any) => {
          if (!account.calculated_at) return false;
          const updateTime = new Date(account.calculated_at);
          const hoursDiff = (now.getTime() - updateTime.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24;
        });

        console.log(`\n⏰ Updated in last 24 hours: ${recentUpdates.length}/${accountsWithGrowth.length} records`);
      }

    } catch (error: any) {
      console.error('❌ Error showing growth data status:', error.message);
    }
  }
}

// Main function to handle different commands
async function main() {
  const command = process.argv[2];
  const accountId = process.argv[3];
  const populator = new GrowthDataPopulator();

  switch (command) {
    case 'all':
      console.log('🚀 Populating growth data for all accounts...');
      await populator.populateAllGrowthData();
      break;

    case 'account':
      if (!accountId) {
        console.error('❌ Account ID required for account command');
        console.log('Usage: npm run populate:growth account <account_id>');
        return;
      }
      console.log('🔄 Recalculating growth data for specific account...');
      await populator.recalculateAccount(accountId);
      break;

    case 'status':
      console.log('📊 Checking growth data status...');
      await populator.showGrowthDataStatus();
      break;

    case 'sample':
      console.log('📊 Showing sample growth data...');
      await populator.showSampleResults();
      break;

    default:
      console.log(`
🚀 Growth Data Population Tool

Usage: npm run populate:growth <command> [options]

Commands:
  all              - Calculate growth data for all accounts
  account <id>     - Recalculate growth data for specific account
  status           - Show current growth data status
  sample           - Show sample of existing growth data

Examples:
  npm run populate:growth all                    # Calculate for all accounts
  npm run populate:growth account uuid-here     # Specific account
  npm run populate:growth status                # Check status
  npm run populate:growth sample                # Show samples

Prerequisites:
  1. Run database migration: supabase db push
  2. Have follower data: npm run sync:followers initial
  3. Then populate growth: npm run populate:growth all

This tool adds growth metrics directly to the accounts table for easier querying.
      `);
      break;
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

export default GrowthDataPopulator;