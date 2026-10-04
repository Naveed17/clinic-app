import { Router, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createCareFlowMcpServer } from './careflow-mcp-server';
import { asyncHandler } from '../backend/utils/async-handler';

export function createMcpRouter(): Router {
  const router = Router();
  const activeTransports = new Map<string, SSEServerTransport>();

  // Helper server instance for metadata & direct tool calls
  const sharedServer = createCareFlowMcpServer();

  /**
   * GET /api/mcp/tools
   * Lists all available tools and their metadata.
   */
  router.get(
    '/tools',
    asyncHandler(async (_req: Request, res: Response) => {
      // Return a human-readable and structured list of tools
      const tools = [
        {
          name: 'doctor_get_today_appointments',
          category: 'Doctor',
          description: 'Get scheduled appointments for a doctor for today (or specified date).',
          parameters: { doctorId: 'string (required)', date: 'YYYY-MM-DD (optional)' },
        },
        {
          name: 'doctor_get_queue',
          category: 'Doctor',
          description: 'Get real-time patient token queue for a doctor (waiting, current, completed).',
          parameters: { doctorId: 'string (required)', date: 'YYYY-MM-DD (optional)' },
        },
        {
          name: 'doctor_get_patient_history',
          category: 'Doctor',
          description: 'Get complete medical record and visit history for a patient.',
          parameters: { search: 'string (Patient ID, MR Number, or Phone) (required)' },
        },
        {
          name: 'doctor_get_opd_fee_report',
          category: 'Doctor',
          description: 'Get OPD consultation fees report for a doctor (Paid, Half, Free counts, and net earnings).',
          parameters: { doctorId: 'string (required)', dateFrom: 'YYYY-MM-DD (optional)', dateTo: 'YYYY-MM-DD (optional)' },
        },
        {
          name: 'reception_get_daily_report',
          category: 'Receptionist',
          description: 'Get daily collection report: Doctor OPD fees + clinic invoices billed, collected, and outstanding.',
          parameters: { date: 'YYYY-MM-DD (optional)', dateFrom: 'YYYY-MM-DD (optional)', dateTo: 'YYYY-MM-DD (optional)' },
        },
        {
          name: 'reception_check_doctor_availability',
          category: 'Receptionist',
          description: 'Check active doctors, their working schedule, fees, and attendance status.',
          parameters: { date: 'YYYY-MM-DD (optional)', doctorId: 'string (optional)' },
        },
        {
          name: 'reception_search_patient',
          category: 'Receptionist',
          description: 'Search patient profiles by name, phone, or MR number.',
          parameters: { query: 'string (required)' },
        },
        {
          name: 'reception_get_queue_summary',
          category: 'Receptionist',
          description: 'Get clinic-wide waiting list and token status grouped per doctor.',
          parameters: { date: 'YYYY-MM-DD (optional)' },
        },
        {
          name: 'admin_get_full_opd_and_revenue_report',
          category: 'Admin',
          description: 'Comprehensive clinic OPD & revenue report with doctor breakdown and invoice balance.',
          parameters: { dateFrom: 'YYYY-MM-DD (optional)', dateTo: 'YYYY-MM-DD (optional)', doctorId: 'string (optional)' },
        },
        {
          name: 'admin_get_clinic_stats',
          category: 'Admin',
          description: 'Overall clinic KPIs: appointments, completion rate, monthly revenue, and trends.',
          parameters: {},
        },
        {
          name: 'admin_get_unpaid_invoices',
          category: 'Admin',
          description: 'List all pending/unpaid invoices with patient contact info for recovery.',
          parameters: { limit: 'number (optional, default 50)' },
        },
      ];

      res.json({
        server: 'CareFlow MCP Server',
        version: '1.0.0',
        totalTools: tools.length,
        tools,
      });
    }),
  );

  /**
   * GET /api/mcp/sse
   * Establishes SSE stream connection for MCP clients (Cursor, Claude, web AI client).
   */
  router.get(
    '/sse',
    asyncHandler(async (req: Request, res: Response) => {
      const server = createCareFlowMcpServer();
      const transport = new SSEServerTransport('/api/mcp/messages', res);

      activeTransports.set(transport.sessionId, transport);

      transport.onclose = () => {
        activeTransports.delete(transport.sessionId);
      };

      await server.connect(transport);
    }),
  );

  /**
   * POST /api/mcp/messages
   * Receives incoming JSON-RPC messages for an active SSE session.
   */
  router.post(
    '/messages',
    asyncHandler(async (req: Request, res: Response) => {
      const sessionId = String(req.query.sessionId ?? '').trim();
      const transport = activeTransports.get(sessionId);

      if (!transport) {
        res.status(404).json({ error: 'MCP SSE session not found or expired.' });
        return;
      }

      await transport.handlePostMessage(req, res, req.body);
    }),
  );

  return router;
}
