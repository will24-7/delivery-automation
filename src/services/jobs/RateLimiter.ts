import { RateLimiterConfig } from "./types";

/**
 * Interface for rate limit window
 */
interface RateWindow {
  timestamp: number;
  count: number;
}

/**
 * In-memory rate limiter for job processing
 */
export class RateLimiter {
  private domainWindows: Map<string, RateWindow>;
  private globalWindow: RateWindow;

  constructor(private config: RateLimiterConfig) {
    this.domainWindows = new Map();
    this.globalWindow = {
      timestamp: Date.now(),
      count: 0,
    };
  }

  /**
   * Check if a domain has exceeded its rate limit
   */
  async canProcessDomain(domainId: string): Promise<boolean> {
    const now = Date.now();

    // Check global rate limit
    if (!this.checkGlobalLimit(now)) {
      return false;
    }

    // Check domain-specific rate limit
    const domainWindow = this.domainWindows.get(domainId) || {
      timestamp: now,
      count: 0,
    };

    // Reset window if expired
    if (now - domainWindow.timestamp > this.config.perDomain.windowMs) {
      domainWindow.timestamp = now;
      domainWindow.count = 0;
    }

    // Check if limit exceeded
    if (domainWindow.count >= this.config.perDomain.maxRequests) {
      return false;
    }

    // Increment counters
    domainWindow.count++;
    this.globalWindow.count++;
    this.domainWindows.set(domainId, domainWindow);

    return true;
  }

  /**
   * Get current rate limit status for a domain
   */
  getDomainStatus(domainId: string): {
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    const domainWindow = this.domainWindows.get(domainId);

    if (!domainWindow) {
      return {
        remaining: this.config.perDomain.maxRequests,
        resetMs: 0,
      };
    }

    const timeSinceReset = now - domainWindow.timestamp;
    const timeUntilReset = Math.max(
      0,
      this.config.perDomain.windowMs - timeSinceReset
    );

    return {
      remaining: Math.max(
        0,
        this.config.perDomain.maxRequests - domainWindow.count
      ),
      resetMs: timeUntilReset,
    };
  }

  /**
   * Get global rate limit status
   */
  getGlobalStatus(): {
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    const timeSinceReset = now - this.globalWindow.timestamp;
    const timeUntilReset = Math.max(
      0,
      this.config.global.windowMs - timeSinceReset
    );

    return {
      remaining: Math.max(
        0,
        this.config.global.maxRequests - this.globalWindow.count
      ),
      resetMs: timeUntilReset,
    };
  }

  /**
   * Reset all rate limits
   */
  reset(): void {
    this.domainWindows.clear();
    this.globalWindow = {
      timestamp: Date.now(),
      count: 0,
    };
  }

  /**
   * Check if global rate limit is exceeded
   */
  private checkGlobalLimit(now: number): boolean {
    // Reset global window if expired
    if (now - this.globalWindow.timestamp > this.config.global.windowMs) {
      this.globalWindow = {
        timestamp: now,
        count: 0,
      };
    }

    return this.globalWindow.count < this.config.global.maxRequests;
  }
}

/**
 * Default rate limiter configuration
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  perDomain: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute per domain
  },
  global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute globally
  },
};
