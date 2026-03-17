/**
 * Rate limiter using token bucket algorithm
 * Prevents exceeding Amazon SP-API rate limits
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  queueRequests?: boolean;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Token bucket rate limiter
 *
 * Amazon SP-API has different rate limits per endpoint.
 * This limiter allows configuring different limits per endpoint
 * and falls back to default if a specific key is not found.
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private queue: Array<{
    key: string;
    resolve: () => void;
    enqueueTime: number;
  }> = [];
  private processingQueue = false;

  constructor(private configs: Map<string, RateLimitConfig>) {}

  async acquire(key: string): Promise<void> {
    const config = this.configs.get(key) || this.configs.get('default');
    if (!config) {
      throw new Error(
        `No rate limit configuration found for key: ${key}`
      );
    }

    const bucket = this.getOrCreateBucket(key, config);
    this.refillBucket(bucket, config);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    if (config.queueRequests === false) {
      const waitTime = this.calculateWaitTime(bucket, config);
      throw new Error(
        `Rate limit exceeded for ${key}. Wait ${Math.ceil(waitTime / 1000)}s before retrying.`
      );
    }

    return new Promise<void>((resolve) => {
      this.queue.push({
        key,
        resolve,
        enqueueTime: Date.now(),
      });
      this.processQueue();
    });
  }

  getAvailableTokens(key: string): number {
    const config = this.configs.get(key);
    if (!config) {
      return 0;
    }

    const bucket = this.buckets.get(key);
    if (!bucket) {
      return config.maxRequests;
    }

    this.refillBucket(bucket, config);
    return Math.floor(bucket.tokens);
  }

  reset(): void {
    this.buckets.clear();
    this.queue = [];
    this.processingQueue = false;
  }

  private getOrCreateBucket(
    key: string,
    config: RateLimitConfig
  ): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refillBucket(
    bucket: TokenBucket,
    config: RateLimitConfig
  ): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd =
      (timePassed / config.windowMs) * config.maxRequests;

    bucket.tokens = Math.min(
      config.maxRequests,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;
  }

  private calculateWaitTime(
    bucket: TokenBucket,
    config: RateLimitConfig
  ): number {
    const tokensNeeded = 1 - bucket.tokens;
    return (tokensNeeded / config.maxRequests) * config.windowMs;
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];
      if (!request) {
        this.queue.shift();
        continue;
      }

      const config =
        this.configs.get(request.key) || this.configs.get('default');
      if (!config) {
        this.queue.shift();
        request.resolve();
        continue;
      }

      const bucket = this.getOrCreateBucket(request.key, config);
      this.refillBucket(bucket, config);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        this.queue.shift();
        request.resolve();
      } else {
        const waitTime = this.calculateWaitTime(bucket, config);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.processingQueue = false;
  }
}

/**
 * Default rate limit configurations for SP-API endpoints
 * Based on Amazon SP-API documentation (2026)
 */
export const DEFAULT_RATE_LIMITS: Map<string, RateLimitConfig> = new Map([
  // Orders API: getOrders = 0.0167 req/sec (1 per ~60s)
  [
    'orders',
    {
      maxRequests: 1,
      windowMs: 60 * 1000,
      queueRequests: true,
    },
  ],
  // FBA Inventory API: 2 requests per second
  [
    'inventory',
    {
      maxRequests: 2,
      windowMs: 1000,
      queueRequests: true,
    },
  ],
  // Reports API: ~0.0222 req/sec (1 per 45s)
  [
    'reports',
    {
      maxRequests: 1,
      windowMs: 45 * 1000,
      queueRequests: true,
    },
  ],
  // Catalog & Products API: 2 requests per second
  [
    'products',
    {
      maxRequests: 2,
      windowMs: 1000,
      queueRequests: true,
    },
  ],
  // Finances API: 0.5 requests per second
  [
    'finances',
    {
      maxRequests: 1,
      windowMs: 2000,
      queueRequests: true,
    },
  ],
  // Solicitations API: 1 request per 5 seconds
  [
    'solicitations',
    {
      maxRequests: 1,
      windowMs: 5000,
      queueRequests: true,
    },
  ],
  // Default fallback: 1 request per second
  [
    'default',
    {
      maxRequests: 1,
      windowMs: 1000,
      queueRequests: true,
    },
  ],
]);
