/**
 * Multi-region SP-API configuration and client factory
 * Creates and caches SPAPIClient instances per marketplace
 */

import { CredentialsManager } from '../auth/credentials.js';
import { TokenManager } from '../auth/token-manager.js';
import { SPAPIClient } from '../utils/sp-api-client.js';
import { RateLimiter, DEFAULT_RATE_LIMITS } from '../utils/rate-limiter.js';
import { getMarketplaceConfig } from './marketplaces.js';

export class MultiRegionManager {
  private credentialsManager: CredentialsManager;
  private tokenManagers: Map<string, TokenManager> = new Map();
  private clients: Map<string, SPAPIClient> = new Map();
  private rateLimiter: RateLimiter;

  constructor() {
    this.credentialsManager = new CredentialsManager();
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);
  }

  /**
   * Get an SPAPIClient configured for the specified marketplace
   */
  getClient(marketplace: string): SPAPIClient {
    const key = marketplace.toLowerCase();
    const cached = this.clients.get(key);
    if (cached) {
      return cached;
    }

    const mpConfig = getMarketplaceConfig(marketplace);
    const tokenManager = this.getTokenManager(mpConfig.region);
    const awsCreds = this.credentialsManager.getAWSCredentials();

    const client = new SPAPIClient({
      endpoint: mpConfig.endpoint,
      marketplaceId: mpConfig.id,
      awsCredentials: {
        accessKeyId: awsCreds.accessKeyId,
        secretAccessKey: awsCreds.secretAccessKey,
        region: mpConfig.awsRegion,
      },
      tokenManager,
      rateLimiter: this.rateLimiter,
    });

    this.clients.set(key, client);
    return client;
  }

  /**
   * Get the marketplace ID for a given marketplace name
   */
  getMarketplaceId(marketplace: string): string {
    return getMarketplaceConfig(marketplace).id;
  }

  /**
   * Get the seller ID
   */
  getSellerId(): string {
    return this.credentialsManager.getSellerId();
  }

  private getTokenManager(region: 'eu' | 'na'): TokenManager {
    const cached = this.tokenManagers.get(region);
    if (cached) {
      return cached;
    }

    const lwaCreds = this.credentialsManager.getLWACredentials(region);
    const tm = new TokenManager(lwaCreds);
    this.tokenManagers.set(region, tm);
    return tm;
  }
}
