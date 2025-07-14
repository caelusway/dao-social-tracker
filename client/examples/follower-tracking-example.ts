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

async function demonstrateFollowerTracking() {
  console.log('🚀 Twitter Follower Tracking Example');
  console.log('=' .repeat(50));

  const followerService = new TwitterFollowerService(TWITTER_BEARER_TOKEN!);
  const accountService = new AccountService();

  try {
    // 1. Show current accounts with Twitter handles
    console.log('\n1. 📊 Current Accounts with Twitter Handles:');
    const accountsWithHandles = await followerService.getAccountsWithTwitterHandles();
    
    if (accountsWithHandles.length === 0) {
      console.log('   No accounts with Twitter handles found.');
      console.log('   Please add some accounts with twitter_handle field to test this feature.');
      return;
    }

    accountsWithHandles.forEach((account, index) => {
      const followerCount = account.follower_count 
        ? account.follower_count.toLocaleString() 
        : 'Not synced';
      const lastUpdated = account.follower_count_updated_at 
        ? new Date(account.follower_count_updated_at).toLocaleDateString()
        : 'Never';
      
      console.log(`   ${index + 1}. ${account.name} (@${account.twitter_handle})`);
      console.log(`      Followers: ${followerCount} | Last Updated: ${lastUpdated}`);
    });

    // 2. Demonstrate single user lookup
    console.log('\n2. 🔍 Single User Lookup Example:');
    const sampleAccount = accountsWithHandles[0];
    if (sampleAccount && sampleAccount.twitter_handle) {
      console.log(`   Looking up user info for @${sampleAccount.twitter_handle}...`);
      
      const userInfo = await followerService.getUserInfo(sampleAccount.twitter_handle);
      if (userInfo) {
        console.log(`   ✅ Found user: ${userInfo.name} (@${userInfo.username})`);
        console.log(`      Followers: ${userInfo.public_metrics.followers_count.toLocaleString()}`);
        console.log(`      Following: ${userInfo.public_metrics.following_count.toLocaleString()}`);
        console.log(`      Tweets: ${userInfo.public_metrics.tweet_count.toLocaleString()}`);
      } else {
        console.log(`   ❌ User not found or API error`);
      }
    }

    // 3. Demonstrate batch lookup
    console.log('\n3. 📦 Batch User Lookup Example:');
    const sampleUsernames = accountsWithHandles
      .slice(0, 5)
      .map(account => account.twitter_handle)
      .filter(Boolean) as string[];

    if (sampleUsernames.length > 0) {
      console.log(`   Looking up ${sampleUsernames.length} users: ${sampleUsernames.join(', ')}`);
      
      const usersInfo = await followerService.getMultipleUsersInfo(sampleUsernames);
      console.log(`   ✅ Found ${usersInfo.length} users:`);
      
      usersInfo.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (@${user.username}): ${user.public_metrics.followers_count.toLocaleString()} followers`);
      });
    }

    // 4. Show top accounts by followers (if any have been synced)
    console.log('\n4. 🏆 Top Accounts by Followers:');
    const topAccounts = await followerService.getTopAccountsByFollowers(5);
    
    if (topAccounts.length > 0) {
      topAccounts.forEach((account, index) => {
        const followerCount = account.follower_count?.toLocaleString() || '0';
        console.log(`   ${index + 1}. ${account.name} (@${account.twitter_handle}): ${followerCount} followers`);
      });
    } else {
      console.log('   No accounts with follower data found yet.');
      console.log('   Run "npm run sync:followers initial" to sync follower counts.');
    }

    // 5. Show accounts that need updates
    console.log('\n5. 🔄 Accounts Needing Updates (older than 24 hours):');
    const accountsNeedingUpdate = await followerService.getAccountsNeedingUpdate();
    
    if (accountsNeedingUpdate.length > 0) {
      console.log(`   Found ${accountsNeedingUpdate.length} accounts needing updates:`);
      accountsNeedingUpdate.forEach((account, index) => {
        const lastUpdated = account.follower_count_updated_at 
          ? new Date(account.follower_count_updated_at).toLocaleDateString()
          : 'Never';
        console.log(`   ${index + 1}. ${account.name} (@${account.twitter_handle}) - Last updated: ${lastUpdated}`);
      });
    } else {
      console.log('   All accounts are up to date!');
    }

    // 6. Show follower history for the first account (if available)
    console.log('\n6. 📈 Follower History Example:');
    const firstAccount = accountsWithHandles[0];
    if (firstAccount) {
      console.log(`   Getting follower history for ${firstAccount.name}...`);
      
      const history = await followerService.getFollowerHistory(firstAccount.id, 10);
      if (history.length > 0) {
        console.log(`   ✅ Found ${history.length} history records:`);
        history.forEach((record, index) => {
          const date = new Date(record.recorded_at).toLocaleDateString();
          const changeSymbol = record.change_amount > 0 ? '📈' : record.change_amount < 0 ? '📉' : '➖';
          console.log(`   ${index + 1}. ${date}: ${record.follower_count.toLocaleString()} followers ${changeSymbol} ${record.change_amount >= 0 ? '+' : ''}${record.change_amount}`);
        });
      } else {
        console.log('   No history records found yet.');
      }
    }

    // 7. Show follower trends
    console.log('\n7. 📊 Follower Trends Example:');
    if (firstAccount) {
      console.log(`   Getting follower trends for ${firstAccount.name} (last 30 days)...`);
      
      const trends = await followerService.getFollowerTrends(firstAccount.id, 30);
      if (trends.length > 0) {
        console.log(`   ✅ Found ${trends.length} trend records:`);
        trends.slice(0, 5).forEach((trend, index) => {
          const changeSymbol = trend.daily_change > 0 ? '📈' : trend.daily_change < 0 ? '📉' : '➖';
          console.log(`   ${index + 1}. ${trend.recorded_date}: ${trend.follower_count.toLocaleString()} followers ${changeSymbol} ${trend.daily_change >= 0 ? '+' : ''}${trend.daily_change}`);
        });
      } else {
        console.log('   No trend data found yet.');
      }
    }

    // 8. Show next steps
    console.log('\n8. 🚀 Next Steps:');
    console.log('   To start tracking follower counts, run these commands:');
    console.log('   1. npm run sync:followers initial   # First time setup');
    console.log('   2. npm run sync:followers daily     # Daily updates');
    console.log('   3. npm run sync:followers stats     # View statistics');
    console.log('   4. npm run sync:followers scheduler # Start automatic daily sync');

    console.log('\n✅ Follower tracking demonstration completed!');

  } catch (error: any) {
    console.error('❌ Error during follower tracking demonstration:', error.message);
    throw error;
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateFollowerTracking().catch(console.error);
}

export default demonstrateFollowerTracking; 