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
  httpStatus?: number;
  responseBody?: unknown;
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

/**
 * Check if an SP-API response body indicates an error even on HTTP 200.
 * Some SP-API endpoints return 200 with error details in the body.
 */
function checkResponseForErrors(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // Check for explicit errors array in response
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const firstErr = obj.errors[0] as Record<string, unknown>;
    return firstErr?.message as string || firstErr?.code as string || 'Unknown API error in response body';
  }

  // Check for "Access denied" patterns in response
  if (typeof obj.message === 'string' && (
    obj.message.includes('denied') ||
    obj.message.includes('Unauthorized') ||
    obj.message.includes('not authorized')
  )) {
    return obj.message;
  }

  return null;
}

export const definitions: ToolDefinition[] = [
  {
    name: 'test_solicitations_permission',
    description:
      'Diagnostic tool: Tests whether your SP-API app has the Solicitations permission enabled. Makes a lightweight GET request to the Solicitations API and reports the exact response. Use this BEFORE running bulk review requests to verify permissions are working.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        order_id: {
          type: 'string',
          description: 'Any valid Amazon order ID to test with (e.g., a recent shipped order)',
        },
      },
      required: ['marketplace', 'order_id'],
    },
  },
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

async function testSolicitationsPermission(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;
  const marketplace = args.marketplace as string;

  const diagnostics: Record<string, unknown> = {
    test: 'solicitations_permission',
    marketplace,
    marketplaceId: ctx.marketplaceId,
    orderId,
    timestamp: new Date().toISOString(),
    steps: [] as Array<Record<string, unknown>>,
  };

  const steps = diagnostics.steps as Array<Record<string, unknown>>;

  // Step 1: Test getSolicitationActionsForOrder (GET — read-only, safe)
  try {
    const response = await ctx.client.request(
      {
        method: 'GET',
        path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}`,
        queryParams: { marketplaceIds: ctx.marketplaceId },
      },
      'solicitations'
    );

    const bodyError = checkResponseForErrors(response.data);

    steps.push({
      step: 'getSolicitationActionsForOrder',
      httpStatus: response.status,
      success: !bodyError,
      responseBody: response.data,
      bodyError: bodyError || null,
    });

    if (bodyError) {
      diagnostics.result = 'FAIL';
      diagnostics.diagnosis = `Solicitations API returned HTTP ${response.status} but body contains error: ${bodyError}. This likely means the Solicitations role is NOT granted on your SP-API app.`;
    } else {
      diagnostics.result = 'PASS';
      diagnostics.diagnosis = 'Solicitations permission is ACTIVE. The API returned solicitation actions for this order.';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isDenied = message.includes('denied') || message.includes('403') || message.includes('Unauthorized') || message.includes('FORBIDDEN');

    steps.push({
      step: 'getSolicitationActionsForOrder',
      success: false,
      error: message,
      isDenied,
    });

    if (isDenied) {
      diagnostics.result = 'FAIL';
      diagnostics.diagnosis =
        'Solicitations permission is DENIED. The SP-API returned 403/Access Denied. ' +
        'Fix: Go to Amazon Developer Console → Edit your SP-API app → Enable "Solicitations" role → ' +
        'Generate a NEW refresh token with Solicitations scope → Update your .env file with the new token.';
    } else {
      diagnostics.result = 'ERROR';
      diagnostics.diagnosis = `Unexpected error testing Solicitations API: ${message}. This may be a network issue or invalid order ID.`;
    }
  }

  // Step 2: Verify order exists (sanity check)
  try {
    const orderResponse = await ctx.client.request(
      {
        method: 'GET',
        path: `/orders/v0/orders/${encodeURIComponent(orderId)}`,
      },
      'orders'
    );

    steps.push({
      step: 'verifyOrderExists',
      success: true,
      httpStatus: orderResponse.status,
      orderStatus: (orderResponse.data as Record<string, unknown>)?.payload
        ? 'found'
        : 'unknown_format',
    });
  } catch (error) {
    steps.push({
      step: 'verifyOrderExists',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return JSON.stringify(diagnostics, null, 2);
}

async function checkReviewEligibility(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;

  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}`,
      queryParams: { marketplaceIds: ctx.marketplaceId },
    },
    'solicitations'
  );

  // Check for errors hidden in 200 response body
  const bodyError = checkResponseForErrors(response.data);
  if (bodyError) {
    return JSON.stringify({
      success: false,
      orderId,
      error: bodyError,
      rawResponse: response.data,
      hint: 'If you see "Access denied", your SP-API app may not have the Solicitations role. Run test_solicitations_permission to diagnose.',
    }, null, 2);
  }

  return JSON.stringify(response.data, null, 2);
}

async function requestReview(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const orderId = args.order_id as string;
  const marketplace = args.marketplace as string;

  try {
    const response = await ctx.client.request(
      {
        method: 'POST',
        path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}/solicitations/productReviewAndSellerFeedbackSolicitation`,
        queryParams: { marketplaceIds: ctx.marketplaceId },
      },
      'solicitations'
    );

    // Check for errors hidden in 200/201 response body
    const bodyError = checkResponseForErrors(response.data);
    if (bodyError) {
      const logEntry: ReviewRequestLog = {
        timestamp: new Date().toISOString(),
        orderId,
        marketplace,
        marketplaceId: ctx.marketplaceId,
        status: 'error',
        message: `API returned HTTP ${response.status} but body contains error: ${bodyError}`,
        httpStatus: response.status,
        responseBody: response.data,
      };
      logReviewRequest(logEntry);

      return JSON.stringify({
        success: false,
        orderId,
        marketplace,
        status: 'error',
        message: logEntry.message,
        hint: 'The API returned a success HTTP code but the response body indicates an error. Run test_solicitations_permission to diagnose.',
        rawResponse: response.data,
        timestamp: logEntry.timestamp,
      }, null, 2);
    }

    const logEntry: ReviewRequestLog = {
      timestamp: new Date().toISOString(),
      orderId,
      marketplace,
      marketplaceId: ctx.marketplaceId,
      status: 'success',
      message: 'Review request sent successfully',
      httpStatus: response.status,
    };
    logReviewRequest(logEntry);

    return JSON.stringify({
      success: true,
      orderId,
      marketplace,
      httpStatus: response.status,
      message: 'Review request email sent successfully. Amazon will send the email in the buyer\'s preferred language.',
      timestamp: logEntry.timestamp,
    }, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const isNotEligible = message.includes('403') || message.includes('not eligible') || message.includes('FORBIDDEN');
    const isDenied = message.includes('denied') || message.includes('Unauthorized');
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
      hint: isDenied
        ? 'Access denied — your SP-API app likely does not have the Solicitations role. Run test_solicitations_permission to diagnose.'
        : isNotEligible
          ? 'Order may not be eligible (outside 5-30 day delivery window, or already reviewed).'
          : undefined,
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

  // Step 1: Quick permission check on first order before processing all
  const firstOrderId = orderIds[0];
  if (firstOrderId) {
    try {
      const testResponse = await ctx.client.request(
        {
          method: 'GET',
          path: `/solicitations/v1/orders/${encodeURIComponent(firstOrderId)}`,
          queryParams: { marketplaceIds: ctx.marketplaceId },
        },
        'solicitations'
      );

      const bodyError = checkResponseForErrors(testResponse.data);
      if (bodyError) {
        return JSON.stringify({
          summary: {
            total: orderIds.length,
            success: 0,
            not_eligible: 0,
            errors: orderIds.length,
          },
          aborted: true,
          reason: `Permission check failed: API returned HTTP ${testResponse.status} but body contains error: ${bodyError}`,
          hint: 'Your SP-API app likely does not have the Solicitations role. Run test_solicitations_permission for full diagnostics.',
          rawResponse: testResponse.data,
          results: [],
        }, null, 2);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isDenied = msg.includes('denied') || msg.includes('403') || msg.includes('FORBIDDEN') || msg.includes('Unauthorized');

      if (isDenied) {
        return JSON.stringify({
          summary: {
            total: orderIds.length,
            success: 0,
            not_eligible: 0,
            errors: orderIds.length,
          },
          aborted: true,
          reason: `Solicitations permission DENIED: ${msg}`,
          hint: 'Fix: Enable Solicitations role on your SP-API app, generate a new refresh token, and update your .env file. Run test_solicitations_permission for full diagnostics.',
          results: [],
        }, null, 2);
      }
      // Non-permission errors — could be invalid order, proceed with bulk
    }
  }

  const results: Array<{
    orderId: string;
    status: string;
    message: string;
    httpStatus?: number;
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
      const response = await ctx.client.request(
        {
          method: 'POST',
          path: `/solicitations/v1/orders/${encodeURIComponent(orderId)}/solicitations/productReviewAndSellerFeedbackSolicitation`,
          queryParams: { marketplaceIds: ctx.marketplaceId },
        },
        'solicitations'
      );

      // Check for errors hidden in 200 response body
      const bodyError = checkResponseForErrors(response.data);
      if (bodyError) {
        logReviewRequest({
          timestamp: new Date().toISOString(),
          orderId,
          marketplace,
          marketplaceId: ctx.marketplaceId,
          status: 'error',
          message: `HTTP ${response.status} but body error: ${bodyError}`,
          httpStatus: response.status,
          responseBody: response.data,
        });

        results.push({
          orderId,
          status: 'error',
          message: `API returned HTTP ${response.status} but body contains error: ${bodyError}`,
          httpStatus: response.status,
        });
        errorCount++;
        continue;
      }

      logReviewRequest({
        timestamp: new Date().toISOString(),
        orderId,
        marketplace,
        marketplaceId: ctx.marketplaceId,
        status: 'success',
        message: 'Review request sent successfully',
        httpStatus: response.status,
      });

      results.push({ orderId, status: 'success', message: 'Review request sent', httpStatus: response.status });
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
  test_solicitations_permission: testSolicitationsPermission,
  check_review_eligibility: checkReviewEligibility,
  request_review: requestReview,
  bulk_request_reviews: bulkRequestReviews,
  get_review_request_log: getReviewRequestLog,
};
