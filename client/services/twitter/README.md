# Twitter Sync Service for DAO Social Tracker

This service automatically fetches Twitter posts and engagement data for DAOs every 15 minutes and stores them in Supabase.

## Setup

### 1. Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twitter API Configuration
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# Optional: For server-side operations
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Getting Twitter Bearer Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use an existing one
3. Go to "Keys and tokens" section
4. Generate a Bearer Token
5. Copy the Bearer Token to your `.env.local` file

### 3. Supabase Setup

1. Run the migration to create the required tables:
   ```sql
   -- Run this in your Supabase SQL editor
   -- The migration file is located at: supabase/migrations/20240101000001_create_dao_twitter_tables.sql
   ```

2. Add your DAO Twitter accounts to the database:
   ```sql
   INSERT INTO account_twitter_accounts (account_id, username)
VALUES 
  ('your_account_uuid', 'twitter_username_without_@'),
  ('another_account_uuid', 'another_twitter_username');
   ```

## Usage

### Basic Usage

```typescript
import { initializeTwitterSync } from './services/twitter';

// Initialize and start the sync service
const syncManager = initializeTwitterSync();

// The service will now:
// - Run immediately to sync existing tweets
// - Continue syncing every 15 minutes automatically
```

### Adding DAO Twitter Accounts Programmatically

```typescript
import { addDAOTwitterAccount } from './examples/twitter-sync-example';

// Add a new DAO Twitter account
await addDAOTwitterAccount('dao-uuid', 'twitter_username');
```

### Fetching Twitter Data

```typescript
import { getDAOTwitterData, getDAOEngagementMetrics } from './examples/twitter-sync-example';

// Get all tweets for a specific DAO
const tweets = await getDAOTwitterData('dao-uuid');

// Get engagement metrics for a DAO
const metrics = await getDAOEngagementMetrics('dao-uuid');
console.log(metrics);
// Output:
// {
//   totalPosts: 50,
//   totalEngagement: { retweets: 100, replies: 50, likes: 500, quotes: 25 },
//   averageEngagement: { retweets: 2, replies: 1, likes: 10, quotes: 0 }
// }
```

## Database Schema

### account_twitter_accounts
- `id`: UUID primary key
- `account_id`: UUID reference to Accounts table
- `username`: Twitter username (without @)
- `created_at`: Timestamp

### account_twitter_posts
- `id`: UUID primary key
- `tweet_id`: Unique Twitter post ID
- `account_id`: UUID reference to Accounts table
- `content`: Tweet text content
- `created_at`: When the tweet was posted
- `retweet_count`: Number of retweets
- `reply_count`: Number of replies
- `like_count`: Number of likes
- `quote_count`: Number of quote tweets
- `synced_at`: When the data was synced

### account_twitter_sync_status
- `account_id`: UUID primary key reference to Accounts table
- `last_tweet_id`: ID of the last synced tweet
- `last_sync_time`: Timestamp of last sync
- `created_at`: When the record was created
- `updated_at`: When the record was last updated

## Rate Limiting

The service automatically handles Twitter API rate limits:
- Maximum 180 requests per 15-minute window
- 1-second delay between requests
- Automatic waiting when rate limit is reached

## Error Handling

- Individual DAO sync failures don't stop the entire process
- Comprehensive error logging
- Graceful handling of API errors
- Automatic retry on rate limit hits

## Monitoring

The service logs:
- Successful syncs with tweet counts
- Errors for individual DAOs
- Rate limit status
- Sync start/stop events

## Stopping the Service

```typescript
// If you need to stop the sync service
syncManager.stopSync();
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Check that all required environment variables are set
   - The service will throw an error listing missing variables

2. **Twitter API Errors**
   - Verify your Bearer Token is valid
   - Check if your Twitter app has the required permissions
   - Ensure you haven't exceeded rate limits

3. **Supabase Connection Issues**
   - Verify your Supabase URL and keys are correct
   - Check if the required tables exist
   - Ensure your Supabase project is active

4. **No Tweets Being Synced**
   - Check if the DAO Twitter accounts exist in the database
   - Verify the Twitter usernames are correct (without @)
   - Check the console logs for errors

### Debugging

Enable detailed logging by checking the console output. The service logs:
- Sync start/stop events
- Number of tweets synced per DAO
- Any errors encountered
- Rate limit status 