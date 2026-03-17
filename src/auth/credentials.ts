/**
 * Credential management for Amazon SP-API
 * Supports multi-region (EU + NA) with separate refresh tokens
 */

import { AWSCredentials, LWACredentials } from '../types/sp-api.js';

export interface MultiRegionCredentials {
  aws: AWSCredentials;
  lwaClientId: string;
  lwaClientSecret: string;
  refreshTokenEU?: string;
  refreshTokenNA?: string;
  sellerId: string;
}

/**
 * Load and validate SP-API credentials from environment variables
 * Supports multi-region with separate EU and NA refresh tokens
 */
export class CredentialsManager {
  private credentials: MultiRegionCredentials;

  constructor() {
    this.credentials = this.loadFromEnvironment();
    this.validate();
  }

  private loadFromEnvironment(): MultiRegionCredentials {
    return {
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
      },
      lwaClientId: process.env.LWA_CLIENT_ID || '',
      lwaClientSecret: process.env.LWA_CLIENT_SECRET || '',
      refreshTokenEU: process.env.LWA_REFRESH_TOKEN_EU || undefined,
      refreshTokenNA: process.env.LWA_REFRESH_TOKEN_NA || undefined,
      sellerId: process.env.SELLER_ID || '',
    };
  }

  private validate(): void {
    const errors: string[] = [];

    if (!this.credentials.aws.accessKeyId) {
      errors.push('AWS_ACCESS_KEY_ID is required');
    }
    if (!this.credentials.aws.secretAccessKey) {
      errors.push('AWS_SECRET_ACCESS_KEY is required');
    }
    if (!this.credentials.lwaClientId) {
      errors.push('LWA_CLIENT_ID is required');
    }
    if (!this.credentials.lwaClientSecret) {
      errors.push('LWA_CLIENT_SECRET is required');
    }
    if (!this.credentials.sellerId) {
      errors.push('SELLER_ID is required');
    }
    if (!this.credentials.refreshTokenEU && !this.credentials.refreshTokenNA) {
      errors.push(
        'At least one refresh token is required: LWA_REFRESH_TOKEN_EU or LWA_REFRESH_TOKEN_NA'
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `Missing required credentials:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }
  }

  getAWSCredentials(): AWSCredentials {
    return this.credentials.aws;
  }

  getSellerId(): string {
    return this.credentials.sellerId;
  }

  /**
   * Get LWA credentials for a specific region
   * @throws Error if refresh token for the region is not configured
   */
  getLWACredentials(region: 'eu' | 'na'): LWACredentials {
    const refreshToken =
      region === 'eu'
        ? this.credentials.refreshTokenEU
        : this.credentials.refreshTokenNA;

    if (!refreshToken) {
      throw new Error(
        `No refresh token configured for ${region.toUpperCase()} region. ` +
          `Set LWA_REFRESH_TOKEN_${region.toUpperCase()} in your .env file.`
      );
    }

    return {
      clientId: this.credentials.lwaClientId,
      clientSecret: this.credentials.lwaClientSecret,
      refreshToken,
    };
  }

  hasRegion(region: 'eu' | 'na'): boolean {
    return region === 'eu'
      ? !!this.credentials.refreshTokenEU
      : !!this.credentials.refreshTokenNA;
  }
}
