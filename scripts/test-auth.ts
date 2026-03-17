#!/usr/bin/env tsx

/**
 * Manual test script for authentication with REAL Amazon credentials
 * Run with: npm run test:manual-auth
 *
 * Tests both EU and NA regions if tokens are configured.
 */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { CredentialsManager } from '../src/auth/credentials.js';
import { TokenManager } from '../src/auth/token-manager.js';
import { signRequest } from '../src/utils/aws-signature.js';

dotenv.config();

async function testAuthentication() {
  console.log('Testing Amazon SP-API Authentication Flow\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Load and validate credentials
    console.log('\nStep 1: Loading credentials from .env file...');
    const credManager = new CredentialsManager();
    console.log('Credentials loaded and validated successfully!');

    const awsCreds = credManager.getAWSCredentials();
    const sellerId = credManager.getSellerId();

    console.log('\nCredential Summary:');
    console.log(`  AWS Access Key: ${awsCreds.accessKeyId.substring(0, 8)}...`);
    console.log(`  Seller ID: ${sellerId}`);
    console.log(`  EU token configured: ${credManager.hasRegion('eu')}`);
    console.log(`  NA token configured: ${credManager.hasRegion('na')}`);

    // Test each configured region
    const regions: Array<'eu' | 'na'> = [];
    if (credManager.hasRegion('eu')) regions.push('eu');
    if (credManager.hasRegion('na')) regions.push('na');

    for (const region of regions) {
      console.log(`\n--- Testing ${region.toUpperCase()} Region ---`);

      const lwaCreds = credManager.getLWACredentials(region);
      console.log(`  LWA Client ID: ${lwaCreds.clientId.substring(0, 20)}...`);

      // Step 2: Test LWA token exchange
      console.log(`  Requesting ${region.toUpperCase()} access token...`);
      const tokenManager = new TokenManager(lwaCreds);
      const accessToken = await tokenManager.getAccessToken();

      if (accessToken && accessToken.length > 0) {
        console.log(`  Access token received (${accessToken.length} chars)`);
        console.log(`  Cached: ${tokenManager.hasCachedToken() ? 'Yes' : 'No'}`);
      } else {
        throw new Error(`Received empty access token for ${region.toUpperCase()}`);
      }

      // Step 3: Test token caching
      const startTime = Date.now();
      const cachedToken = await tokenManager.getAccessToken();
      const cacheTime = Date.now() - startTime;

      if (cachedToken === accessToken) {
        console.log(`  Cache retrieval: ${cacheTime}ms`);
      }

      // Step 4: Test AWS Signature V4
      const endpoint =
        region === 'eu'
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sellingpartnerapi-na.amazon.com';
      const signingRegion = region === 'eu' ? 'eu-west-1' : 'us-east-1';

      const testRequest = {
        method: 'GET',
        url: `${endpoint}/sellers/v1/marketplaceParticipations`,
        headers: {
          'x-amz-access-token': accessToken,
        },
      };

      const signedHeaders = signRequest(testRequest, {
        ...awsCreds,
        region: signingRegion,
      });

      if (signedHeaders.Authorization && signedHeaders['X-Amz-Date']) {
        console.log(`  ${region.toUpperCase()} signing: OK`);
      } else {
        throw new Error(`Failed to sign request for ${region.toUpperCase()}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nSUCCESS! All authentication tests passed!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('\nAUTHENTICATION TEST FAILED\n');

    if (error instanceof Error) {
      console.error('Error:', error.message);

      if (error.message.includes('Missing required credentials')) {
        console.error('\nFix: Make sure your .env file has all required credentials');
        console.error('   Run: cp .env.example .env');
        console.error('   Then fill in your actual credentials');
      } else if (error.message.includes('invalid_grant')) {
        console.error('\nFix: Your refresh token is invalid or expired');
        console.error('   You need to re-authorize and get a new refresh token');
      } else if (error.message.includes('invalid_client')) {
        console.error('\nFix: Your LWA_CLIENT_ID or LWA_CLIENT_SECRET is incorrect');
      } else if (
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')
      ) {
        console.error('\nFix: Network connection issue');
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n');
    process.exit(1);
  }
}

testAuthentication();
