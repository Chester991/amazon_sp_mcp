/**
 * Sales API tools — read-only access to sales and traffic metrics
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_sales_metrics',
    description:
      'Get aggregated sales metrics (units ordered, order revenue, order count) for a marketplace within a date range. Supports daily, weekly, monthly, or total granularity.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        start_date: {
          type: 'string',
          description:
            'Start date in ISO 8601 (e.g., 2026-01-01T00:00:00Z). Required.',
        },
        end_date: {
          type: 'string',
          description:
            'End date in ISO 8601 (e.g., 2026-01-31T23:59:59Z). Required.',
        },
        granularity: {
          type: 'string',
          description:
            'Data granularity: Hour, Day, Week, Month, Year, Total. Default: Day.',
          enum: ['Hour', 'Day', 'Week', 'Month', 'Year', 'Total'],
        },
        asin: {
          type: 'string',
          description:
            'Filter by specific ASIN. Optional — omit for all products.',
        },
        sku: {
          type: 'string',
          description:
            'Filter by specific SKU. Optional — omit for all products.',
        },
      },
      required: ['marketplace', 'start_date', 'end_date'],
    },
  },
];

async function getSalesMetrics(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const startDate = args.start_date as string;
  const endDate = args.end_date as string;
  const granularity = (args.granularity as string) || 'Day';

  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
    interval: `${startDate}--${endDate}`,
    granularity,
  };

  if (args.asin) {
    queryParams.asin = args.asin as string;
  }
  if (args.sku) {
    queryParams.sku = args.sku as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/sales/v1/orderMetrics', queryParams },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_sales_metrics: getSalesMetrics,
};
