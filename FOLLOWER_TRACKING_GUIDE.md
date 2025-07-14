# Twitter Follower Tracking Guide

This guide explains how to use the new Twitter follower tracking functionality that automatically tracks and stores follower counts for all accounts with Twitter handles.

## 🚀 Overview

The follower tracking system provides:
- **Automatic follower count updates** for all accounts with Twitter handles
- **Historical tracking** of follower count changes over time
- **Daily sync mechanism** to keep follower counts up to date
- **Analytics and trending** to understand follower growth patterns
- **Batch processing** to efficiently handle multiple accounts

## 📋 Prerequisites

1. **Twitter Bearer Token**: You need a valid Twitter API Bearer Token
2. **Database Setup**: Run the follower tracking migration first
3. **Accounts with Twitter Handles**: Your accounts table should have entries with `twitter_handle` field

## 🔧 Setup Instructions

### 1. Run the Database Migration

First, apply the follower tracking migration to add the necessary database columns and functions:

```bash
# Apply all migrations including the follower tracking migration
supabase db push
```

This migration adds:
- `follower_count` column to accounts table
- `follower_count_updated_at` timestamp column
- `account_follower_history` table for historical tracking
- Helper functions for updating and querying follower data

### 2. Environment Variables

Make sure you have the Twitter Bearer Token in your `.env` file:

```env
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
```

### 3. Initial Setup

Run the initial follower count sync to populate follower counts for all accounts:

```bash
npm run sync:followers initial
```

This will:
- Find all accounts with Twitter handles
- Fetch current follower counts from Twitter API
- Store the follower counts in the database
- Create initial history records

## 📊 Usage Commands

### Initial Sync
```bash
npm run sync:followers initial
```
- **Purpose**: First-time setup to get current follower counts
- **When to use**: Once when setting up the system
- **What it does**: Fetches follower counts for ALL accounts with Twitter handles

### Daily Sync
```bash
npm run sync:followers daily
```
- **Purpose**: Update follower counts for accounts that need updates (older than 24 hours)
- **When to use**: Daily maintenance or manual updates
- **What it does**: Only updates accounts that haven't been updated in 24+ hours

### Statistics
```bash
npm run sync:followers stats
```
- **Purpose**: Show follower count statistics and top accounts
- **When to use**: To view analytics and current status
- **What it shows**: 
  - Total accounts tracked
  - Total followers across all accounts
  - Average followers per account
  - Top 10 accounts by followers

### Scheduler (Automatic Daily Sync)
```bash
npm run sync:followers scheduler
```
- **Purpose**: Start automatic daily syncing
- **When to use**: For production deployment
- **What it does**: Runs daily sync every 24 hours automatically
- **How to stop**: Press Ctrl+C

### Example/Test
```bash
npm run test:followers
```
- **Purpose**: Demonstrate follower tracking functionality
- **When to use**: To understand how the system works
- **What it shows**: Examples of all follower tracking features

## 🗃️ Database Schema

### New Columns in `accounts` table:
- `follower_count` (INTEGER): Current follower count
- `follower_count_updated_at` (TIMESTAMP): When follower count was last updated

### New `account_follower_history` table:
- `id` (UUID): Primary key
- `account_id` (UUID): Reference to accounts table
- `follower_count` (INTEGER): Follower count at that time
- `change_amount` (INTEGER): Change from previous count
- `recorded_at` (TIMESTAMP): When this record was created

## 🔄 How It Works

### 1. Data Collection
- Uses Twitter API v2 to fetch user information
- Processes accounts in batches to respect rate limits
- Handles API errors gracefully

### 2. Storage
- Updates accounts table with current follower count
- Creates history records to track changes over time
- Calculates change amounts automatically

### 3. Rate Limiting
- Respects Twitter API rate limits (180 requests per 15 minutes)
- Implements delays between batches
- Processes multiple users per request when possible

## 📈 Analytics Features

### Top Accounts by Followers
```typescript
const topAccounts = await followerService.getTopAccountsByFollowers(10);
```

### Follower History
```typescript
const history = await followerService.getFollowerHistory(accountId, 30);
```

### Follower Trends
```typescript
const trends = await followerService.getFollowerTrends(accountId, 30);
```

### Accounts Needing Updates
```typescript
const needsUpdate = await followerService.getAccountsNeedingUpdate();
```

## 🏗️ Architecture

### Services
- **`TwitterFollowerService`**: Handles Twitter API calls and database updates
- **`FollowerCountSyncManager`**: Manages sync operations and scheduling

### Database Functions
- **`update_account_follower_count()`**: Updates follower count with history tracking
- **`get_account_follower_trends()`**: Returns follower trends for analytics
- **`cleanup_old_follower_history()`**: Removes old history records

## 🚀 Production Deployment

### Option 1: Scheduled Job (Recommended)
Set up a cron job or scheduled task to run daily sync:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/dao_tracker && npm run sync:followers daily
```

### Option 2: Continuous Scheduler
Run the scheduler process continuously:

```bash
# This keeps running and syncs every 24 hours
npm run sync:followers scheduler
```

### Option 3: Manual Sync
Run sync manually when needed:

```bash
npm run sync:followers daily
```

## 📊 Example Usage

### Check Current Status
```bash
npm run sync:followers stats
```

### Update Follower Counts
```bash
npm run sync:followers daily
```

### See What the System Can Do
```bash
npm run test:followers
```

## 🔍 Monitoring

### Check Sync Status
The system logs all operations and provides detailed output:

```bash
npm run sync:followers stats
```

### View Recent Changes
Check the `account_follower_history` table to see recent follower count changes:

```sql
SELECT 
  a.name,
  a.twitter_handle,
  h.follower_count,
  h.change_amount,
  h.recorded_at
FROM account_follower_history h
JOIN accounts a ON h.account_id = a.id
ORDER BY h.recorded_at DESC
LIMIT 10;
```

## 🛠️ Troubleshooting

### Common Issues

1. **"No accounts with Twitter handles found"**
   - Make sure your accounts have the `twitter_handle` field populated
   - Check that accounts exist in the database

2. **"Twitter API rate limit exceeded"**
   - The system handles this automatically with delays
   - Wait 15 minutes and try again

3. **"User not found" errors**
   - Some Twitter handles may be invalid or suspended
   - Check that the Twitter handles in your database are correct

### Debug Commands

```bash
# Test the follower tracking system
npm run test:followers

# Check current statistics
npm run sync:followers stats

# View help
npm run sync:followers
```

## 📚 Code Examples

### Using the Service Directly

```typescript
import TwitterFollowerService from './services/twitter/twitterFollowerService';

const service = new TwitterFollowerService(process.env.TWITTER_BEARER_TOKEN!);

// Get follower count for a single user
const userInfo = await service.getUserInfo('username');
console.log(`Followers: ${userInfo.public_metrics.followers_count}`);

// Update follower count for an account
await service.updateAccountFollowerCount(accountId, followerCount);

// Get follower history
const history = await service.getFollowerHistory(accountId, 30);
```

## 🎯 Best Practices

1. **Run initial sync first**: Always run `npm run sync:followers initial` before setting up daily sync
2. **Monitor rate limits**: Don't run sync commands too frequently
3. **Use daily sync for maintenance**: Use `daily` command for regular updates
4. **Check stats regularly**: Use `stats` command to monitor system health
5. **Set up automated sync**: Use cron jobs or the scheduler for production

## 🚨 Important Notes

- **Rate Limits**: Twitter API has rate limits. The system respects these automatically.
- **API Costs**: Each sync uses Twitter API calls. Monitor your usage.
- **Data Retention**: History records are kept indefinitely. Use `cleanup_old_follower_history()` function to clean up old records.
- **Error Handling**: Individual account failures don't stop the entire sync process.

## 🔮 Future Enhancements

- **Real-time webhooks** for instant follower updates
- **Follower growth alerts** when accounts reach milestones
- **Comparative analytics** between different accounts
- **Export functionality** for follower data
- **Integration with other social platforms**

---

For questions or issues, check the console output when running commands, as it provides detailed logging of all operations. 