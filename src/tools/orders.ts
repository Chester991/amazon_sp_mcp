/**
 * Orders API tools — read-only access to Amazon order data
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_orders',
    description:
      'Get a list of orders for a marketplace within a date range. Returns order IDs, statuses, amounts, shipping info, and dates.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        created_after: {
          type: 'string',
          description:
            'Start date in ISO 8601 format (e.g., 2026-01-01T00:00:00Z). Required.',
        },
        created_before: {
          type: 'string',
          description:
            'End date in ISO 8601 format (e.g., 2026-01-31T23:59:59Z). Optional, defaults to now.',
        },
        order_statuses: {
          type: 'string',
          description:
            'Comma-separated order statuses to filter (e.g., Shipped,Unshipped,Canceled). Optional.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of orders to return (1-100). Default: 20.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace', 'created_after'],
    },
  },
  {
    name: 'get_order_details',
    description:
      'Get detailed information about a specific order by order ID, including buyer info, shipping address, and payment details.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        order_id: {
          type: 'string',
          description: 'The Amazon order ID (e.g., 302-1234567-8901234)',
        },
      },
      required: ['marketplace', 'order_id'],
    },
  },
  {
    name: 'get_order_items',
    description:
      'Get the line items (products) within a specific order, including ASINs, SKUs, quantities, and prices.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        order_id: {
          type: 'string',
          description: 'The Amazon order ID',
        },
      },
      required: ['marketplace', 'order_id'],
    },
  },
];

async function getOrders(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    MarketplaceIds: ctx.marketplaceId,
    CreatedAfter: args.created_after as string,
  };
  if (args.created_before) {
    queryParams.CreatedBefore = args.created_before as string;
  }
  if (args.order_statuses) {
    queryParams.OrderStatuses = args.order_statuses as string;
  }
  if (args.max_results) {
    queryParams.MaxResultsPerPage = String(
      Math.min(Number(args.max_results), 100)
    );
  }
  if (args.next_token) {
    queryParams.NextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/orders/v0/orders', queryParams },
    'orders'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getOrderDetails(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;
  const response = await ctx.client.request(
    { method: 'GET', path: `/orders/v0/orders/${encodeURIComponent(orderId)}` },
    'orders'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getOrderItems(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;
  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`,
    },
    'orders'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_orders: getOrders,
  get_order_details: getOrderDetails,
  get_order_items: getOrderItems,
};
