import { EngagementSyncService } from '../services/twitter/engagementSyncService';
import { RateLimitManager } from '../services/twitter/rateLimitManager';
import { SyncLogger, LogLevel } from '../services/twitter/syncLogger';

// Example usage of the Twitter Engagement Sync System
async function main() {
  // Configuration - replace with your actual Twitter Bearer Token
  const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  
  if (!TWITTER_BEARER_TOKEN) {
    console.error('Please set TWITTER_BEARER_TOKEN environment variable');
    process.exit(1);
  }

  // Create engagement sync service with custom options
  const syncService = new EngagementSyncService(TWITTER_BEARER_TOKEN, {
    daysToLookBack: 5,      // Look back 5 days as requested
    syncIntervalHours: 2,   // Sync every 2 hours as requested
    maxRequestsPerBatch: 10 // Batch size to respect rate limits
  });

  console.log('🚀 Starting Twitter Engagement Sync Example');

  try {
    /*
    // Example 1: Run a single sync manually
    console.log('\n📊 Running single engagement sync...');
    const stats = await syncService.runEngagementSync();
    
    console.log('✅ Sync completed!');
    console.log(`📈 Stats: ${stats.totalTweetsProcessed} tweets processed, ${stats.tweetsUpdated} updated, ${stats.tweetsAdded} added`);
    console.log(`🔥 API Usage: ${stats.apiRequestsUsed} requests used`);
    console.log(`⏱️  Duration: ${stats.syncDuration}ms`);
    
    if (stats.errors.length > 0) {
      console.log(`❌ Errors: ${stats.errors.length}`);
      stats.errors.forEach(error => console.log(`   - ${error}`));
    }
      */

    // Example 2: Check sync status
    console.log('\n📋 Current sync status:');
    const status = syncService.getSyncStatus();
    console.log('Status:', status);

    //Example 3: Start automatic sync (uncomment to enable)
    console.log('\n🔄 Starting automatic sync every 2 hours...');
    syncService.startAutomaticSync();
    
    //Keep the process running if automatic sync is enabled
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping automatic sync...');
      syncService.stopAutomaticSync();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error in engagement sync:', error);
  }
}

// Example of how to monitor rate limits separately
async function monitorRateLimits() {
  const rateLimitManager = new RateLimitManager();
  
  console.log('\n📊 Rate Limit Status:');
  console.log(rateLimitManager.getUsageStats());
}

// Example of how to view sync logs
async function viewSyncLogs() {
  const logger = new SyncLogger('EngagementSync');
  
  console.log('\n📋 Recent sync logs:');
  const recentLogs = await logger.getRecentLogs(10);
  recentLogs.forEach(log => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const level = LogLevel[log.level];
    console.log(`[${timestamp}] [${level}] ${log.message}`);
  });

  console.log('\n📈 Aggregated stats (last 7 days):');
  const aggregatedStats = await logger.getAggregatedStats(7);
  if (aggregatedStats) {
    console.log(`Total syncs: ${aggregatedStats.syncCount}`);
    console.log(`Total tweets processed: ${aggregatedStats.totalTweetsProcessed}`);
    console.log(`Average sync time: ${Math.round(aggregatedStats.averageSyncTime)}ms`);
    console.log(`Total API requests: ${aggregatedStats.totalApiRequests}`);
    console.log(`Total errors: ${aggregatedStats.totalErrors}`);
  }
}

// Run examples
main()
  .then(() => monitorRateLimits())
  .then(() => viewSyncLogs())
  .catch(console.error); 