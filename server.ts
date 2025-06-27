import { EngagementSyncService } from './client/services/twitter/index.js';
import { SyncLogger, LogLevel } from './client/services/twitter/index.js';

// Production environment configuration
const CONFIG = {
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  SYNC_INTERVAL_HOURS: parseInt(process.env.SYNC_INTERVAL_HOURS || '2'),
  DAYS_TO_LOOK_BACK: parseInt(process.env.DAYS_TO_LOOK_BACK || '5'),
  MAX_REQUESTS_PER_BATCH: parseInt(process.env.MAX_REQUESTS_PER_BATCH || '5'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
  PORT: process.env.PORT || 3000
};

class ProductionSyncServer {
  private syncService: EngagementSyncService | null = null;
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
      
      // Validate environment
      await this.validateEnvironment();
      
      // Initialize sync service
      this.syncService = new EngagementSyncService(CONFIG.TWITTER_BEARER_TOKEN!, {
        daysToLookBack: CONFIG.DAYS_TO_LOOK_BACK,
        syncIntervalHours: CONFIG.SYNC_INTERVAL_HOURS,
        maxRequestsPerBatch: CONFIG.MAX_REQUESTS_PER_BATCH
      });

      // Start automatic sync
      this.syncService.startAutomaticSync();
      
      // Setup health check endpoint
      this.setupHealthCheck();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.logger.info(`✅ Server started successfully on port ${CONFIG.PORT}`);
      this.logger.info(`📊 Sync interval: ${CONFIG.SYNC_INTERVAL_HOURS} hours`);
      this.logger.info(`🔍 Days to look back: ${CONFIG.DAYS_TO_LOOK_BACK}`);
      this.logger.info(`📦 Max requests per batch: ${CONFIG.MAX_REQUESTS_PER_BATCH}`);

    } catch (error) {
      this.logger.error('❌ Failed to start server', error);
      process.exit(1);
    }
  }

  private async validateEnvironment() {
    const missing: string[] = [];
    
    if (!CONFIG.TWITTER_BEARER_TOKEN) missing.push('TWITTER_BEARER_TOKEN');
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    this.logger.info('✅ Environment validation passed');
  }

  private setupHealthCheck() {
    const http = require('http');
    
    const server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        this.handleHealthCheck(res);
      } else if (req.url === '/status') {
        this.handleStatusCheck(res);
      } else if (req.url === '/metrics') {
        this.handleMetrics(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.listen(CONFIG.PORT, () => {
      this.logger.info(`🩺 Health check server running on port ${CONFIG.PORT}`);
    });
  }

  private async handleHealthCheck(res: any) {
    try {
      const status = this.syncService?.getSyncStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sync: {
          isRunning: status?.isRunning || false,
          isAutomatic: status?.isAutomatic || false
        }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', error: String(error) }));
    }
  }

  private async handleStatusCheck(res: any) {
    try {
      const status = this.syncService?.getSyncStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...status,
        timestamp: new Date().toISOString(),
        config: {
          syncIntervalHours: CONFIG.SYNC_INTERVAL_HOURS,
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
const server = new ProductionSyncServer();
server.start().catch(console.error); 