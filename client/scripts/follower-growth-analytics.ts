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

class FollowerGrowthAnalyticsManager {
  private followerService: TwitterFollowerService;
  private accountService: AccountService;

  constructor() {
    this.followerService = new TwitterFollowerService(TWITTER_BEARER_TOKEN!);
    this.accountService = new AccountService();
  }

  /**
   * Show comprehensive growth analytics for a specific account (NEW SYSTEM)
   */
  async showAccountGrowthAnalytics(accountId?: string): Promise<void> {
    try {
      let targetAccount: any;
      
      if (accountId) {
        const accounts = await this.accountService.getAllAccounts();
        targetAccount = accounts.find(acc => acc.id === accountId);
        if (!targetAccount) {
          console.error(`❌ Account with ID ${accountId} not found`);
          return;
        }
      } else {
        // Get the account with the most followers for demonstration
        const topAccounts = await this.followerService.getTopAccountsByFollowers(1);
        if (topAccounts.length === 0) {
          console.error('❌ No accounts found. Run initial follower sync first.');
          return;
        }
        targetAccount = topAccounts[0];
      }

      if (!targetAccount) {
        console.error('❌ No target account available');
        return;
      }

      console.log(`\n🔍 Growth Analytics for: ${targetAccount.name} (@${targetAccount.twitter_handle})`);
      console.log(`📊 Current Followers: ${targetAccount.follower_count?.toLocaleString() || 'N/A'}`);
      console.log('─'.repeat(80));

      // Get daily snapshots and growth data
      const [dailySnapshots, weeklyGrowth, monthlyGrowth, yearlyGrowth] = await Promise.all([
        this.followerService.getAccountDailySnapshots(targetAccount.id, 30),
        this.followerService.getAccountGrowthOverDays(targetAccount.id, 7),
        this.followerService.getAccountGrowthOverDays(targetAccount.id, 30),
        this.followerService.getAccountGrowthOverDays(targetAccount.id, 365)
      ]);

      // Display Growth Summary
      console.log('\n📈 GROWTH SUMMARY');
      console.log('─'.repeat(40));
      
      if (weeklyGrowth) {
        const growthEmoji = weeklyGrowth.total_change > 0 ? '📈' : weeklyGrowth.total_change < 0 ? '📉' : '➖';
        console.log(`${growthEmoji} Last 7 days: ${weeklyGrowth.total_change > 0 ? '+' : ''}${weeklyGrowth.total_change} (${weeklyGrowth.percentage_change}%)`);
      }
      
      if (monthlyGrowth) {
        const growthEmoji = monthlyGrowth.total_change > 0 ? '📈' : monthlyGrowth.total_change < 0 ? '📉' : '➖';
        console.log(`${growthEmoji} Last 30 days: ${monthlyGrowth.total_change > 0 ? '+' : ''}${monthlyGrowth.total_change} (${monthlyGrowth.percentage_change}%)`);
      }
      
      if (yearlyGrowth) {
        const growthEmoji = yearlyGrowth.total_change > 0 ? '📈' : yearlyGrowth.total_change < 0 ? '📉' : '➖';
        console.log(`${growthEmoji} Last 365 days: ${yearlyGrowth.total_change > 0 ? '+' : ''}${yearlyGrowth.total_change} (${yearlyGrowth.percentage_change}%)`);
      }

      // Display Recent Daily Activity
      console.log('\n📅 DAILY ACTIVITY (Last 14 days)');
      console.log('─'.repeat(60));
      if (dailySnapshots.length > 0) {
        dailySnapshots.slice(0, 14).forEach((day: any) => {
          const date = new Date(day.date).toLocaleDateString();
          const changeEmoji = day.change_from_previous > 0 ? '📈' : day.change_from_previous < 0 ? '📉' : '➖';
          console.log(`${changeEmoji} ${date}: ${day.follower_count.toLocaleString()} followers (${day.change_from_previous > 0 ? '+' : ''}${day.change_from_previous})`);
        });
      } else {
        console.log('⚠️ No daily data available. Run follower sync to start collecting data.');
      }

      // Display Average Daily Change
      if (dailySnapshots.length > 1) {
        const avgChange = dailySnapshots.reduce((sum: number, day: any) => sum + (day.change_from_previous || 0), 0) / dailySnapshots.length;
        console.log(`\n📊 Average daily change: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)} followers`);
      }

    } catch (error: any) {
      console.error('❌ Error showing account analytics:', error.message);
    }
  }

  /**
   * Show top growing accounts by different time periods (NEW SYSTEM)
   */
  async showTopGrowingAccounts(): Promise<void> {
    try {
      console.log('\n🚀 TOP GROWING ACCOUNTS');
      console.log('═'.repeat(80));

      const periods = [
        { name: 'DAILY', days: 1 },
        { name: 'WEEKLY', days: 7 },
        { name: 'MONTHLY', days: 30 }
      ];
      
      for (const period of periods) {
        console.log(`\n🏆 TOP 5 GROWING ACCOUNTS (${period.name})`);
        console.log('─'.repeat(50));
        
        const topGrowing = await this.followerService.getTopGrowingAccountsOverDays(period.days, 5);
        
        if (topGrowing.length > 0) {
          topGrowing.forEach((account: any, index: number) => {
            const growthEmoji = account.growth_amount > 0 ? '📈' : account.growth_amount < 0 ? '📉' : '➖';
            console.log(`${index + 1}. ${growthEmoji} ${account.account_name} (@${account.twitter_handle})`);
            console.log(`   Current: ${account.current_followers.toLocaleString()} followers`);
            console.log(`   Growth: ${account.growth_amount > 0 ? '+' : ''}${account.growth_amount} (${account.growth_percentage}%)`);
          });
        } else {
          console.log('⚠️ No growth data available for this period.');
        }
      }

    } catch (error: any) {
      console.error('❌ Error showing top growing accounts:', error.message);
    }
  }

  /**
   * Show overall growth statistics across all accounts (NEW SYSTEM)
   */
  async showOverallGrowthStats(): Promise<void> {
    try {
      console.log('\n📊 OVERALL GROWTH STATISTICS');
      console.log('═'.repeat(60));

      const latestSnapshots = await this.followerService.getLatestFollowerSnapshots();
      const accountsWithTwitter = latestSnapshots.filter(acc => acc.twitter_handle);

      console.log(`📈 Total accounts with Twitter handles: ${accountsWithTwitter.length}`);

      if (accountsWithTwitter.length === 0) {
        console.log('⚠️ No accounts with snapshots yet. Run follower sync first.');
        return;
      }

      // Calculate aggregate statistics
      const totalFollowers = accountsWithTwitter.reduce((sum, acc) => sum + (acc.current_followers || 0), 0);
      const totalDailyChange = accountsWithTwitter.reduce((sum, acc) => sum + (acc.daily_change || 0), 0);
      const avgFollowersPerAccount = totalFollowers / accountsWithTwitter.length;
      const accountsWithGrowth = accountsWithTwitter.filter(acc => (acc.daily_change || 0) > 0).length;
      const accountsWithDecline = accountsWithTwitter.filter(acc => (acc.daily_change || 0) < 0).length;

      console.log('\n📊 CURRENT STATISTICS:');
      console.log('─'.repeat(50));
      console.log(`👥 Total followers across all accounts: ${totalFollowers.toLocaleString()}`);
      console.log(`📊 Average followers per account: ${Math.round(avgFollowersPerAccount).toLocaleString()}`);
      console.log(`📈 Accounts growing today: ${accountsWithGrowth}`);
      console.log(`📉 Accounts declining today: ${accountsWithDecline}`);
      console.log(`📅 Total daily change: ${totalDailyChange > 0 ? '+' : ''}${totalDailyChange} followers`);

      // Show top accounts by current followers
      console.log('\n🏆 TOP 5 ACCOUNTS BY FOLLOWERS:');
      console.log('─'.repeat(50));
      const topByFollowers = accountsWithTwitter
        .sort((a, b) => (b.current_followers || 0) - (a.current_followers || 0))
        .slice(0, 5);

      topByFollowers.forEach((account, index) => {
        const changeEmoji = (account.daily_change || 0) > 0 ? '📈' : (account.daily_change || 0) < 0 ? '📉' : '➖';
        console.log(`${index + 1}. ${account.name} (@${account.twitter_handle})`);
        console.log(`   ${(account.current_followers || 0).toLocaleString()} followers ${changeEmoji} (${account.daily_change > 0 ? '+' : ''}${account.daily_change || 0} today)`);
      });

      // Show top accounts by daily growth
      console.log('\n🚀 TOP 5 ACCOUNTS BY TODAY\'S GROWTH:');
      console.log('─'.repeat(50));
      const topByGrowth = accountsWithTwitter
        .filter(acc => (acc.daily_change || 0) !== 0)
        .sort((a, b) => (b.daily_change || 0) - (a.daily_change || 0))
        .slice(0, 5);

      if (topByGrowth.length > 0) {
        topByGrowth.forEach((account, index) => {
          const changeEmoji = (account.daily_change || 0) > 0 ? '📈' : '📉';
          console.log(`${index + 1}. ${changeEmoji} ${account.name} (@${account.twitter_handle})`);
          console.log(`   ${account.daily_change > 0 ? '+' : ''}${account.daily_change} followers (${account.daily_change_percentage}%)`);
        });
      } else {
        console.log('⚠️ No growth data available for today. Data will be available after the second sync.');
      }

    } catch (error: any) {
      console.error('❌ Error showing overall stats:', error.message);
    }
  }

  /**
   * Export growth data for a specific account to JSON (NEW SYSTEM)
   */
  async exportAccountGrowthData(accountId: string): Promise<void> {
    try {
      const accounts = await this.accountService.getAllAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.error(`❌ Account with ID ${accountId} not found`);
        return;
      }

      console.log(`\n📤 Exporting growth data for: ${account.name}`);
      
      const [dailySnapshots, weeklyGrowth, monthlyGrowth, yearlyGrowth] = await Promise.all([
        this.followerService.getAccountDailySnapshots(accountId, 365), // Full year of daily data
        this.followerService.getAccountGrowthOverDays(accountId, 7),
        this.followerService.getAccountGrowthOverDays(accountId, 30),
        this.followerService.getAccountGrowthOverDays(accountId, 365)
      ]);
      
      const exportData = {
        account: {
          id: account.id,
          name: account.name,
          twitter_handle: account.twitter_handle,
          current_followers: account.follower_count,
          export_date: new Date().toISOString()
        },
        growth_data: {
          daily_snapshots: dailySnapshots,
          period_growth: {
            weekly: weeklyGrowth,
            monthly: monthlyGrowth,
            yearly: yearlyGrowth
          }
        },
        summary: {
          total_snapshots: dailySnapshots.length,
          date_range: {
            start: dailySnapshots.length > 0 ? dailySnapshots[dailySnapshots.length - 1].date : null,
            end: dailySnapshots.length > 0 ? dailySnapshots[0].date : null
          }
        }
      };

      const fileName = `growth_data_${account.twitter_handle}_${new Date().toISOString().split('T')[0]}.json`;
      
      // In a real implementation, you'd write this to a file
      console.log('\n📄 Export Data:');
      console.log(JSON.stringify(exportData, null, 2));
      console.log(`\n✅ Growth data ready for export as: ${fileName}`);

    } catch (error: any) {
      console.error('❌ Error exporting data:', error.message);
    }
  }
}

// Main function to handle different commands
async function main() {
  const command = process.argv[2];
  const accountId = process.argv[3];
  const analyticsManager = new FollowerGrowthAnalyticsManager();

  switch (command) {
    case 'account':
      console.log('🔍 Showing account growth analytics...');
      await analyticsManager.showAccountGrowthAnalytics(accountId);
      break;

    case 'top':
      console.log('🏆 Showing top growing accounts...');
      await analyticsManager.showTopGrowingAccounts();
      break;

    case 'stats':
      console.log('📊 Showing overall growth statistics...');
      await analyticsManager.showOverallGrowthStats();
      break;

    case 'export':
      if (!accountId) {
        console.error('❌ Account ID required for export command');
        console.log('Usage: npm run growth:analytics export <account_id>');
        return;
      }
      console.log('📤 Exporting account growth data...');
      await analyticsManager.exportAccountGrowthData(accountId);
      break;

    default:
      console.log(`
🚀 Follower Growth Analytics Tool (NEW SYSTEM)

This system tracks daily follower snapshots starting from today.
Growth is calculated dynamically over flexible time periods.

Usage: npm run growth:analytics <command> [options]

Commands:
  account [id]  - Show detailed growth analytics for an account
                  (if no ID provided, shows top account)
  top          - Show top growing accounts by period (daily/weekly/monthly)
  stats        - Show overall growth statistics across all accounts
  export <id>  - Export growth data for an account to JSON

Examples:
  npm run growth:analytics account                    # Top account analytics
  npm run growth:analytics account uuid-here         # Specific account
  npm run growth:analytics top                       # Top growing accounts
  npm run growth:analytics stats                     # Overall statistics
  npm run growth:analytics export uuid-here          # Export account data

Important Notes:
- Growth tracking starts from today (first sync establishes baseline)
- Daily growth data available after second sync (needs comparison point)
- Weekly/monthly trends become more accurate over time
- System automatically tracks growth with each follower sync

To start collecting data:
  1. Run: npm run sync:followers (to get current follower counts)
  2. Wait 24 hours and run again (to see first growth data)
  3. Analytics will show growth trends over time
      `);
      break;
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

export default FollowerGrowthAnalyticsManager;