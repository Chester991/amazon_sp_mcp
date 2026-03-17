/**
 * Finances API tools — read-only access to financial data
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_financial_events',
    description:
      'Get financial events (charges, fees, refunds, adjustments) for your seller account within a date range. Includes order-level and account-level financial transactions.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        posted_after: {
          type: 'string',
          description:
            'Start date in ISO 8601 (e.g., 2026-01-01T00:00:00Z). Required.',
        },
        posted_before: {
          type: 'string',
          description:
            'End date in ISO 8601 (e.g., 2026-01-31T23:59:59Z). Optional, defaults to now.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace', 'posted_after'],
    },
  },
  {
    name: 'get_financial_event_groups',
    description:
      'Get financial event groups (settlement periods) within a date range. Each group represents a settlement cycle with totals for charges, refunds, and disbursements.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        started_after: {
          type: 'string',
          description:
            'Start date in ISO 8601 for when the financial event group started. Required.',
        },
        started_before: {
          type: 'string',
          description:
            'End date in ISO 8601. Optional, defaults to now.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace', 'started_after'],
    },
  },
];

async function getFinancialEvents(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    PostedAfter: args.posted_after as string,
  };
  if (args.posted_before) {
    queryParams.PostedBefore = args.posted_before as string;
  }
  if (args.next_token) {
    queryParams.NextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/finances/v0/financialEvents', queryParams },
    'finances'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getFinancialEventGroups(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    FinancialEventGroupStartedAfter: args.started_after as string,
  };
  if (args.started_before) {
    queryParams.FinancialEventGroupStartedBefore =
      args.started_before as string;
  }
  if (args.next_token) {
    queryParams.NextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: '/finances/v0/financialEventGroups',
      queryParams,
    },
    'finances'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_financial_events: getFinancialEvents,
  get_financial_event_groups: getFinancialEventGroups,
};
