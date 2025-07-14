import { supabase } from '../supabase/client.js';
import { SyncStats } from './engagementSyncService.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface SyncLogEntry {
  id?: string;
  service: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: string;
  timestamp: string;
  sync_stats?: SyncStats;
}

export class SyncLogger {
  private serviceName: string;
  private logLevel: LogLevel;

  constructor(serviceName: string, logLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.logLevel = logLevel;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, data);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, data);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, null, error);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, error?: any): void {
    const logEntry: SyncLogEntry = {
      service: this.serviceName,
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
      error: error ? this.formatError(error) : undefined,
      timestamp: new Date().toISOString()
    };

    // Console output
    this.outputToConsole(logEntry);

    // Store in database (async, don't wait)
    this.storeLogEntry(logEntry).catch(err => {
      console.error('Failed to store log entry:', err);
    });
  }

  /**
   * Format error for logging
   */
  private formatError(error: any): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}\n${error.stack}`;
    }
    return String(error);
  }

  /**
   * Output log to console with formatting
   */
  private outputToConsole(logEntry: SyncLogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toLocaleString();
    const levelText = LogLevel[logEntry.level];
    const prefix = `[${timestamp}] [${this.serviceName}] [${levelText}]`;

    switch (logEntry.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${logEntry.message}`, logEntry.data ? JSON.parse(logEntry.data) : '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${logEntry.message}`, logEntry.data ? JSON.parse(logEntry.data) : '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${logEntry.message}`, logEntry.data ? JSON.parse(logEntry.data) : '');
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ${logEntry.message}`);
        if (logEntry.error) {
          console.error(logEntry.error);
        }
        if (logEntry.data) {
          console.error('Additional data:', JSON.parse(logEntry.data));
        }
        break;
    }
  }

  /**
   * Store log entry in database
   */
  private async storeLogEntry(logEntry: SyncLogEntry): Promise<void> {
    try {
      const { error } = await supabase
        .from('account_sync_logs')
        .insert(logEntry);

      if (error) {
        console.error('Failed to store log entry:', error);
      }
    } catch (error) {
      console.error('Error storing log entry:', error);
    }
  }

  /**
   * Log sync statistics
   */
  async logSyncStats(stats: SyncStats): Promise<void> {
    const logEntry: SyncLogEntry = {
      service: this.serviceName,
      level: LogLevel.INFO,
      message: 'Sync cycle completed',
      data: JSON.stringify({
        summary: {
          totalTweetsProcessed: stats.totalTweetsProcessed,
          tweetsUpdated: stats.tweetsUpdated,
          tweetsAdded: stats.tweetsAdded,
          apiRequestsUsed: stats.apiRequestsUsed,
          syncDuration: `${stats.syncDuration}ms`,
          errorCount: stats.errors.length
        }
      }),
      timestamp: new Date().toISOString(),
      sync_stats: stats
    };

    this.outputToConsole(logEntry);

    try {
             // Store detailed sync stats
       const { error } = await supabase
         .from('account_sync_stats')
         .insert({
          service: this.serviceName,
          total_tweets_processed: stats.totalTweetsProcessed,
          tweets_updated: stats.tweetsUpdated,
          tweets_added: stats.tweetsAdded,
          api_requests_used: stats.apiRequestsUsed,
          sync_duration_ms: stats.syncDuration,
          error_count: stats.errors.length,
          errors: stats.errors.length > 0 ? stats.errors : null,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to store sync stats:', error);
      }
    } catch (error) {
      console.error('Error storing sync stats:', error);
    }
  }

  /**
   * Get recent logs for this service
   */
  async getRecentLogs(limit: number = 100): Promise<SyncLogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('account_sync_logs')
        .select('*')
        .eq('service', this.serviceName)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch recent logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching recent logs:', error);
      return [];
    }
  }

  /**
   * Get sync statistics for a date range
   */
  async getSyncStatsForDateRange(startDate: string, endDate: string) {
         try {
       const { data, error } = await supabase
         .from('account_sync_stats')
         .select('*')
         .eq('service', this.serviceName)
         .gte('timestamp', startDate)
         .lte('timestamp', endDate)
         .order('timestamp', { ascending: false });

       if (error) {
         console.error('Failed to fetch sync stats:', error);
         return [];
       }

       return data || [];
     } catch (error) {
      console.error('Error fetching sync stats:', error);
      return [];
    }
  }

  /**
   * Get aggregated sync statistics
   */
  async getAggregatedStats(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

         try {
       const { data, error } = await supabase
         .from('account_sync_stats')
         .select('*')
         .eq('service', this.serviceName)
         .gte('timestamp', startDate.toISOString());

       if (error) {
         console.error('Failed to fetch aggregated stats:', error);
         return null;
       }

       if (!data || data.length === 0) {
         return null;
       }

      // Calculate aggregated statistics
      const aggregated = data.reduce((acc, stat) => ({
        totalTweetsProcessed: acc.totalTweetsProcessed + (stat.total_tweets_processed || 0),
        totalTweetsUpdated: acc.totalTweetsUpdated + (stat.tweets_updated || 0),
        totalTweetsAdded: acc.totalTweetsAdded + (stat.tweets_added || 0),
        totalApiRequests: acc.totalApiRequests + (stat.api_requests_used || 0),
        totalSyncTime: acc.totalSyncTime + (stat.sync_duration_ms || 0),
        totalErrors: acc.totalErrors + (stat.error_count || 0),
        syncCount: acc.syncCount + 1
      }), {
        totalTweetsProcessed: 0,
        totalTweetsUpdated: 0,
        totalTweetsAdded: 0,
        totalApiRequests: 0,
        totalSyncTime: 0,
        totalErrors: 0,
        syncCount: 0
      });

      return {
        ...aggregated,
        averageSyncTime: aggregated.totalSyncTime / aggregated.syncCount,
        averageTweetsPerSync: aggregated.totalTweetsProcessed / aggregated.syncCount,
        averageApiRequestsPerSync: aggregated.totalApiRequests / aggregated.syncCount,
        periodDays: days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error calculating aggregated stats:', error);
      return null;
    }
  }

  /**
   * Clean up old logs (useful for maintenance)
   */
  async cleanupOldLogs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const { data, error, count } = await supabase
        .from('account_sync_logs')
        .delete()
        .eq('service', this.serviceName)
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        console.error('Failed to cleanup old logs:', error);
        return 0;
      }

      const deletedCount = count || 0;
      this.info(`Cleaned up ${deletedCount} old log entries`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      return 0;
    }
  }
} 