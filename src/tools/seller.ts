/**
 * Sellers API & Notifications API tools — read-only account info
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'get_marketplace_participations',
    description:
      'Get the list of marketplaces where the seller account is registered, including participation status and marketplace details. This does not require a specific marketplace — it returns all of them.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: {
          ...MARKETPLACE_PARAM,
          description:
            'Any marketplace to determine the region (EU or NA). Use "usa" for NA accounts, any EU country for EU accounts.',
        },
      },
      required: ['marketplace'],
    },
  },
  {
    name: 'get_notifications_subscriptions',
    description:
      'Get your current notification subscription for a specific notification type.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        notification_type: {
          type: 'string',
          description:
            'Notification type: ANY_OFFER_CHANGED, FEED_PROCESSING_FINISHED, FBA_OUTBOUND_SHIPMENT_STATUS, FEE_PROMOTION, REPORT_PROCESSING_FINISHED, etc.',
        },
      },
      required: ['marketplace', 'notification_type'],
    },
  },
  {
    name: 'get_notifications_destinations',
    description:
      'Get the list of notification destinations configured for your account.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
      },
      required: ['marketplace'],
    },
  },
];

async function getMarketplaceParticipations(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const response = await ctx.client.request(
    { method: 'GET', path: '/sellers/v1/marketplaceParticipations' },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getNotificationsSubscriptions(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const notificationType = args.notification_type as string;
  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/notifications/v1/subscriptions/${encodeURIComponent(notificationType)}`,
    },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getNotificationsDestinations(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const response = await ctx.client.request(
    { method: 'GET', path: '/notifications/v1/destinations' },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  get_marketplace_participations: getMarketplaceParticipations,
  get_notifications_subscriptions: getNotificationsSubscriptions,
  get_notifications_destinations: getNotificationsDestinations,
};
