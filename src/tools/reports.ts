/**
 * Reports API tools — request, check, and download Amazon reports
 *
 * Reports are the primary way to access FBA data, brand analytics,
 * settlement data, inventory age, business reports, and more.
 *
 * Flow: request_report → get_report_status → get_report_document
 */

import axios from 'axios';
import { gunzipSync } from 'zlib';
import { ToolDefinition, ToolHandler, ToolContext, MARKETPLACE_PARAM } from './types.js';

const REPORT_TYPES = [
  // FBA Inventory Reports
  'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA',
  'GET_FBA_MYI_ALL_INVENTORY_DATA',
  'GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA',
  'GET_FBA_INVENTORY_AGED_DATA',
  'GET_FBA_INVENTORY_PLANNING_DATA',
  'GET_FBA_STORAGE_FEE_CHARGES_DATA',
  // FBA Sales & Shipment Reports
  'GET_FBA_FULFILLMENT_CUSTOMER_SHIPMENT_SALES_DATA',
  'GET_FBA_FULFILLMENT_CUSTOMER_SHIPMENT_PROMOTION_DATA',
  'GET_FBA_FULFILLMENT_CUSTOMER_TAXES_DATA',
  // FBA Returns & Removals
  'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
  'GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA',
  'GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA',
  // FBA Fees & Reimbursements
  'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
  'GET_FBA_REIMBURSEMENTS_DATA',
  // Business Reports
  'GET_SALES_AND_TRAFFIC_REPORT',
  'GET_FLAT_FILE_ACTIONABLE_ORDER_DATA_SHIPPING',
  // Brand Analytics
  'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
  'GET_BRAND_ANALYTICS_MARKET_BASKET_REPORT',
  'GET_BRAND_ANALYTICS_REPEAT_PURCHASE_REPORT',
  // Listings Reports
  'GET_MERCHANT_LISTINGS_ALL_DATA',
  'GET_MERCHANT_LISTINGS_DATA',
  'GET_MERCHANT_LISTINGS_INACTIVE_DATA',
  'GET_MERCHANT_CANCELLED_LISTINGS_DATA',
  // Settlement / Financial Reports
  'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
  'GET_V2_SETTLEMENT_REPORT_DATA_XML',
  // Order Reports
  'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
  'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
  'GET_XML_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
  // Performance Reports
  'GET_SELLER_FEEDBACK_DATA',
  'GET_V2_SELLER_PERFORMANCE_REPORT',
  // Other
  'GET_FLAT_FILE_OPEN_LISTINGS_DATA',
  'GET_REFERRAL_FEE_PREVIEW_REPORT',
  'GET_COUPON_PERFORMANCE_REPORT',
  'GET_PROMOTION_PERFORMANCE_REPORT',
];

export const definitions: ToolDefinition[] = [
  {
    name: 'request_report',
    description:
      'Request Amazon to generate a report. Returns a reportId to check status with get_report_status. Reports include FBA inventory, sales, returns, brand analytics, settlements, listings, and more. This is a read operation — it generates data for reading, not modifying your account.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        report_type: {
          type: 'string',
          description: 'The type of report to request.',
          enum: REPORT_TYPES,
        },
        start_date: {
          type: 'string',
          description:
            'Report data start date in ISO 8601 (e.g., 2026-01-01T00:00:00Z). Optional for some report types.',
        },
        end_date: {
          type: 'string',
          description:
            'Report data end date in ISO 8601 (e.g., 2026-01-31T23:59:59Z). Optional.',
        },
      },
      required: ['marketplace', 'report_type'],
    },
  },
  {
    name: 'get_report_status',
    description:
      'Check the processing status of a previously requested report. When status is DONE, use get_report_document with the reportDocumentId to download the data.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        report_id: {
          type: 'string',
          description: 'The reportId returned from request_report.',
        },
      },
      required: ['marketplace', 'report_id'],
    },
  },
  {
    name: 'get_report_document',
    description:
      'Download and return the content of a completed report. Use the reportDocumentId from get_report_status (when status is DONE). Returns the report data as text (CSV/TSV/JSON). Large reports are truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        report_document_id: {
          type: 'string',
          description:
            'The reportDocumentId from get_report_status response.',
        },
        max_lines: {
          type: 'number',
          description:
            'Maximum number of lines to return from the report. Default: 200. Use higher values for larger reports.',
        },
      },
      required: ['marketplace', 'report_document_id'],
    },
  },
  {
    name: 'list_reports',
    description:
      'List previously requested reports, optionally filtered by type and status. Use this to find existing reports without requesting new ones.',
    inputSchema: {
      type: 'object',
      properties: {
        marketplace: MARKETPLACE_PARAM,
        report_types: {
          type: 'string',
          description:
            'Comma-separated report types to filter (e.g., GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA). Optional.',
        },
        processing_statuses: {
          type: 'string',
          description:
            'Comma-separated statuses to filter (IN_QUEUE,IN_PROGRESS,DONE,CANCELLED,FATAL). Optional.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of reports to return (1-100). Default: 10.',
        },
        next_token: {
          type: 'string',
          description: 'Pagination token from a previous response. Optional.',
        },
      },
      required: ['marketplace'],
    },
  },
];

async function requestReport(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const body: Record<string, unknown> = {
    reportType: args.report_type as string,
    marketplaceIds: [ctx.marketplaceId],
  };
  if (args.start_date) {
    body.dataStartTime = args.start_date as string;
  }
  if (args.end_date) {
    body.dataEndTime = args.end_date as string;
  }

  const response = await ctx.client.request(
    { method: 'POST', path: '/reports/2021-06-30/reports', body },
    'reports'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getReportStatus(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const reportId = args.report_id as string;
  const response = await ctx.client.request(
    {
      method: 'GET',
      path: `/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`,
    },
    'reports'
  );
  return JSON.stringify(response.data, null, 2);
}

async function getReportDocument(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const docId = args.report_document_id as string;
  const maxLines = Math.min(Number(args.max_lines) || 200, 1000);

  // Step 1: Get the document metadata (download URL)
  const response = await ctx.client.request<{
    url: string;
    compressionAlgorithm?: string;
  }>(
    {
      method: 'GET',
      path: `/reports/2021-06-30/documents/${encodeURIComponent(docId)}`,
    },
    'reports'
  );

  const docMeta = response.data;

  // Step 2: Download the actual document from the pre-signed URL
  const downloadResponse = await axios.get(docMeta.url, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  // Step 3: Decompress if needed
  let content: string;
  if (docMeta.compressionAlgorithm === 'GZIP') {
    const decompressed = gunzipSync(Buffer.from(downloadResponse.data as ArrayBuffer));
    content = decompressed.toString('utf-8');
  } else {
    content = Buffer.from(downloadResponse.data as ArrayBuffer).toString('utf-8');
  }

  // Step 4: Truncate if needed
  const lines = content.split('\n');
  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines).join('\n');
    return `${truncated}\n\n--- TRUNCATED: Showing ${maxLines} of ${lines.length} lines. Use max_lines parameter to see more. ---`;
  }

  return content;
}

async function listReports(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const queryParams: Record<string, string> = {
    marketplaceIds: ctx.marketplaceId,
  };
  if (args.report_types) {
    queryParams.reportTypes = args.report_types as string;
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
    { method: 'GET', path: '/reports/2021-06-30/reports', queryParams },
    'reports'
  );
  return JSON.stringify(response.data, null, 2);
}

export const handlers: Record<string, ToolHandler> = {
  request_report: requestReport,
  get_report_status: getReportStatus,
  get_report_document: getReportDocument,
  list_reports: listReports,
};
