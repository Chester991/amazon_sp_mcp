/**
 * Fulfillment Outbound (Multi-Channel) & Product Fees API tools
 *
 * Read-only access to FBA fulfillment data and fee estimates.
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_fulfillment_preview',
    description:
      'Get a fulfillment preview (shipping options, estimated delivery dates, fees) for an order before submitting it. Useful for multi-channel fulfillment cost estimation.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        address_line1: { type: 'string', description: 'Street address line 1.' },
        city: { type: 'string', description: 'City.' },
        state_or_region: { type: 'string', description: 'State/region code.' },
        postal_code: { type: 'string', description: 'Postal/ZIP code.' },
        country_code: { type: 'string', description: 'ISO country code (e.g., US, GB, DE).' },
        items: {
          type: 'string',
          description:
            'JSON array of items, each with sellerSku and quantity. E.g., [{"sellerSku":"SKU1","quantity":1}]',
        },
      },
      required: ['marketplace', 'address_line1', 'city', 'postal_code', 'country_code', 'items'],
    },
  },
  {
    name: 'list_fulfillment_orders',
    description:
      'List multi-channel fulfillment (MCF) orders. Shows outbound fulfillment orders placed through the API or Seller Central.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        query_start_date: {
          type: 'string',
          description: 'Start date (ISO 8601) to filter orders. Optional.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token. Optional.',
        },
      },
      required: ['marketplace'],
    },
  },
  {
    name: 'get_fulfillment_order',
    description:
      'Get details of a specific multi-channel fulfillment order by seller fulfillment order ID.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        seller_fulfillment_order_id: {
          type: 'string',
          description: 'The seller fulfillment order ID.',
        },
      },
      required: ['marketplace', 'seller_fulfillment_order_id'],
    },
  },
  {
    name: 'get_product_fees_estimate',
    description:
      'Estimate the fees (FBA, referral, closing, etc.) for selling a product at a given price. Returns total estimated fees per unit.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asin: {
          type: 'string',
          description: 'The ASIN to estimate fees for.',
        },
        price: {
          type: 'number',
          description: 'The listing price in marketplace currency.',
        },
        currency: {
          type: 'string',
          description: 'ISO currency code (e.g., USD, GBP, EUR). Default: inferred from marketplace.',
        },
        is_fba: {
          type: 'boolean',
          description: 'Whether the item is fulfilled by Amazon (FBA). Default: true.',
        },
      },
      required: ['marketplace', 'asin', 'price'],
    },
  },
];

async function getFulfillmentPreview(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  let items: Array<{ sellerSku: string; quantity: number }>;
  try {
    items = JSON.parse(args.items as string);
  } catch {
    return 'Error: items parameter must be valid JSON. E.g., [{"sellerSku":"SKU1","quantity":1}]';
  }

  const body = {
    marketplaceId: ctx.marketplaceId,
    address: {
      addressLine1: args.address_line1 as string,
      city: args.city as string,
      stateOrRegion: args.state_or_region as string || '',
      postalCode: args.postal_code as string,
      countryCode: args.country_code as string,
    },
    items: items.map((item, i) => ({
      sellerSku: item.sellerSku,
      quantity: item.quantity,
      sellerFulfillmentOrderItemId: `item-${i}`,
    })),
  };

  const response = await ctx.client.request(
    { method: 'POST', path: '/fba/outbound/2020-07-01/fulfillmentOrders/preview', body },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function listFulfillmentOrders(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {};
  if (args.query_start_date) {
    queryParams.queryStartDate = args.query_start_date as string;
  }
  if (args.next_token) {
    queryParams.nextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/fba/outbound/2020-07-01/fulfillmentOrders', queryParams },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getFulfillmentOrder(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.seller_fulfillment_order_id as string;
  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/fba/outbound/2020-07-01/fulfillmentOrders/${encodeURIComponent(orderId)}`,
    },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

const MARKETPLACE_CURRENCIES: Record<string, string> = {
  ATVPDKIKX0DER: 'USD',
  A1PA6795UKMFR9: 'EUR',
  A13V1IB3VIYZZH: 'EUR',
  APJ6JRA9NG5V4: 'EUR',
  A1RKKUPIHCS9HS: 'EUR',
  A1805IZSGTT6HS: 'EUR',
  AMEN7PMS3EDWL: 'EUR',
  A2NODRKZP88ZB9: 'SEK',
  A1C3SOZRARQ6R3: 'PLN',
  A1F83G8C2ARO7P: 'GBP',
};

async function getProductFeesEstimate(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const asin = args.asin as string;
  const price = args.price as number;
  const currency = (args.currency as string) || MARKETPLACE_CURRENCIES[ctx.marketplaceId] || 'USD';
  const isFba = args.is_fba !== false;

  const body = {
    FeesEstimateRequest: {
      MarketplaceId: ctx.marketplaceId,
      IsAmazonFulfilled: isFba,
      PriceToEstimateFees: {
        ListingPrice: {
          CurrencyCode: currency,
          Amount: price,
        },
      },
      Identifier: `fee-est-${asin}-${Date.now()}`,
    },
  };

  const response = await ctx.client.request(
    {
      method: 'POST',
      path: `/products/fees/v0/items/${encodeURIComponent(asin)}/feesEstimate`,
      body,
    },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_fulfillment_preview: getFulfillmentPreview,
  list_fulfillment_orders: listFulfillmentOrders,
  get_fulfillment_order: getFulfillmentOrder,
  get_product_fees_estimate: getProductFeesEstimate,
};
