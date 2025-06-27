import TwitterSyncManager from './syncManager';
import TwitterService from './twitterService';
import { ENV_CONFIG } from '../../config/environment';

export const initializeTwitterSync = (bearerToken?: string) => {
    const token = bearerToken || ENV_CONFIG.TWITTER_BEARER_TOKEN;
    
    if (!token) {
        throw new Error('Twitter bearer token is required. Please set TWITTER_BEARER_TOKEN environment variable or pass it directly.');
    }

    const syncManager = new TwitterSyncManager(token);
    
    // Start the sync process
    syncManager.startSync();
    
    // Return the manager instance in case we need to stop it later
    return syncManager;
};

// Twitter Service Exports
export { default as TwitterService } from './twitterService';
export { default as TwitterSyncManager } from './syncManager';
export { TwitterSyncService } from './twitterSyncService';

// New Engagement Sync System
export { EngagementSyncService } from './engagementSyncService';
export type { EngagementSyncOptions, SyncStats } from './engagementSyncService';

export { RateLimitManager } from './rateLimitManager';
export type { RateLimitStatus, RateLimitConfig } from './rateLimitManager';

export { SyncLogger, LogLevel } from './syncLogger';
export type { SyncLogEntry } from './syncLogger';

// Configuration and Types
export * from './config';
export * from './types'; 