# Twitter Engagement Sync System 📊

A comprehensive, modular system for syncing Twitter engagement metrics (likes, retweets, replies, etc.) with automatic rate limiting and detailed logging.

## 🚀 Features

- **Automatic Engagement Sync**: Runs every 2 hours to keep engagement data up-to-date
- **Smart Rate Limiting**: Respects Twitter API limits (15 requests/15min, 50k/month, 15k posts/month)
- **Comprehensive Logging**: Detailed logs and statistics stored in Supabase
- **Modular Architecture**: Easy to extend and customize
- **Error Handling**: Robust error handling with detailed error tracking
- **Batch Processing**: Process tweets in batches to optimize API usage

## 📋 System Requirements

- Node.js 18+
- Supabase database
- Twitter API v2 Bearer Token
- TypeScript

## 🛠️ Installation

1. **Database Setup**: Run the migration to create required tables:
   ```bash
   npx supabase migration up
   ```

2. **Environment Variables**: Set your Twitter Bearer Token:
   ```bash
   export TWITTER_BEARER_TOKEN="your_bearer_token_here"
   ```

## 📊 Rate Limits

The system is configured to respect your Twitter API package limits:

- **15 requests per 15 minutes per user**
- **50,000 requests per month per user**
- **15,000 posts per month**

The `RateLimitManager` automatically tracks and enforces these limits.

## 🔧 Core Components

### 1. EngagementSyncService

Main service that orchestrates the entire sync process.

```typescript
import { EngagementSyncService } from './services/twitter';

const syncService = new EngagementSyncService(bearerToken, {
  daysToLookBack: 5,      // Sync last 5 days of tweets
  syncIntervalHours: 2,   // Run every 2 hours
  maxRequestsPerBatch: 10 // Batch size for API requests
});

// Run single sync
const stats = await syncService.runEngagementSync();

// Start automatic sync
syncService.startAutomaticSync();
```

### 2. RateLimitManager

Manages Twitter API rate limits with automatic tracking and waiting.

```typescript
import { RateLimitManager } from './services/twitter';

const rateLimitManager = new RateLimitManager();

// Check if we can make a request
if (rateLimitManager.canMakeRequest()) {
  // Make API call
  rateLimitManager.incrementRequestCount();
}

// Get usage statistics
const stats = rateLimitManager.getUsageStats();
console.log(`API Usage: ${stats.requestsUsage.perMonth}`);
```

### 3. SyncLogger

Comprehensive logging system with multiple log levels.

```typescript
import { SyncLogger, LogLevel } from './services/twitter';

const logger = new SyncLogger('EngagementSync');

logger.info('Starting sync process');
logger.error('API request failed', error);

// View aggregated statistics
const stats = await logger.getAggregatedStats(7);
```

## 🔄 How It Works

1. **Fetch DAOs**: Gets all DAOs with Twitter handles from Supabase
2. **Get Recent Tweets**: Retrieves tweets from the last 5 days for each DAO
3. **Batch Processing**: Groups tweet IDs into batches to respect rate limits
4. **API Calls**: Fetches fresh engagement data from Twitter API
5. **Update Database**: Updates or inserts engagement metrics in Supabase
6. **Logging**: Records detailed statistics and any errors

## 📈 Monitoring & Statistics

### Sync Statistics

Every sync cycle generates detailed statistics:

```typescript
interface SyncStats {
  totalTweetsProcessed: number;
  tweetsUpdated: number;
  tweetsAdded: number;
  apiRequestsUsed: number;
  syncDuration: number;
  errors: string[];
}
```

### Database Tables

The system creates and uses these tables:

- `dao_sync_logs` - Detailed log entries
- `dao_sync_stats` - Aggregated sync statistics
- `dao_[slug]_tweets` - Individual DAO tweet tables (created dynamically)

### Viewing Statistics

```typescript
// Get recent logs
const logs = await logger.getRecentLogs(50);

// Get aggregated stats for last 7 days
const stats = await logger.getAggregatedStats(7);

// Get detailed sync statistics
const detailedStats = await logger.getSyncStatsForDateRange(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z'
);
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Rate Limit Errors**: Automatically waits and retries
- **API Errors**: Logs errors and continues with next DAO
- **Database Errors**: Detailed error logging without stopping the process
- **Network Errors**: Retry logic with exponential backoff

## 🔧 Configuration Options

```typescript
interface EngagementSyncOptions {
  daysToLookBack: number;        // How many days back to sync (default: 5)
  syncIntervalHours: number;     // How often to run sync (default: 2)
  maxRequestsPerBatch: number;   // Batch size for API requests (default: 10)
}

interface RateLimitConfig {
  requestsPer15Min: number;      // 15-minute window limit (default: 15)
  requestsPerMonth: number;      // Monthly request limit (default: 50000)
  postsPerMonth: number;         // Monthly post limit (default: 15000)
  delayBetweenRequests: number;  // Delay between requests (default: 1000ms)
}
```

## 🧪 Testing

Run the example to test the system:

```bash
npm run ts-node client/examples/engagement-sync-example.ts
```

This will:
- Run a single sync cycle
- Display statistics
- Show rate limit status
- Display recent logs

## 📝 Example Usage

### Basic Usage

```typescript
import { EngagementSyncService } from './services/twitter';

const syncService = new EngagementSyncService(process.env.TWITTER_BEARER_TOKEN!);

// Run once
const stats = await syncService.runEngagementSync();
console.log(`Processed ${stats.totalTweetsProcessed} tweets`);
```

### Automatic Sync with Custom Options

```typescript
const syncService = new EngagementSyncService(
  process.env.TWITTER_BEARER_TOKEN!,
  {
    daysToLookBack: 7,      // Look back 7 days
    syncIntervalHours: 4,   // Run every 4 hours
    maxRequestsPerBatch: 5  // Smaller batches for safety
  }
);

// Start automatic sync
syncService.startAutomaticSync();

// Stop when needed
process.on('SIGINT', () => {
  syncService.stopAutomaticSync();
  process.exit(0);
});
```

### Rate Limit Monitoring

```typescript
import { RateLimitManager } from './services/twitter';

const rateLimitManager = new RateLimitManager();

// Check current status
const status = rateLimitManager.getStatus();
console.log(`Requests left: ${status.requestsUsedLast15Min}/15`);
console.log(`Monthly usage: ${status.requestsUsedThisMonth}/50000`);

// Get detailed usage stats
const usage = rateLimitManager.getUsageStats();
console.log(`15-min usage: ${usage.requestsUsage.percentage15Min}%`);
console.log(`Monthly usage: ${usage.requestsUsage.percentageMonth}%`);
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Required
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# Optional
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running as a Service

```typescript
// server.ts
import { EngagementSyncService } from './services/twitter';

const syncService = new EngagementSyncService(
  process.env.TWITTER_BEARER_TOKEN!,
  {
    daysToLookBack: 5,
    syncIntervalHours: 2,
    maxRequestsPerBatch: 10
  }
);

// Start automatic sync
syncService.startAutomaticSync();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping sync...');
  syncService.stopAutomaticSync();
  process.exit(0);
});
```

## 🔍 Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**: The system should handle this automatically, but if you see persistent rate limit errors, try:
   - Reducing `maxRequestsPerBatch`
   - Increasing `syncIntervalHours`

2. **Database Connection Issues**: Check your Supabase connection settings and ensure the sync tables exist.

3. **Twitter API Errors**: Verify your Bearer Token is valid and has the necessary permissions.

### Debug Mode

Enable debug logging:

```typescript
const logger = new SyncLogger('EngagementSync', LogLevel.DEBUG);
```

### Viewing Logs

Check the `sync_logs` table in Supabase for detailed logs:

```sql
SELECT * FROM sync_logs 
WHERE service = 'EngagementSync' 
ORDER BY timestamp DESC 
LIMIT 100;
```

## 📚 API Reference

### EngagementSyncService

- `runEngagementSync()` - Run a single sync cycle
- `startAutomaticSync()` - Start automatic syncing
- `stopAutomaticSync()` - Stop automatic syncing
- `getSyncStatus()` - Get current sync status

### RateLimitManager

- `canMakeRequest()` - Check if a request can be made
- `checkRateLimit()` - Wait if necessary before making request
- `incrementRequestCount()` - Increment request counter
- `getStatus()` - Get current rate limit status
- `getUsageStats()` - Get detailed usage statistics

### SyncLogger

- `info(message, data?)` - Log info message
- `error(message, error?)` - Log error message
- `warn(message, data?)` - Log warning message
- `debug(message, data?)` - Log debug message
- `logSyncStats(stats)` - Log sync statistics
- `getRecentLogs(limit)` - Get recent log entries
- `getAggregatedStats(days)` - Get aggregated statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details. 