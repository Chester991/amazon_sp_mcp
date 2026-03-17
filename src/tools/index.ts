/**
 * Tool registry — aggregates all tool definitions and handlers
 */

import { ToolDefinition, ToolHandler } from './types.js';

import * as orders from './orders.js';
import * as inventory from './inventory.js';
import * as reports from './reports.js';
import * as catalog from './catalog.js';
import * as finances from './finances.js';
import * as pricing from './pricing.js';
import * as sales from './sales.js';
import * as seller from './seller.js';
import * as solicitations from './solicitations.js';
import * as fbaInbound from './fba-inbound.js';
import * as fulfillment from './fulfillment.js';
import * as feeds from './feeds.js';

export type { ToolDefinition, ToolHandler, ToolContext } from './types.js';

export const allDefinitions: ToolDefinition[] = [
  ...orders.definitions,
  ...inventory.definitions,
  ...reports.definitions,
  ...catalog.definitions,
  ...finances.definitions,
  ...pricing.definitions,
  ...sales.definitions,
  ...seller.definitions,
  ...solicitations.definitions,
  ...fbaInbound.definitions,
  ...fulfillment.definitions,
  ...feeds.definitions,
];

export const allHandlers: Record<string, ToolHandler> = {
  ...orders.handlers,
  ...inventory.handlers,
  ...reports.handlers,
  ...catalog.handlers,
  ...finances.handlers,
  ...pricing.handlers,
  ...sales.handlers,
  ...seller.handlers,
  ...solicitations.handlers,
  ...fbaInbound.handlers,
  ...fulfillment.handlers,
  ...feeds.handlers,
};
