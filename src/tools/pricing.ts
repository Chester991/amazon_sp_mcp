/**
 * Product Pricing API tools — read-only access to pricing data
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_my_pricing',
    description:
      'Get your current pricing for specific ASINs or SKUs, including landed price, listing price, and shipping.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asins: {
          type: 'string',
          description:
            'Comma-separated ASINs to look up (max 20). Use either asins or skus, not both.',
        },
        skus: {
          type: 'string',
          description:
            'Comma-separated SKUs to look up (max 20). Use either asins or skus, not both.',
        },
      },
      required: ['marketplace'],
    },
  },
  {
    name: 'get_competitive_pricing',
    description:
      'Get competitive pricing information for ASINs, including Buy Box price, number of offers, and sales rank.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asins: {
          type: 'string',
          description: 'Comma-separated ASINs to look up (max 20).',
        },
      },
      required: ['marketplace', 'asins'],
    },
  },
  {
    name: 'get_item_offers',
    description:
      'Get all offers (from all sellers) for a specific ASIN, including price, condition, shipping, and seller feedback data.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asin: {
          type: 'string',
          description: 'The ASIN to get offers for.',
        },
        item_condition: {
          type: 'string',
          description:
            'Item condition filter: New, Used, Collectible, Refurbished, Club. Default: New.',
          enum: ['New', 'Used', 'Collectible', 'Refurbished', 'Club'],
        },
      },
      required: ['marketplace', 'asin'],
    },
  },
];

async function getMyPricing(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
  };

  if (args.asins) {
    queryParams.Asins = args.asins as string;
    queryParams.ItemType = 'Asin';
  } else if (args.skus) {
    queryParams.Skus = args.skus as string;
    queryParams.ItemType = 'Sku';
  } else {
    return 'Error: You must provide either asins or skus parameter.';
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/products/pricing/v0/price', queryParams },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getCompetitivePricing(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
    Asins: args.asins as string,
    ItemType: 'Asin',
  };

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: '/products/pricing/v0/competitivePrice',
      queryParams,
    },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getItemOffers(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const asin = args.asin as string;
  const condition = (args.item_condition as string) || 'New';

  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
    ItemCondition: condition,
  };

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/products/pricing/v0/items/${encodeURIComponent(asin)}/offers`,
      queryParams,
    },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_my_pricing: getMyPricing,
  get_competitive_pricing: getCompetitivePricing,
  get_item_offers: getItemOffers,
};
