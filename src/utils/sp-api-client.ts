/**
 * HTTP client for Amazon SP-API
 * Handles authentication, rate limiting, error handling, retries,
 * and Amazon Agent Policy compliance (User-Agent header)
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import type {
  SPAPIRequestOptions,
  SPAPIResponse,
  SPAPIErrorResponse,
  RetryConfig,
  AWSCredentials,
} from '../types/sp-api.js';
import { TokenManager } from '../auth/token-manager.js';
import { signRequest } from './aws-signature.js';
import { RateLimiter, DEFAULT_RATE_LIMITS } from './rate-limiter.js';
import {
  SPAPIError,
  SPAPIRequestError,
  SPAPIServerError,
  RateLimitError,
  SPAPIAuthError,
  SPAPIValidationError,
} from './errors.js';

/**
 * User-Agent header for Amazon Agent Policy compliance (effective March 4, 2026)
 * Format: Agent/[AgentName] AppName/Version (Language=...; Platform=...)
 * Must identify as an automated agent per Amazon BSA Section 19
 */
const USER_AGENT =
  'Agent/OpenClawMCP amazon-sp-mcp/1.0 (Language=JavaScript; Platform=Node.js)';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryDelay: 1000,
  backoffMultiplier: 2,
};

export interface SPAPIClientOptions {
  endpoint: string;
  marketplaceId: string;
  awsCredentials: AWSCredentials;
  tokenManager: TokenManager;
  rateLimiter?: RateLimiter;
  retryConfig?: Partial<RetryConfig>;
}

/**
 * SP-API HTTP Client
 *
 * Features:
 * - Automatic authentication (LWA OAuth 2.0)
 * - AWS Signature V4 signing
 * - Rate limiting per endpoint
 * - Automatic retries with exponential backoff + jitter
 * - Amazon Agent Policy compliant User-Agent header
 * - Comprehensive error handling
 */
export class SPAPIClient {
  private endpoint: string;
  private marketplaceId: string;
  private awsCredentials: AWSCredentials;
  private tokenManager: TokenManager;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  constructor(options: SPAPIClientOptions) {
    this.endpoint = options.endpoint;
    this.marketplaceId = options.marketplaceId;
    this.awsCredentials = options.awsCredentials;
    this.tokenManager = options.tokenManager;
    this.rateLimiter =
      options.rateLimiter || new RateLimiter(DEFAULT_RATE_LIMITS);
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.retryConfig,
    };
  }

  /**
   * Make an authenticated request to SP-API
   */
  async request<T = unknown>(
    options: SPAPIRequestOptions,
    endpointKey: string = 'default'
  ): Promise<SPAPIResponse<T>> {
    await this.rateLimiter.acquire(endpointKey);
    return await this.requestWithRetry<T>(options, 0);
  }

  private async requestWithRetry<T>(
    options: SPAPIRequestOptions,
    attemptNumber: number
  ): Promise<SPAPIResponse<T>> {
    try {
      return await this.makeRequest<T>(options);
    } catch (error) {
      const shouldRetry =
        attemptNumber < this.retryConfig.maxRetries &&
        this.isRetryableError(error);

      if (shouldRetry) {
        // Exponential backoff with jitter to avoid thundering herd
        const baseDelay =
          this.retryConfig.retryDelay *
          Math.pow(this.retryConfig.backoffMultiplier, attemptNumber);
        const jitter = Math.random() * this.retryConfig.retryDelay;
        const delay = baseDelay + jitter;

        if (error instanceof RateLimitError && error.retryAfter) {
          // Respect Amazon's Retry-After header
          await this.sleep(error.retryAfter * 1000);
        } else {
          await this.sleep(delay);
        }

        return await this.requestWithRetry<T>(options, attemptNumber + 1);
      }

      throw error;
    }
  }

  private async makeRequest<T>(
    options: SPAPIRequestOptions
  ): Promise<SPAPIResponse<T>> {
    const accessToken = await this.tokenManager.getAccessToken();

    const url = new URL(options.path, this.endpoint);
    if (options.queryParams) {
      Object.entries(options.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Headers include User-Agent for Amazon Agent Policy compliance
    const headers: Record<string, string> = {
      'x-amz-access-token': accessToken,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      ...options.headers,
    };

    // Sign request with AWS Signature V4
    const signedHeaders = signRequest(
      {
        method: options.method,
        url: url.toString(),
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
      this.awsCredentials
    );

    Object.assign(headers, signedHeaders);

    try {
      const response: AxiosResponse<T> = await axios({
        method: options.method,
        url: url.toString(),
        headers,
        data: options.body,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        throw this.createErrorFromResponse(response);
      }

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      if (error instanceof SPAPIError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        throw this.createErrorFromAxiosError(error);
      }

      throw new SPAPIError(
        `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private createErrorFromResponse(response: AxiosResponse): SPAPIError {
    const statusCode = response.status;
    const data = response.data as SPAPIErrorResponse | undefined;

    let message = `SP-API request failed with status ${statusCode}`;
    let code: string | undefined;
    let details: unknown;

    if (data && data.errors && data.errors.length > 0) {
      const firstError = data.errors[0];
      if (firstError) {
        message = firstError.message;
        code = firstError.code;
        details = data.errors.length > 1 ? data.errors : firstError.details;
      }
    }

    if (statusCode === 429) {
      const retryAfter = response.headers['retry-after']
        ? parseInt(response.headers['retry-after'], 10)
        : undefined;
      return new RateLimitError(
        message || 'Rate limit exceeded',
        retryAfter,
        details
      );
    }

    if (statusCode === 401 || statusCode === 403) {
      return new SPAPIAuthError(
        message || 'Authentication failed',
        details
      );
    }

    if (statusCode === 400) {
      return new SPAPIValidationError(
        message || 'Invalid request',
        details
      );
    }

    if (statusCode >= 400 && statusCode < 500) {
      return new SPAPIRequestError(message, statusCode, code, details);
    }

    if (statusCode >= 500) {
      return new SPAPIServerError(message, statusCode, code, details);
    }

    return new SPAPIError(message, code, statusCode, details);
  }

  private createErrorFromAxiosError(error: AxiosError): SPAPIError {
    if (error.response) {
      return this.createErrorFromResponse(error.response);
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new SPAPIError('Request timeout');
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new SPAPIError('Network error: Unable to reach SP-API');
    }

    return new SPAPIError(
      error.message || 'HTTP request failed',
      error.code
    );
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof SPAPIError)) {
      return false;
    }

    if (!error.statusCode) {
      return false;
    }

    return this.retryConfig.retryableStatusCodes.includes(error.statusCode);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getMarketplaceId(): string {
    return this.marketplaceId;
  }
}
