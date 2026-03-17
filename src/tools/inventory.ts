/**
 * FBA Inventory API tools — read-only access to inventory data
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_fba_inventory',
    description:
      'Get FBA inventory summaries for a marketplace. Shows fulfillable, reserved, inbound, unfulfillable, and researching quantities per SKU/ASIN. Use this to check stock levels.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        skus: {
          type: 'string',
          description:
            'Comma-separated list of seller SKUs to filter. Optional — omit to get all inventory.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace'],
    },
  },
];

async function getFbaInventory(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    granularityType: 'Marketplace',
    granularityId: ctx.marketplaceId,
    marketplaceIds: ctx.marketplaceId,
    details: 'true',
  };
  if (args.skus) {
    queryParams.sellerSkus = args.skus as string;
  }
  if (args.next_token) {
    queryParams.nextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/fba/inventory/v1/summaries', queryParams },
    'inventory'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_fba_inventory: getFbaInventory,
};
