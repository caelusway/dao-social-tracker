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
   * Show comprehensive growth analytics for a specific account
   */
  async showAccountGrowthAnalytics(accountId?: string): Promise<void> {
    try {
      let targetAccount;
      
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

      console.log(`\n🔍 Growth Analytics for: ${targetAccount.name} (@${targetAccount.twitter_handle})`);
      console.log(`📊 Current Followers: ${targetAccount.follower_count?.toLocaleString() || 'N/A'}`);
      console.log('─'.repeat(80));

      // Get comprehensive analytics
      const analytics = await this.followerService.getComprehensiveGrowthAnalytics(targetAccount.id);

      // Display Growth Summary
      console.log('\n📈 GROWTH SUMMARY');
      console.log('─'.repeat(40));
      if (analytics.summary.length > 0) {
        analytics.summary.forEach(summary => {
          console.log(`${summary.period_type.toUpperCase()}: +${summary.recent_growth_count} followers (${summary.recent_growth_percentage}% growth)`);
          console.log(`  Average: +${Math.round(summary.average_growth_count)} followers per period (${summary.average_growth_percentage}% avg)`);
        });
      } else {
        console.log('⚠️ No growth data available. More historical data needed.');
      }

      // Display Weekly Growth
      console.log('\n📅 WEEKLY GROWTH (Last 8 Weeks)');
      console.log('─'.repeat(60));
      if (analytics.weekly.length > 0) {
        analytics.weekly.forEach((week, index) => {
          const growthEmoji = week.growth_count > 0 ? '📈' : week.growth_count < 0 ? '📉' : '➖';
          console.log(`${growthEmoji} Week ${index + 1} (${week.week_start_date} to ${week.week_end_date})`);
          console.log(`  ${week.start_followers.toLocaleString()} → ${week.end_followers.toLocaleString()} followers`);
          console.log(`  Change: ${week.growth_count > 0 ? '+' : ''}${week.growth_count} (${week.growth_percentage}%)`);
        });
      } else {
        console.log('⚠️ No weekly data available.');
      }

      // Display Monthly Growth
      console.log('\n🗓️ MONTHLY GROWTH (Last 12 Months)');
      console.log('─'.repeat(60));
      if (analytics.monthly.length > 0) {
        analytics.monthly.forEach((month, index) => {
          const growthEmoji = month.growth_count > 0 ? '📈' : month.growth_count < 0 ? '📉' : '➖';
          const monthName = new Date(month.month_start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          console.log(`${growthEmoji} ${monthName}`);
          console.log(`  ${month.start_followers.toLocaleString()} → ${month.end_followers.toLocaleString()} followers`);
          console.log(`  Change: ${month.growth_count > 0 ? '+' : ''}${month.growth_count} (${month.growth_percentage}%)`);
        });
      } else {
        console.log('⚠️ No monthly data available.');
      }

      // Display Yearly Growth
      console.log('\n📆 YEARLY GROWTH (Last 3 Years)');
      console.log('─'.repeat(60));
      if (analytics.yearly.length > 0) {
        analytics.yearly.forEach((year, index) => {
          const growthEmoji = year.growth_count > 0 ? '📈' : year.growth_count < 0 ? '📉' : '➖';
          const yearLabel = new Date(year.year_start_date).getFullYear();
          console.log(`${growthEmoji} ${yearLabel}`);
          console.log(`  ${year.start_followers.toLocaleString()} → ${year.end_followers.toLocaleString()} followers`);
          console.log(`  Change: ${year.growth_count > 0 ? '+' : ''}${year.growth_count} (${year.growth_percentage}%)`);
        });
      } else {
        console.log('⚠️ No yearly data available.');
      }

    } catch (error: any) {
      console.error('❌ Error showing account analytics:', error.message);
    }
  }

  /**
   * Show top growing accounts by different time periods
   */
  async showTopGrowingAccounts(): Promise<void> {
    try {
      console.log('\n🚀 TOP GROWING ACCOUNTS');
      console.log('═'.repeat(80));

      const periods: Array<'weekly' | 'monthly' | 'yearly'> = ['weekly', 'monthly', 'yearly'];
      
      for (const period of periods) {
        console.log(`\n🏆 TOP 5 GROWING ACCOUNTS (${period.toUpperCase()})`);
        console.log('─'.repeat(50));
        
        const topGrowing = await this.followerService.getTopGrowingAccounts(period, 5);
        
        if (topGrowing.length > 0) {
          topGrowing.forEach((account, index) => {
            const growthEmoji = account.total_growth > 0 ? '📈' : account.total_growth < 0 ? '📉' : '➖';
            console.log(`${index + 1}. ${growthEmoji} ${account.account_name} (@${account.twitter_handle})`);
            console.log(`   Current: ${account.current_followers.toLocaleString()} followers`);
            console.log(`   Growth: ${account.total_growth > 0 ? '+' : ''}${account.total_growth} (${account.average_growth_percentage}% avg)`);
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
   * Show overall growth statistics across all accounts
   */
  async showOverallGrowthStats(): Promise<void> {
    try {
      console.log('\n📊 OVERALL GROWTH STATISTICS');
      console.log('═'.repeat(60));

      const accounts = await this.accountService.getAllAccounts();
      const accountsWithTwitter = accounts.filter(acc => acc.twitter_handle);

      console.log(`📈 Total accounts with Twitter handles: ${accountsWithTwitter.length}`);

      // Get growth data for all accounts
      let totalWeeklyGrowth = 0;
      let totalMonthlyGrowth = 0;
      let totalYearlyGrowth = 0;
      let accountsWithData = 0;

      console.log('\n⏳ Calculating growth across all accounts...');

      for (const account of accountsWithTwitter.slice(0, 10)) { // Limit to first 10 for demo
        try {
          const summary = await this.followerService.getAccountGrowthSummary(account.id);
          if (summary.length > 0) {
            accountsWithData++;
            summary.forEach(s => {
              if (s.period_type === 'weekly') totalWeeklyGrowth += s.recent_growth_count;
              if (s.period_type === 'monthly') totalMonthlyGrowth += s.recent_growth_count;
              if (s.period_type === 'yearly') totalYearlyGrowth += s.recent_growth_count;
            });
          }
        } catch (error) {
          // Skip accounts with errors
        }
      }

      console.log('\n📈 AGGREGATE GROWTH (Sample of 10 accounts):');
      console.log('─'.repeat(50));
      console.log(`📅 Total Weekly Growth: ${totalWeeklyGrowth > 0 ? '+' : ''}${totalWeeklyGrowth} followers`);
      console.log(`🗓️ Total Monthly Growth: ${totalMonthlyGrowth > 0 ? '+' : ''}${totalMonthlyGrowth} followers`);
      console.log(`📆 Total Yearly Growth: ${totalYearlyGrowth > 0 ? '+' : ''}${totalYearlyGrowth} followers`);
      console.log(`📊 Accounts with growth data: ${accountsWithData}`);

    } catch (error: any) {
      console.error('❌ Error showing overall stats:', error.message);
    }
  }

  /**
   * Export growth data for a specific account to JSON
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
      
      const analytics = await this.followerService.getComprehensiveGrowthAnalytics(accountId);
      
      const exportData = {
        account: {
          id: account.id,
          name: account.name,
          twitter_handle: account.twitter_handle,
          current_followers: account.follower_count,
          export_date: new Date().toISOString()
        },
        growth_analytics: analytics
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
🚀 Follower Growth Analytics Tool

Usage: npm run growth:analytics <command> [options]

Commands:
  account [id]  - Show detailed growth analytics for an account
                  (if no ID provided, shows top account)
  top          - Show top growing accounts by period
  stats        - Show overall growth statistics
  export <id>  - Export growth data for an account to JSON

Examples:
  npm run growth:analytics account                    # Top account analytics
  npm run growth:analytics account uuid-here         # Specific account
  npm run growth:analytics top                       # Top growing accounts
  npm run growth:analytics stats                     # Overall statistics
  npm run growth:analytics export uuid-here          # Export account data

Note: Make sure you have run follower sync first:
  npm run sync:followers initial
      `);
      break;
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

export default FollowerGrowthAnalyticsManager;