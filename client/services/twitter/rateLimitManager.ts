export interface RateLimitStatus {
  requestsUsedLast15Min: number;
  requestsUsedThisMonth: number;
  postsRetrievedThisMonth: number;
  canMakeRequest: boolean;
  timeUntilReset: number;
  monthlyResetDate: Date;
}

export interface RateLimitConfig {
  requestsPer15Min: number;
  requestsPerMonth: number;
  postsPerMonth: number;
  delayBetweenRequests: number;
}

export class RateLimitManager {
  private config: RateLimitConfig;
  private requestWindow: number[] = []; // Timestamps of requests in the last 15 minutes
  private monthlyRequestCount: number = 0;
  private monthlyPostCount: number = 0;
  private monthStartDate: Date;
  private lastRequestTime: number = 0;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      requestsPer15Min: 15, // User specified: 15 requests per 15 mins
      requestsPerMonth: 50000, // User specified: 50k requests per month
      postsPerMonth: 15000, // User specified: 15k posts per month
      delayBetweenRequests: 1000, // 1 second delay
      ...config
    };

    // Initialize monthly tracking
    this.monthStartDate = new Date();
    this.monthStartDate.setDate(1);
    this.monthStartDate.setHours(0, 0, 0, 0);

    // Load persisted stats if available
    this.loadPersistedStats();
  }

  /**
   * Load persisted rate limit stats from localStorage or similar
   */
  private loadPersistedStats(): void {
    try {
      const stats = JSON.parse(process.env.RATE_LIMIT_STATS || '{}');
      if (stats.monthStartDate && new Date(stats.monthStartDate).getMonth() === new Date().getMonth()) {
        this.monthlyRequestCount = stats.monthlyRequestCount || 0;
        this.monthlyPostCount = stats.monthlyPostCount || 0;
        this.monthStartDate = new Date(stats.monthStartDate);
      }
    } catch (error) {
      console.warn('Failed to load persisted rate limit stats:', error);
    }
  }

  /**
   * Persist rate limit stats
   */
  private persistStats(): void {
    try {
      const stats = {
        monthlyRequestCount: this.monthlyRequestCount,
        monthlyPostCount: this.monthlyPostCount,
        monthStartDate: this.monthStartDate.toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      // In a real implementation, you'd use a proper storage mechanism
      // For now, we'll just set it as an environment variable concept
      process.env.RATE_LIMIT_STATS = JSON.stringify(stats);
    } catch (error) {
      console.warn('Failed to persist rate limit stats:', error);
    }
  }

  /**
   * Clean up old requests from the 15-minute window
   */
  private cleanupRequestWindow(): void {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    this.requestWindow = this.requestWindow.filter(timestamp => timestamp > fifteenMinutesAgo);
  }

  /**
   * Reset monthly counters if needed
   */
  private checkMonthlyReset(): void {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    if (currentMonthStart > this.monthStartDate) {
      this.monthlyRequestCount = 0;
      this.monthlyPostCount = 0;
      this.monthStartDate = currentMonthStart;
      this.persistStats();
    }
  }

  /**
   * Check if we can make a request based on current rate limits
   */
  canMakeRequest(): boolean {
    this.cleanupRequestWindow();
    this.checkMonthlyReset();

    // Check 15-minute window limit
    if (this.requestWindow.length >= this.config.requestsPer15Min) {
      return false;
    }

    // Check monthly request limit
    if (this.monthlyRequestCount >= this.config.requestsPerMonth) {
      return false;
    }

    // Check if enough time has passed since last request
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.delayBetweenRequests) {
      return false;
    }

    return true;
  }

  /**
   * Check rate limits and wait if necessary
   */
  async checkRateLimit(): Promise<void> {
    this.cleanupRequestWindow();
    this.checkMonthlyReset();

    // Wait for delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.delayBetweenRequests) {
      const waitTime = this.config.delayBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Check 15-minute window
    if (this.requestWindow.length >= this.config.requestsPer15Min) {
      const oldestRequest = Math.min(...this.requestWindow);
      const waitTime = (oldestRequest + (15 * 60 * 1000)) - Date.now();
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Check monthly limits
    if (this.monthlyRequestCount >= this.config.requestsPerMonth) {
      throw new Error('Monthly request limit exceeded');
    }
  }

  /**
   * Wait for rate limit to reset
   */
  async waitForRateLimit(): Promise<void> {
    this.cleanupRequestWindow();
    
    if (this.requestWindow.length >= this.config.requestsPer15Min) {
      const oldestRequest = Math.min(...this.requestWindow);
      const waitTime = (oldestRequest + (15 * 60 * 1000)) - Date.now();
      
      if (waitTime > 0) {
        console.log(`Waiting ${Math.ceil(waitTime / 1000)} seconds for rate limit reset...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Increment request counter
   */
  incrementRequestCount(): void {
    const now = Date.now();
    this.requestWindow.push(now);
    this.monthlyRequestCount++;
    this.lastRequestTime = now;
    this.persistStats();
  }

  /**
   * Increment post counter
   */
  incrementPostCount(postCount: number = 1): void {
    this.monthlyPostCount += postCount;
    this.persistStats();
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.cleanupRequestWindow();
    this.checkMonthlyReset();

    const nextReset = this.requestWindow.length > 0 
      ? Math.min(...this.requestWindow) + (15 * 60 * 1000) 
      : Date.now();

    const monthlyResetDate = new Date(this.monthStartDate);
    monthlyResetDate.setMonth(monthlyResetDate.getMonth() + 1);

    return {
      requestsUsedLast15Min: this.requestWindow.length,
      requestsUsedThisMonth: this.monthlyRequestCount,
      postsRetrievedThisMonth: this.monthlyPostCount,
      canMakeRequest: this.canMakeRequest(),
      timeUntilReset: Math.max(0, nextReset - Date.now()),
      monthlyResetDate
    };
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const status = this.getStatus();
    return {
      requestsUsage: {
        per15Min: `${status.requestsUsedLast15Min}/${this.config.requestsPer15Min}`,
        perMonth: `${status.requestsUsedThisMonth}/${this.config.requestsPerMonth}`,
        percentage15Min: (status.requestsUsedLast15Min / this.config.requestsPer15Min) * 100,
        percentageMonth: (status.requestsUsedThisMonth / this.config.requestsPerMonth) * 100
      },
      postsUsage: {
        perMonth: `${status.postsRetrievedThisMonth}/${this.config.postsPerMonth}`,
        percentageMonth: (status.postsRetrievedThisMonth / this.config.postsPerMonth) * 100
      },
      resetInfo: {
        next15MinReset: new Date(Date.now() + status.timeUntilReset),
        nextMonthlyReset: status.monthlyResetDate
      }
    };
  }

  /**
   * Reset all counters (useful for testing)
   */
  reset(): void {
    this.requestWindow = [];
    this.monthlyRequestCount = 0;
    this.monthlyPostCount = 0;
    this.monthStartDate = new Date();
    this.monthStartDate.setDate(1);
    this.monthStartDate.setHours(0, 0, 0, 0);
    this.lastRequestTime = 0;
    this.persistStats();
  }
} 