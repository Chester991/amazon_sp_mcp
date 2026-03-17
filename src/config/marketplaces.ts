/**
 * Marketplace definitions for Amazon SP-API
 * Maps country names to marketplace IDs, regions, endpoints, and AWS signing regions
 */

export interface MarketplaceConfig {
  id: string;
  region: 'eu' | 'na';
  endpoint: string;
  awsRegion: string;
  country: string;
}

export const MARKETPLACES: Record<string, MarketplaceConfig> = {
  usa: {
    id: 'ATVPDKIKX0DER',
    region: 'na',
    endpoint: 'https://sellingpartnerapi-na.amazon.com',
    awsRegion: 'us-east-1',
    country: 'United States',
  },
  germany: {
    id: 'A1PA6795UKMFR9',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Germany',
  },
  france: {
    id: 'A13V1IB3VIYZZH',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'France',
  },
  italy: {
    id: 'APJ6JRA9NG5V4',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Italy',
  },
  spain: {
    id: 'A1RKKUPIHCS9HS',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Spain',
  },
  netherlands: {
    id: 'A1805IZSGTT6HS',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Netherlands',
  },
  belgium: {
    id: 'AMEN7PMS3EDWL',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Belgium',
  },
  sweden: {
    id: 'A2NODRKZP88ZB9',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Sweden',
  },
  poland: {
    id: 'A1C3SOZRARQ6R3',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'Poland',
  },
  uk: {
    id: 'A1F83G8C2ARO7P',
    region: 'eu',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    awsRegion: 'eu-west-1',
    country: 'United Kingdom',
  },
};

export function getMarketplaceConfig(marketplace: string): MarketplaceConfig {
  const config = MARKETPLACES[marketplace.toLowerCase()];
  if (!config) {
    const valid = Object.keys(MARKETPLACES).join(', ');
    throw new Error(`Unknown marketplace: "${marketplace}". Valid values: ${valid}`);
  }
  return config;
}

export const MARKETPLACE_NAMES = Object.keys(MARKETPLACES);
