#!/usr/bin/env ts-node

import { supabase } from '../services/supabase/client';
import { EngagementSyncService, RateLimitManager, SyncLogger } from '../services/twitter';

async function setupEngagementSync() {
  console.log('🚀 Setting up Twitter Engagement Sync System...');

  try {
    // Check if required tables exist
    console.log('📋 Checking database tables...');
    
    const tables = ['account_sync_logs', 'account_sync_stats', 'accounts'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`❌ Table ${table} not found or accessible:`, error.message);
        console.log('💡 Please run the migration: npx supabase migration up');
        return;
      }
      console.log(`✅ Table ${table} is accessible`);
    }

    // Test Twitter API connection
    console.log('🐦 Testing Twitter API connection...');
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    if (!bearerToken) {
      console.error('❌ TWITTER_BEARER_TOKEN environment variable not set');
      console.log('💡 Set it with: export TWITTER_BEARER_TOKEN="your_token_here"');
      return;
    }

    // Initialize services
    const syncService = new EngagementSyncService(bearerToken, {
      daysToLookBack: 5,
      syncIntervalHours: 2,
      maxRequestsPerBatch: 5  // Conservative for setup
    });

    const rateLimitManager = new RateLimitManager();
    const logger = new SyncLogger('SetupTest');

    // Test rate limit manager
    console.log('⏱️  Testing rate limit manager...');
    const rateLimitStatus = rateLimitManager.getStatus();
    console.log(`   Rate limit status: ${rateLimitStatus.canMakeRequest ? 'OK' : 'Limited'}`);
    console.log(`   Monthly usage: ${rateLimitStatus.requestsUsedThisMonth}/${rateLimitManager['config'].requestsPerMonth}`);

    // Test logging
    console.log('📝 Testing logging system...');
    logger.info('Setup test log entry');
    
    // Check for accounts with Twitter handles
    console.log('🏛️  Checking for accounts with Twitter handles...');
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, slug, twitter_handle')
      .not('twitter_handle', 'is', null);

    if (accountError) {
      console.error('❌ Error fetching accounts:', accountError.message);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.log('⚠️  No accounts with Twitter handles found');
      console.log('💡 Add Twitter handles to your accounts in the database first');
    } else {
      console.log(`✅ Found ${accounts.length} accounts with Twitter handles:`);
      accounts.forEach(account => {
        console.log(`   - ${account.name} (@${account.twitter_handle})`);
      });
    }

    // Test sync service status
    console.log('🔄 Testing sync service...');
    const syncStatus = syncService.getSyncStatus();
    console.log(`   Service status: ${syncStatus.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`   Auto sync: ${syncStatus.isAutomatic ? 'Enabled' : 'Disabled'}`);

    console.log('\n✅ Setup complete! System is ready to use.');
    console.log('\n📚 Next steps:');
    console.log('   1. Run a test sync: npm run ts-node client/examples/engagement-sync-example.ts');
    console.log('   2. Start automatic sync in your application');
    console.log('   3. Monitor logs in the sync_logs table');
    console.log('\n📖 See ENGAGEMENT_SYNC_README.md for detailed documentation');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function checkSystemHealth() {
  console.log('\n🏥 Running system health check...');

  try {
    const logger = new SyncLogger('HealthCheck');
    
    // Check recent sync stats
    const recentStats = await logger.getSyncStatsForDateRange(
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      new Date().toISOString()
    );

    if (recentStats.length > 0) {
      console.log(`📊 Found ${recentStats.length} sync cycles in the last 24 hours`);
      const latest = recentStats[0];
      console.log(`   Latest sync: ${new Date(latest.timestamp).toLocaleString()}`);
      console.log(`   Tweets processed: ${latest.total_tweets_processed}`);
      console.log(`   API requests: ${latest.api_requests_used}`);
      console.log(`   Errors: ${latest.error_count}`);
    } else {
      console.log('ℹ️  No sync cycles found in the last 24 hours');
    }

    // Check rate limit status
    const rateLimitManager = new RateLimitManager();
    const usage = rateLimitManager.getUsageStats();
    
    console.log('\n📊 Rate limit usage:');
    console.log(`   15-min window: ${usage.requestsUsage.per15Min} (${Math.round(usage.requestsUsage.percentage15Min)}%)`);
    console.log(`   Monthly: ${usage.requestsUsage.perMonth} (${Math.round(usage.requestsUsage.percentageMonth)}%)`);
    console.log(`   Posts this month: ${usage.postsUsage.perMonth} (${Math.round(usage.postsUsage.percentageMonth)}%)`);

    // Check for recent errors
    const recentLogs = await logger.getRecentLogs(10);
    const errors = recentLogs.filter(log => log.level === 3); // ERROR level
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Found ${errors.length} recent errors:`);
      errors.slice(0, 3).forEach(error => {
        console.log(`   - ${new Date(error.timestamp).toLocaleString()}: ${error.message}`);
      });
    } else {
      console.log('\n✅ No recent errors found');
    }

    console.log('\n🏥 Health check complete!');

  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      await setupEngagementSync();
      break;
    case 'health':
      await checkSystemHealth();
      break;
    default:
      console.log('🛠️  Twitter Engagement Sync Setup & Health Check');
      console.log('');
      console.log('Usage:');
      console.log('  npm run ts-node client/scripts/setup-engagement-sync.ts setup  - Initial setup');
      console.log('  npm run ts-node client/scripts/setup-engagement-sync.ts health - Health check');
      console.log('');
  }
}

main().catch(console.error); 