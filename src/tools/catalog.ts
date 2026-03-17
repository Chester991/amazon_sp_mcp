/**
 * Catalog Items API tools — read-only access to product catalog data
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_product_details',
    description:
      'Get detailed product information for a specific ASIN, including title, brand, category, images, dimensions, and other attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asin: {
          type: 'string',
          description: 'The ASIN (Amazon Standard Identification Number) to look up.',
        },
        included_data: {
          type: 'string',
          description:
            'Comma-separated data sets to include: summaries,attributes,dimensions,identifiers,images,productTypes,relationships,salesRanks. Default: summaries,attributes,images.',
        },
      },
      required: ['marketplace', 'asin'],
    },
  },
  {
    name: 'search_catalog',
    description:
      'Search the Amazon catalog by keywords, returning matching products with ASINs, titles, and other details.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        keywords: {
          type: 'string',
          description: 'Search keywords (e.g., "wireless headphones").',
        },
        included_data: {
          type: 'string',
          description:
            'Comma-separated data sets: summaries,attributes,dimensions,identifiers,images,productTypes,relationships,salesRanks. Default: summaries.',
        },
        page_size: {
          type: 'number',
          description: 'Number of results per page (1-20). Default: 10.',
        },
        page_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace', 'keywords'],
    },
  },
  {
    name: 'get_listing_details',
    description:
      'Get listing details for a specific SKU, including offer, issues, attributes, and fulfillment availability.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        sku: {
          type: 'string',
          description: 'The seller SKU to look up.',
        },
        included_data: {
          type: 'string',
          description:
            'Comma-separated data: summaries,attributes,issues,offers,fulfillmentAvailability,procurement. Default: summaries,attributes,issues,offers.',
        },
      },
      required: ['marketplace', 'sku'],
    },
  },
];

async function getProductDetails(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const asin = args.asin as string;
  const includedData =
    (args.included_data as string) || 'summaries,attributes,images';

  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
    includedData,
  };

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/catalog/2022-04-01/items/${encodeURIComponent(asin)}`,
      queryParams,
    },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

async function searchCatalog(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
    keywords: args.keywords as string,
    includedData: (args.included_data as string) || 'summaries',
  };
  if (args.page_size) {
    queryParams.pageSize = String(Math.min(Number(args.page_size), 20));
  }
  if (args.page_token) {
    queryParams.pageToken = args.page_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/catalog/2022-04-01/items', queryParams },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getListingDetails(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const sku = args.sku as string;
  const includedData =
    (args.included_data as string) ||
    'summaries,attributes,issues,offers';

  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
    includedData,
  };

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/listings/2021-08-01/items/${encodeURIComponent(ctx.sellerId)}/${encodeURIComponent(sku)}`,
      queryParams,
    },
    'products'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_product_details: getProductDetails,
  search_catalog: searchCatalog,
  get_listing_details: getListingDetails,
};
