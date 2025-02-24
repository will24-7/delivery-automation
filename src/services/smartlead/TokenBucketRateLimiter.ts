/**
 * Token bucket rate limiter implementation for Smartlead API
 * Limits to 10 requests per 2 seconds
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private readonly tokensPerInterval: number;

  constructor(maxTokens: number, intervalMs: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillIntervalMs = intervalMs;
    this.tokensPerInterval = maxTokens;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const refills = Math.floor(timePassed / this.refillIntervalMs);

    if (refills > 0) {
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + refills * this.tokensPerInterval
      );
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens <= 0) {
      const waitTime = this.refillIntervalMs - (Date.now() - this.lastRefill);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refillTokens();
    }

    this.tokens--;
  }
}
