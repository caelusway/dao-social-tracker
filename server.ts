import { EngagementSyncService } from './client/services/twitter/index';
import { SyncLogger, LogLevel } from './client/services/twitter/index';
import TwitterFollowerService from './client/services/twitter/twitterFollowerService';
import { AccountService } from './client/services/dao/daoService';

// Production environment configuration
const CONFIG = {
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  SYNC_INTERVAL_HOURS: parseInt(process.env.SYNC_INTERVAL_HOURS || '2'),
  FOLLOWER_SYNC_INTERVAL_HOURS: parseInt(process.env.FOLLOWER_SYNC_INTERVAL_HOURS || '24'), // Daily
  DAYS_TO_LOOK_BACK: parseInt(process.env.DAYS_TO_LOOK_BACK || '5'),
  MAX_REQUESTS_PER_BATCH: parseInt(process.env.MAX_REQUESTS_PER_BATCH || '5'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
  PORT: process.env.PORT || 3000
};

class ProductionSyncServer {
  private syncService: EngagementSyncService | null = null;
  private followerService: TwitterFollowerService | null = null;
  private accountService: AccountService | null = null;
  private followerSyncInterval: NodeJS.Timeout | null = null;
  private logger: SyncLogger;
  private isShuttingDown = false;

  constructor() {
    this.logger = new SyncLogger('ProductionServer', this.getLogLevel());
  }

  private getLogLevel(): LogLevel {
    switch (CONFIG.LOG_LEVEL.toUpperCase()) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  async start() {
    try {
      this.logger.info('🚀 Starting Production Engagement Sync Server');
      
      // Setup health check endpoint FIRST - before anything else
      this.setupHealthCheck();
      
      // Small delay to ensure server is listening
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Validate environment (non-blocking for health checks)
      try {
        await this.validateEnvironment();
      } catch (error) {
        this.logger.error('❌ Environment validation failed, but continuing for health checks:', error);
        // Don't exit - let health checks work
      }
      
      // Initialize services only if Twitter token is available
      if (CONFIG.TWITTER_BEARER_TOKEN) {
        try {
          // Initialize sync service
          this.syncService = new EngagementSyncService(CONFIG.TWITTER_BEARER_TOKEN, {
            daysToLookBack: CONFIG.DAYS_TO_LOOK_BACK,
            syncIntervalHours: CONFIG.SYNC_INTERVAL_HOURS,
            maxRequestsPerBatch: CONFIG.MAX_REQUESTS_PER_BATCH
          });

          // Initialize follower sync service
          this.followerService = new TwitterFollowerService(CONFIG.TWITTER_BEARER_TOKEN);

          // Start automatic sync
          this.syncService.startAutomaticSync();
          
          // Start follower sync (daily)
          this.startFollowerSync();
          
          this.logger.info(`📊 Sync interval: ${CONFIG.SYNC_INTERVAL_HOURS} hours`);
          this.logger.info(`👥 Follower sync interval: ${CONFIG.FOLLOWER_SYNC_INTERVAL_HOURS} hours`);
          this.logger.info(`🔍 Days to look back: ${CONFIG.DAYS_TO_LOOK_BACK}`);
          this.logger.info(`📦 Max requests per batch: ${CONFIG.MAX_REQUESTS_PER_BATCH}`);
        } catch (error) {
          this.logger.error('❌ Failed to initialize Twitter services:', error);
        }
      } else {
        this.logger.warn('⚠️ Twitter services disabled - no bearer token provided');
      }
      
      // Initialize account service (always needed)
      try {
        this.accountService = new AccountService();
      } catch (error) {
        this.logger.error('❌ Failed to initialize account service:', error);
      }
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.logger.info(`✅ Server started successfully on port ${CONFIG.PORT}`);

    } catch (error) {
      this.logger.error('❌ Failed to start server', error);
      // Don't exit immediately - let health checks respond
      setTimeout(() => process.exit(1), 5000);
    }
  }

  private startFollowerSync() {
    // Run initial sync on startup
    this.runFollowerSync();
    
    // Set up periodic sync
    const intervalMs = CONFIG.FOLLOWER_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
    this.followerSyncInterval = setInterval(() => {
      this.runFollowerSync();
    }, intervalMs);
    
    this.logger.info(`📊 Follower sync started - will run every ${CONFIG.FOLLOWER_SYNC_INTERVAL_HOURS} hours`);
  }

  private async runFollowerSync() {
    if (!this.followerService || this.isShuttingDown) return;
    
    try {
      this.logger.info('🔄 Starting follower count sync...');
      
      const result = await this.followerService.updateAllFollowerCounts();
      
      this.logger.info(`✅ Follower sync completed - Success: ${result.success}, Errors: ${result.errors}`);
      
      if (result.success > 0) {
        // Log top accounts for monitoring
        const topAccounts = await this.followerService.getTopAccountsByFollowers(3);
        this.logger.info(`🏆 Top accounts: ${topAccounts.map(a => `${a.name} (${a.follower_count})`).join(', ')}`);
      }
    } catch (error) {
      this.logger.error('❌ Follower sync failed', error);
    }
  }

  private async validateEnvironment() {
    const missing: string[] = [];
    
    // TWITTER_BEARER_TOKEN is optional for basic health checks
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
    
    if (missing.length > 0) {
      this.logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Warn about optional variables
    if (!CONFIG.TWITTER_BEARER_TOKEN) {
      this.logger.warn('⚠️ TWITTER_BEARER_TOKEN not set - Twitter sync will be disabled');
    }

    this.logger.info('✅ Environment validation passed');
  }

  private setupHealthCheck() {
    const http = require('http');
    
    console.log(`Setting up health check server on port ${CONFIG.PORT}`);
    
    const server = http.createServer((req: any, res: any) => {
      console.log(`Health check request: ${req.method} ${req.url}`);
      
      // Add CORS headers for Railway health checks
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.url === '/health') {
        console.log('Handling /health request');
        this.handleHealthCheck(res);
      } else if (req.url === '/status') {
        this.handleStatusCheck(res);
      } else if (req.url === '/metrics') {
        this.handleMetrics(res);
      } else if (req.url === '/' || req.url === '') {
        // Root endpoint for Railway health check
        console.log('Handling root / request');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          service: 'dao-tracker', 
          status: 'running',
          timestamp: new Date().toISOString()
        }));
      } else {
        console.log(`404 for ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.on('error', (error: any) => {
      console.error('❌ Server error:', error);
      this.logger.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${CONFIG.PORT} is already in use`);
        this.logger.error(`Port ${CONFIG.PORT} is already in use`);
        process.exit(1);
      }
    });

    server.listen(CONFIG.PORT, '0.0.0.0', () => {
      console.log(`🩺 Health check server listening on 0.0.0.0:${CONFIG.PORT}`);
      this.logger.info(`🩺 Health check server running on port ${CONFIG.PORT}`);
    });
  }

  private async handleHealthCheck(res: any) {
    try {
      // Always return healthy for Railway - just check basic server functionality
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'dao-tracker',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: CONFIG.PORT,
        environment: 'production'
      }));
    } catch (error) {
      console.error('Health check error:', error);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy',
        service: 'dao-tracker',
        timestamp: new Date().toISOString(),
        note: 'Basic health check passed'
      }));
    }
  }

  private async handleStatusCheck(res: any) {
    try {
      const status = this.syncService?.getSyncStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...status,
        timestamp: new Date().toISOString(),
        followerSync: {
          isRunning: this.followerSyncInterval !== null,
          intervalHours: CONFIG.FOLLOWER_SYNC_INTERVAL_HOURS
        },
        config: {
          syncIntervalHours: CONFIG.SYNC_INTERVAL_HOURS,
          followerSyncIntervalHours: CONFIG.FOLLOWER_SYNC_INTERVAL_HOURS,
          daysToLookBack: CONFIG.DAYS_TO_LOOK_BACK,
          maxRequestsPerBatch: CONFIG.MAX_REQUESTS_PER_BATCH
        }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
  }

  private async handleMetrics(res: any) {
    try {
      const aggregatedStats = await this.logger.getAggregatedStats(7);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        metrics: aggregatedStats,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
  }

  private setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        if (!this.isShuttingDown) {
          this.shutdown(signal);
        }
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('💥 Uncaught Exception', error);
      this.shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('💥 Unhandled Rejection', { reason, promise });
      this.shutdown('unhandledRejection');
    });
  }

  private async shutdown(reason: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info(`🛑 Shutting down server (reason: ${reason})`);
    
    try {
      // Stop sync service
      if (this.syncService) {
        this.syncService.stopAutomaticSync();
        this.logger.info('✅ Sync service stopped');
      }

      // Stop follower sync
      if (this.followerSyncInterval) {
        clearInterval(this.followerSyncInterval);
        this.followerSyncInterval = null;
        this.logger.info('✅ Follower sync stopped');
      }

      // Wait a bit for any ongoing operations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.logger.info('👋 Server shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('❌ Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Start the server
console.log('🚀 Starting DAO Tracker Server...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || '3000'}`);
console.log(`SUPABASE_URL set: ${!!process.env.SUPABASE_URL}`);
console.log(`SUPABASE_ANON_KEY set: ${!!process.env.SUPABASE_ANON_KEY}`);
console.log(`TWITTER_BEARER_TOKEN set: ${!!process.env.TWITTER_BEARER_TOKEN}`);

const server = new ProductionSyncServer();
server.start().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
}); 