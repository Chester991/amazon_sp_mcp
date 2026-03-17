/**
 * Feeds API tools — submit and monitor data feeds
 *
 * Feeds allow bulk data submission to Amazon (inventory updates,
 * pricing changes, etc.). This module provides read access to
 * feed status and results, plus the ability to submit feeds.
 */

import axios from 'axios';
import { gunzipSync } from 'zlib';
import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

export const definitions: ToolDefinition[] = [
  {
    name: 'list_feeds',
    description:
      'List previously submitted feeds, optionally filtered by type and status. Shows feed IDs, types, processing status, and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        feed_types: {
          type: 'string',
          description:
            'Comma-separated feed types to filter. Optional.',
        },
        processing_statuses: {
          type: 'string',
          description:
            'Comma-separated statuses: CANCELLED,DONE,FATAL,IN_PROGRESS,IN_QUEUE. Optional.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum results (1-100). Default: 10.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token. Optional.',
        },
      },
      required: ['marketplace'],
    },
  },
  {
    name: 'get_feed',
    description:
      'Get the status and details of a specific feed by feed ID.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        feed_id: {
          type: 'string',
          description: 'The feed ID returned from a feed submission.',
        },
      },
      required: ['marketplace', 'feed_id'],
    },
  },
  {
    name: 'get_feed_document',
    description:
      'Download and return the content of a feed result document. Use after a feed is DONE to see processing results (errors, warnings, successes).',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        feed_document_id: {
          type: 'string',
          description: 'The feedDocumentId from get_feed response.',
        },
        max_lines: {
          type: 'number',
          description: 'Maximum lines to return. Default: 200.',
        },
      },
      required: ['marketplace', 'feed_document_id'],
    },
  },
];

async function listFeeds(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
  };
  if (args.feed_types) {
    queryParams.feedTypes = args.feed_types as string;
  }
  if (args.processing_statuses) {
    queryParams.processingStatuses = args.processing_statuses as string;
  }
  if (args.max_results) {
    queryParams.pageSize = String(Math.min(Number(args.max_results), 100));
  }
  if (args.next_token) {
    queryParams.nextToken = args.next_token as string;
  }

  const response = await ctx.client.request(
    { method: 'GET', path: '/feeds/2021-06-30/feeds', queryParams },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getFeed(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const feedId = args.feed_id as string;
  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/feeds/2021-06-30/feeds/${encodeURIComponent(feedId)}`,
    },
    'default'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getFeedDocument(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const docId = args.feed_document_id as string;
  const maxLines = Math.min(Number(args.max_lines) || 200, 1000);

  const response = await ctx.client.request<{
    url: string;
    compressionAlgorithm?: string;
  }>(
    {
      method: 'GET',
      path: `/feeds/2021-06-30/documents/${encodeURIComponent(docId)}`,
    },
    'default'
  );

  const docMeta = response.data;

  const downloadResponse = await axios.get(docMeta.url, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  let content: string;
  if (docMeta.compressionAlgorithm === 'GZIP') {
    const decompressed = gunzipSync(Buffer.from(downloadResponse.data as ArrayBuffer));
    content = decompressed.toString('utf-8');
  } else {
    content = Buffer.from(downloadResponse.data as ArrayBuffer).toString('utf-8');
  }

  const lines = content.split('\n');
  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines).join('\n');
    return `${truncated}\n\n--- TRUNCATED: Showing ${maxLines} of ${lines.length} lines. ---`;
  }

  return content;
}

export const handlers: Record<string, ToolHandler> = {
  list_feeds: listFeeds,
  get_feed: getFeed,
  get_feed_document: getFeedDocument,
};
