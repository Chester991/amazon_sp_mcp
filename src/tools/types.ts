/**
 * Shared types for MCP tool definitions and handlers
 */

import { SPAPIClient } from '../utils/sp-api-client.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolContext {
  client: SPAPIClient;
  marketplaceId: string;
  sellerId: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<string>;

export const MARKETPLACE_PARAM = {
  type: 'string' as const,
  description:
    'Country marketplace to query (usa, germany, france, italy, spain, netherlands, belgium, sweden, poland, uk)',
  enum: [
    'usa',
    'germany',
    'france',
    'italy',
    'spain',
    'netherlands',
    'belgium',
    'sweden',
    'poland',
    'uk',
  ],
};
