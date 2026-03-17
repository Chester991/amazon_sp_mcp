/**
 * FBA Inbound Shipments API tools — read-only access to inbound shipment data
 *
 * Track shipments being sent to Amazon FBA warehouses.
 */

import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'list_inbound_shipments',
    description:
      'List FBA inbound shipments (shipments you send to Amazon warehouses). Filter by status to see WORKING, SHIPPED, RECEIVING, CLOSED, etc. Returns shipment IDs, destinations, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        shipment_statuses: {
          type: 'string',
          description:
            'Comma-separated statuses to filter: WORKING,SHIPPED,RECEIVING,CANCELLED,DELETED,CLOSED,ERROR,IN_TRANSIT,DELIVERED,CHECKED_IN. Optional.',
        },
        shipment_ids: {
          type: 'string',
          description:
            'Comma-separated shipment IDs to look up (e.g., FBA16XXXXX). Optional.',
        },
        last_updated_after: {
          type: 'string',
          description: 'Only return shipments updated after this date (ISO 8601). Optional.',
        },
        last_updated_before: {
          type: 'string',
          description: 'Only return shipments updated before this date (ISO 8601). Optional.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace'],
    },
  },
  {
    name: 'get_inbound_shipment_items',
    description:
      'Get the items (SKUs, quantities, condition) within a specific FBA inbound shipment. Use this to see what products are being sent to Amazon.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        shipment_id: {
          type: 'string',
          description: 'The FBA shipment ID (e.g., FBA16XXXXX).',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token. Optional.',
        },
      },
      required: ['marketplace', 'shipment_id'],
    },
  },
  {
    name: 'get_inbound_guidance',
    description:
      'Get inbound guidance for ASINs — tells you whether Amazon is accepting inbound shipments for specific products, and any restrictions or requirements.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        asins: {
          type: 'string',
          description: 'Comma-separated ASINs to check inbound eligibility (max 50).',
        },
        seller_skus: {
          type: 'string',
          description: 'Comma-separated seller SKUs to check (max 50). Use either asins or seller_skus.',
        },
      },
      required: ['marketplace'],
    },
  },
];

async function listInboundShipments(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
    QueryType: args.shipment_ids ? 'SHIPMENT' : 'DATE_RANGE',
  };

  if (args.shipment_statuses) {
    queryParams.ShipmentStatusList = args.shipment_statuses as string;
  }
  if (args.shipment_ids) {
    queryParams.ShipmentIdList = args.shipment_ids as string;
  }
  if (args.last_updated_after) {
    queryParams.LastUpdatedAfter = args.last_updated_after as string;
  }
  if (args.last_updated_before) {
    queryParams.LastUpdatedBefore = args.last_updated_before as string;
  }
  if (args.next_token) {
    queryParams.NextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/fba/inbound/v0/shipments', queryParams },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getInboundShipmentItems(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const shipmentId = args.shipment_id as string;
  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
  };
  if (args.next_token) {
    queryParams.NextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/fba/inbound/v0/shipments/${encodeURIComponent(shipmentId)}/items`,
      queryParams,
    },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getInboundGuidance(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    MarketplaceId: ctx.marketplaceId,
  };

  if (args.asins) {
    queryParams.ASINList = args.asins as string;
  } else if (args.seller_skus) {
    queryParams.SellerSKUList = args.seller_skus as string;
  } else {
    return 'Error: You must provide either asins or seller_skus parameter.';
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/fba/inbound/v0/itemsGuidance', queryParams },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  list_inbound_shipments: listInboundShipments,
  get_inbound_shipment_items: getInboundShipmentItems,
  get_inbound_guidance: getInboundGuidance,
};
