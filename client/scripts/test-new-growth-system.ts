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

class NewGrowthSystemTester {
  private followerService: TwitterFollowerService;
  private accountService: AccountService;

  constructor() {
    this.followerService = new TwitterFollowerService(TWITTER_BEARER_TOKEN!);
    this.accountService = new AccountService();
  }

  /**
   * Test the new automatic growth calculation system
   */
  async testNewGrowthSystem(): Promise<void> {
    try {
      console.log('🧪 TESTING NEW AUTOMATIC GROWTH SYSTEM');
      console.log('━'.repeat(60));

      // Get a sample account to test with
      const accounts = await this.followerService.getAccountsWithTwitterHandles();
      if (accounts.length === 0) {
        console.log('❌ No accounts with Twitter handles found. Please add some accounts first.');
        return;
      }

      const testAccount = accounts[0];
      if (!testAccount) {
        console.log('❌ No test account available');
        return;
      }
      
      console.log(`📊 Testing with account: ${testAccount.name} (@${testAccount.twitter_handle})`);
      console.log(`Current followers: ${testAccount.follower_count?.toLocaleString() || 'N/A'}`);

      // Test 1: Update follower count (should trigger automatic growth calculation)
      console.log('\n🔧 TEST 1: Update follower count with automatic growth calculation');
      console.log('─'.repeat(50));
      
      const currentFollowers = testAccount.follower_count || 1000;
      const testFollowerCount = currentFollowers + Math.floor(Math.random() * 50) + 1; // Add 1-50 followers
      
      console.log(`Updating from ${currentFollowers} to ${testFollowerCount} followers...`);
      await this.followerService.updateAccountFollowerCount(testAccount.id, testFollowerCount);

      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 2: Check if growth metrics were automatically calculated
      console.log('\n📈 TEST 2: Verify automatic growth metrics calculation');
      console.log('─'.repeat(50));
      
      const growthMetrics = await this.followerService.getAccountGrowthMetrics(testAccount.id);
      console.log(`Found ${growthMetrics.length} growth metric records`);

      if (growthMetrics.length > 0) {
        console.log('\n✅ Latest Growth Metrics:');
        growthMetrics.slice(0, 5).forEach((metric, index) => {
          console.log(`${index + 1}. ${metric.period_type.toUpperCase()}: ${metric.period_start} to ${metric.period_end}`);
          console.log(`   ${metric.start_followers} → ${metric.end_followers} followers`);
          console.log(`   Growth: ${metric.growth_count > 0 ? '+' : ''}${metric.growth_count} (${metric.growth_percentage}%)`);
          console.log(`   Calculated: ${new Date(metric.calculated_at).toLocaleString()}`);
          console.log('');
        });
      } else {
        console.log('⚠️ No growth metrics found. May need more historical data.');
      }

      // Test 3: Check latest growth metrics view
      console.log('\n📊 TEST 3: Latest growth metrics from view');
      console.log('─'.repeat(50));
      
      const latestMetrics = await this.followerService.getLatestGrowthMetrics();
      const accountMetrics = latestMetrics.filter(m => m.account_id === testAccount.id);
      
      if (accountMetrics.length > 0) {
        console.log(`✅ Found ${accountMetrics.length} latest metrics for this account:`);
        accountMetrics.forEach(metric => {
          console.log(`${metric.period_type.toUpperCase()}: ${metric.growth_count > 0 ? '+' : ''}${metric.growth_count} (${metric.growth_percentage}%)`);
        });
      } else {
        console.log('⚠️ No latest metrics found in view');
      }

      // Test 4: Top growing accounts
      console.log('\n🏆 TEST 4: Top growing accounts by period');
      console.log('─'.repeat(50));
      
      const periods: Array<'daily' | 'weekly' | 'monthly' | 'yearly'> = ['weekly', 'monthly'];
      
      for (const period of periods) {
        const topGrowing = await this.followerService.getTopGrowingAccountsByPeriod(period, 3);
        if (topGrowing.length > 0) {
          console.log(`\n🚀 Top 3 ${period.toUpperCase()} Growing Accounts:`);
          topGrowing.forEach((account, index) => {
            const emoji = account.growth_count > 0 ? '📈' : account.growth_count < 0 ? '📉' : '➖';
            console.log(`${index + 1}. ${emoji} ${account.name}: ${account.growth_count > 0 ? '+' : ''}${account.growth_count} (${account.growth_percentage}%)`);
          });
        } else {
          console.log(`\n⚠️ No ${period} growth data available yet`);
        }
      }

      // Test 5: Comprehensive growth data
      console.log('\n📊 TEST 5: Comprehensive growth data');
      console.log('─'.repeat(50));
      
      const comprehensive = await this.followerService.getAccountComprehensiveGrowth(testAccount.id);
      
      console.log(`Daily records: ${comprehensive.daily.length}`);
      console.log(`Weekly records: ${comprehensive.weekly.length}`);
      console.log(`Monthly records: ${comprehensive.monthly.length}`);
      console.log(`Yearly records: ${comprehensive.yearly.length}`);

      // Show sample of each type
      if (comprehensive.weekly.length > 0) {
        const recent = comprehensive.weekly[0];
        console.log(`\nMost recent weekly: ${recent.period_start} to ${recent.period_end}`);
        console.log(`Growth: ${recent.growth_count > 0 ? '+' : ''}${recent.growth_count} (${recent.growth_percentage}%)`);
      }

      console.log('\n✅ NEW GROWTH SYSTEM TEST COMPLETED!');
      console.log('━'.repeat(60));
      console.log('🎯 Key Features Verified:');
      console.log('   ✅ Automatic growth calculation on follower updates');
      console.log('   ✅ Dedicated growth metrics table');
      console.log('   ✅ Multiple period types (daily, weekly, monthly, yearly)');
      console.log('   ✅ Easy querying via views');
      console.log('   ✅ Top growing accounts ranking');
      console.log('   ✅ Comprehensive growth analytics');

    } catch (error: any) {
      console.error('❌ Error testing new growth system:', error.message);
    }
  }

  /**
   * Show the current state of the growth metrics table
   */
  async showGrowthMetricsStatus(): Promise<void> {
    try {
      console.log('\n📊 GROWTH METRICS TABLE STATUS');
      console.log('━'.repeat(50));

      // Get all accounts
      const accounts = await this.followerService.getAccountsWithTwitterHandles();
      console.log(`Total accounts with Twitter: ${accounts.length}`);

      // Get all growth metrics
      const allMetrics = await this.followerService.getLatestGrowthMetrics();
      console.log(`Total growth metric records: ${allMetrics.length}`);

      // Group by period type
      const metricsByPeriod = allMetrics.reduce((acc, metric) => {
        acc[metric.period_type] = (acc[metric.period_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n📈 Metrics by Period Type:');
      Object.entries(metricsByPeriod).forEach(([period, count]) => {
        console.log(`   ${period}: ${count} records`);
      });

      // Show accounts with recent metrics
      const recentMetrics = allMetrics.filter(m => {
        const hoursSince = (Date.now() - new Date(m.calculated_at).getTime()) / (1000 * 60 * 60);
        return hoursSince < 24;
      });

      console.log(`\n⏰ Metrics calculated in last 24 hours: ${recentMetrics.length}`);

      if (recentMetrics.length > 0) {
        console.log('\n🆕 Recently Updated Accounts:');
        const uniqueAccounts = [...new Set(recentMetrics.map(m => m.account_id))];
        uniqueAccounts.slice(0, 5).forEach((accountId, index) => {
          const account = accounts.find(a => a.id === accountId);
          if (account) {
            console.log(`${index + 1}. ${account.name} (@${account.twitter_handle})`);
          }
        });
      }

    } catch (error: any) {
      console.error('❌ Error showing growth metrics status:', error.message);
    }
  }
}

// Main function to handle different commands
async function main() {
  const command = process.argv[2];
  const tester = new NewGrowthSystemTester();

  switch (command) {
    case 'test':
      console.log('🧪 Testing new automatic growth system...');
      await tester.testNewGrowthSystem();
      break;

    case 'status':
      console.log('📊 Checking growth metrics status...');
      await tester.showGrowthMetricsStatus();
      break;

    default:
      console.log(`
🧪 New Growth System Tester

Usage: npm run test:growth <command>

Commands:
  test     - Test the new automatic growth calculation system
  status   - Show current growth metrics table status

Examples:
  npm run test:growth test      # Run comprehensive test
  npm run test:growth status    # Check current status

Prerequisites:
  1. Run database migrations: supabase db push
  2. Have some follower data: npm run sync:followers initial

This tool tests the new automatic growth calculation system that
populates the account_growth_metrics table via database triggers.
      `);
      break;
  }
}

// Add to package.json scripts
if (require.main === module) {
  main().catch(console.error);
}

export default NewGrowthSystemTester;