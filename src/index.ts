#!/usr/bin/env node

/**
 * Amazon Seller Central MCP Server
 *
 * Read-only MCP server for Amazon SP-API with multi-region support (EU + NA).
 * Compliant with Amazon's Agent Policy (March 2026).
 *
 * Supports 10 marketplaces: USA, Germany, France, Italy, Spain,
 * Netherlands, Belgium, Sweden, Poland, UK.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { MultiRegionManager } from './config/sp-api.js';
import { getMarketplaceConfig } from './config/marketplaces.js';
import { allDefinitions, allHandlers } from './tools/index.js';
import { ToolContext } from './tools/types.js';

dotenv.config();

class AmazonSellerCentralServer {
  private server: Server;
  private regionManager: MultiRegionManager;

  constructor() {
    this.regionManager = new MultiRegionManager();

    this.server = new Server(
      {
        name: 'amazon-seller-central',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: allDefinitions };
    });

    // Handle tool calls
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;
        const typedArgs = (args ?? {}) as Record<string, unknown>;

        try {
          const handler = allHandlers[name];
          if (!handler) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${name}. Use ListTools to see available tools.`,
                },
              ],
              isError: true,
            };
          }

          // All tools require a marketplace parameter
          const marketplace = typedArgs.marketplace as string | undefined;
          if (!marketplace) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required parameter: marketplace. Valid values: usa, germany, france, italy, spain, netherlands, belgium, sweden, poland, uk.',
                },
              ],
              isError: true,
            };
          }

          // Validate marketplace and build context
          const mpConfig = getMarketplaceConfig(marketplace);
          const client = this.regionManager.getClient(marketplace);
          const ctx: ToolContext = {
            client,
            marketplaceId: mpConfig.id,
            sellerId: this.regionManager.getSellerId(),
          };

          const result = await handler(typedArgs, ctx);

          return {
            content: [{ type: 'text', text: result }],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(`[Tool Error] ${name}:`, message);

          return {
            content: [
              {
                type: 'text',
                text: `Error calling ${name}: ${message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(
      'Amazon Seller Central MCP Server v1.0.0 running on stdio'
    );
    console.error(
      `Available tools: ${allDefinitions.length} read-only tools`
    );
  }
}

async function main(): Promise<void> {
  try {
    const server = new AmazonSellerCentralServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
