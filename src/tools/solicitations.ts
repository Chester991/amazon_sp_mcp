/**
 * Solicitations API tools — Request a Review automation
 *
 * Uses Amazon's official Solicitations API to send review/feedback
 * request emails (same as the "Request a Review" button in Seller Central).
 *
 * Rate limits: 1 request per 5 seconds for createProductReview
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'review-requests.jsonl');

interface ReviewRequestLog {
  timestamp: string;
  orderId: string;
  marketplace: string;
  marketplaceId: string;
  status: 'success' | 'error' | 'not_eligible';
  message: string;
}

function logReviewRequest(entry: ReviewRequestLog): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[Review Log Error]', err);
  }
}

export const definitions: ToolDefinition[] = [
  {
    name: 'check_review_eligibility',
    description:
      'Check if an order is eligible for a "Request a Review" solicitation. Returns available solicitation actions for the order. An order is typically eligible 5-30 days after delivery.',
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
    name: 'request_review',
    description:
      'Send an official "Request a Review" email to the buyer for a specific order. This uses Amazon\'s official Solicitations API — the same as clicking the "Request a Review" button in Seller Central. The email is auto-translated to the buyer\'s language. Only works 5-30 days after delivery. One request per order.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        order_id: {
          type: 'string',
          description: 'The Amazon order ID to request a review for',
        },
      },
      required: ['marketplace', 'order_id'],
    },
  },
  {
    name: 'bulk_request_reviews',
    description:
      'Send "Request a Review" emails for multiple orders at once. Automatically checks eligibility and skips ineligible orders. Enforces rate limiting (1 request per 5 seconds). Returns a summary of successes, failures, and skipped orders.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        order_ids: {
          type: 'string',
          description:
            'Comma-separated list of Amazon order IDs (e.g., 302-1234567-8901234,302-9876543-2109876)',
        },
      },
      required: ['marketplace', 'order_ids'],
    },
  },
  {
    name: 'get_review_request_log',
    description:
      'View the log of all review request attempts. Shows successes, failures, and skipped orders with timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return. Default: 50.',
        },
        status_filter: {
          type: 'string',
          description: 'Filter by status: success, error, not_eligible, or all. Default: all.',
          enum: ['success', 'error', 'not_eligible', 'all'],
        },
      },
      required: ['marketplace'],
    },
  },
];

async function checkReviewEligibility(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}`,
      queryParams: { MarketplaceIds: ctx.marketplaceId },
    },
    'solicitations'
  );

  return JSON.stringify(response.data, null, 2);
}

async function requestReview(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;
  const marketplace = args.marketplace as string;

  try {
    await ctx.client.request(
      {
        method: 'POST',
        path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}/solicitations/productReviewAndSellerFeedbackSolicitation`,
        queryParams: { marketplaceIds: ctx.marketplaceId },
      },
      'solicitations'
    );

    const logEntry: ReviewRequestLog = {
      timestamp: new Date().toISOString(),
      orderId,
      marketplace,
      marketplaceId: ctx.marketplaceId,
      status: 'success',
      message: 'Review request sent successfully',
    };
    logReviewRequest(logEntry);

    return JSON.stringify({
      success: true,
      orderId,
      marketplace,
      message: 'Review request email sent successfully. Amazon will send the email in the buyer\'s preferred language.',
      timestamp: logEntry.timestamp,
    }, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const isNotEligible = message.includes('403') || message.includes('not eligible') || message.includes('FORBIDDEN');
    const logEntry: ReviewRequestLog = {
      timestamp: new Date().toISOString(),
      orderId,
      marketplace,
      marketplaceId: ctx.marketplaceId,
      status: isNotEligible ? 'not_eligible' : 'error',
      message,
    };
    logReviewRequest(logEntry);

    return JSON.stringify({
      success: false,
      orderId,
      marketplace,
      status: logEntry.status,
      message,
      timestamp: logEntry.timestamp,
    }, null, 2);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bulkRequestReviews(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderIdsRaw = args.order_ids as string;
  const marketplace = args.marketplace as string;
  const orderIds = orderIdsRaw.split(',').map((id) => id.trim()).filter(Boolean);

  const results: Array<{
    orderId: string;
    status: string;
    message: string;
  }> = [];

  let successCount = 0;
  let errorCount = 0;
  let notEligibleCount = 0;

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i] as string;

    // Rate limiting: 1 request per 5 seconds
    if (i > 0) {
      await sleep(5500);
    }

    try {
      await ctx.client.request(
        {
          method: 'POST',
          path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}/solicitations/productReviewAndSellerFeedbackSolicitation`,
          queryParams: { marketplaceIds: ctx.marketplaceId },
        },
        'solicitations'
      );

      logReviewRequest({
        timestamp: new Date().toISOString(),
        orderId,
        marketplace,
        marketplaceId: ctx.marketplaceId,
        status: 'success',
        message: 'Review request sent successfully',
      });

      results.push({ orderId, status: 'success', message: 'Review request sent' });
      successCount++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isNotEligible = errMsg.includes('403') || errMsg.includes('not eligible') || errMsg.includes('FORBIDDEN');

      logReviewRequest({
        timestamp: new Date().toISOString(),
        orderId,
        marketplace,
        marketplaceId: ctx.marketplaceId,
        status: isNotEligible ? 'not_eligible' : 'error',
        message: errMsg,
      });

      results.push({
        orderId,
        status: isNotEligible ? 'not_eligible' : 'error',
        message: errMsg,
      });

      if (isNotEligible) notEligibleCount++;
      else errorCount++;
    }
  }

  return JSON.stringify({
    summary: {
      total: orderIds.length,
      success: successCount,
      not_eligible: notEligibleCount,
      errors: errorCount,
    },
    results,
  }, null, 2);
}

async function getReviewRequestLog(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const limit = (args.limit as number) || 50;
  const statusFilter = (args.status_filter as string) || 'all';

  if (!fs.existsSync(LOG_FILE)) {
    return JSON.stringify({ entries: [], message: 'No review requests logged yet.' }, null, 2);
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  let entries: ReviewRequestLog[] = lines.map((line) => JSON.parse(line));

  if (statusFilter !== 'all') {
    entries = entries.filter((e) => e.status === statusFilter);
  }

  // Return most recent first
  entries = entries.reverse().slice(0, limit);

  const summary = {
    total_logged: lines.length,
    showing: entries.length,
    filter: statusFilter,
    success_total: lines.filter((l) => l.includes('"success"')).length,
    error_total: lines.filter((l) => l.includes('"error"')).length,
    not_eligible_total: lines.filter((l) => l.includes('"not_eligible"')).length,
  };

  return JSON.stringify({ summary, entries }, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  check_review_eligibility: checkReviewEligibility,
  request_review: requestReview,
  bulk_request_reviews: bulkRequestReviews,
  get_review_request_log: getReviewRequestLog,
};
