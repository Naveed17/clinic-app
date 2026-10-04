import { ipcMain } from 'electron';
import { licenseApi } from '../license/licenseApi';
import { getPrisma } from '../database/client';
import {
  getDoctorTodayAppointments,
  getDoctorQueue,
  getPatientMedicalHistory,
  getDoctorOpdFeeReport,
  getReceptionDailyReport,
  getReceptionDoctorAvailability,
  getReceptionPatientSearch,
  getReceptionQueueSummary,
  getAdminFullOpdAndRevenueReport,
  getAdminClinicStats,
  getAdminUnpaidInvoices,
  getPharmacyMedicineSearch,
  searchDoctorByName,
  bookPatientAppointment,
} from './careflow-mcp-server';

export interface UserContext {
  userId: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_TECHNICIAN' | 'PHARMACIST' | string;
  name?: string;
  history?: Array<{ sender: string; text: string; data?: any }>;
}

// =========================================================================
// TEXT SANITIZATION & LANGUAGE DETECTION
// =========================================================================

function cleanOutputText(text: string): string {
  return text
    .replace(/\*+/g, '') // remove all asterisks
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // remove emojis
    .replace(/ {2,}/g, ' ')
    .trim();
}

// =========================================================================
// HOSTED GOOGLE GEMINI AI MCP AGENT ENGINE
// =========================================================================

async function callGeminiAi(system: string, user: string): Promise<string | null> {
  try {
    const data = await licenseApi<{ ok: boolean; text?: string }>('/ai/chat', { system, user });
    if (data?.ok && data.text) {
      return data.text.trim();
    }
    return null;
  } catch (err) {
    console.warn('[MCP AI Gemini] API call failed or offline:', err);
    return null;
  }
}

const GEMINI_MCP_INTENT_SYSTEM = `You are CareFlow Clinic AI Assistant's reasoning engine.
You have access to clinic MCP tools. Given the user's message and recent conversation history, determine the best tool to call and the exact arguments, or generate a direct reply.

CLINIC INFORMATION:
- Facility: Outpatient (OPD) clinic providing consultations, diagnostic checkups, and pharmacy services.
- Unavailable services: Inpatient (IPD), Emergency / ICU, Surgery / Operation Theater, MRI / CT Scan. If the user asks for these services, choose direct_reply and politely apologize that CareFlow clinic is an OPD clinic and does not provide that facility.

AVAILABLE TOOLS:
1. reception_create_appointment: Book an appointment for a patient.
   Args: { patientSearch: string, doctorSearch?: string, date?: string, time?: string, reason?: string }
   - patientSearch: The patient's name, MR number, or phone. If the user refers to the patient via pronouns like "is ki", "iski", "her", "him", or previously discussed a patient, resolve their name from conversation history!
   - doctorSearch: Doctor's name (e.g. "Ahmed Ali"). NEVER include words like "k sath", "ke sath", "with", "dr", "doctor". If user says "available dr" or does not specify a doctor, leave doctorSearch empty or omitted.
2. reception_search_patient: Search patient record or verify if patient is registered.
   Args: { query: string } (the patient name or phone)
3. doctor_get_patient_history: Get full medical history / past visits of a patient.
   Args: { search: string } (patient name or MR number)
4. clinic_search_doctor: Check specific doctor's availability, timing, schedule or fees.
   Args: { nameQuery: string } (doctor name only, e.g. "Ahmed Ali")
5. reception_check_doctor_availability: Check all doctors available/scheduled today.
   Args: {}
6. reception_get_queue_summary: Check clinic live token queue / waiting patients.
   Args: {}
7. reception_get_daily_report: Counter cash collection, OPD fees collected, daily desk collection report.
   Args: {}
8. doctor_get_today_appointments: View appointments for a doctor.
   Args: { doctorId?: string }
9. doctor_get_queue: Doctor view of their patient queue.
   Args: { doctorId?: string }
10. doctor_get_opd_fee_report: Doctor fee earnings report.
    Args: { doctorId?: string }
11. admin_get_full_opd_and_revenue_report: Total clinic revenue and financial report.
    Args: {}
12. admin_get_clinic_stats: High-level clinic statistics.
    Args: {}
13. admin_get_unpaid_invoices: List unpaid invoices.
    Args: {}
14. pharmacy_search_medicine: Check medicine stock or availability in pharmacy.
    Args: { query: string }

OUTPUT FORMAT:
Respond with ONLY a JSON object in this format (no markdown fences, no explanatory text):
{
  "action": "tool_call" | "direct_reply",
  "tool": "<tool_name>",
  "args": { ... },
  "reply": "<direct reply in the user's language if action is direct_reply>"
}

CRITICAL RULES:
- The user can write in ANY language (Roman Urdu, Urdu, English, Chinese, Arabic, Sindhi, etc.) and with spelling typos (e.g. 'appionment', 'appionement').
- If the user sends a greeting (e.g. "hi", "salam", "hello") without any specific request, or asks what you can do, use action: "direct_reply".
- If user wants to book an appointment (e.g. "patient sara ki appionment book kro dr ali ahmed k sath", "acha is ki appionement book kro available dr k sath", "Dr. Ahmed Ali k sath"), use action: "tool_call", tool: "reception_create_appointment".
- If the user query is a continuation (e.g. previous assistant message asked for doctor or patient, and user replies "Dr. Ahmed Ali k sath"), link them together and call reception_create_appointment.`;

const GEMINI_MCP_FORMATTER_SYSTEM = `You are CareFlow Clinic AI Assistant.
The user asked a question, a clinic database tool was executed, and here is the exact database result.
Formulate a polite, clear, natural, and helpful response for the user.

CRITICAL RULES:
1. ALWAYS respond in the EXACT same language and script/style the user used:
   - If user wrote in Roman Urdu, respond in natural Roman Urdu.
   - If user wrote in Urdu script, respond in Urdu script.
   - If user wrote in English, respond in English.
   - If user wrote in Chinese (中文), respond in Chinese.
   - If user wrote in Arabic, respond in Arabic.
2. NEVER use asterisks (** or *) or markdown bolding.
3. NEVER use emojis.
4. Keep the response concise, clear, and professional.
5. If the tool result says success=false or error or not found, politely apologize and explain the issue in the user's language.`;

async function executeMcpTool(
  toolName: string,
  args: Record<string, any>,
  userContext?: UserContext,
): Promise<{ data: any; toolUsed: string }> {
  switch (toolName) {
    case 'reception_create_appointment': {
      const data = await bookPatientAppointment({
        patientSearch: String(args.patientSearch || ''),
        doctorSearch: args.doctorSearch ? String(args.doctorSearch) : undefined,
        date: args.date ? String(args.date) : undefined,
        time: args.time ? String(args.time) : undefined,
        reason: args.reason ? String(args.reason) : undefined,
      });
      return { data, toolUsed: 'reception_create_appointment' };
    }
    case 'reception_search_patient': {
      const data = await getReceptionPatientSearch(String(args.query || args.search || ''));
      return { data, toolUsed: 'reception_search_patient' };
    }
    case 'doctor_get_patient_history': {
      const data = await getPatientMedicalHistory(String(args.search || args.query || ''));
      return { data, toolUsed: 'doctor_get_patient_history' };
    }
    case 'clinic_search_doctor': {
      const nameQuery = String(args.nameQuery || args.doctorSearch || args.name || '');
      const matchedDocs = await searchDoctorByName(nameQuery);
      if (matchedDocs.length === 0) {
        const activeDocs = await getReceptionDoctorAvailability();
        return {
          data: {
            found: false,
            searchedName: nameQuery,
            availableDoctors: activeDocs.doctors.map((d) => `${d.name} (${d.specialization})`),
          },
          toolUsed: 'clinic_search_doctor',
        };
      }
      const doc = matchedDocs[0];
      const availability = await getReceptionDoctorAvailability(undefined, doc.id);
      return {
        data: {
          found: true,
          doctor: doc,
          status: availability.doctors[0] || null,
        },
        toolUsed: 'clinic_search_doctor',
      };
    }
    case 'reception_check_doctor_availability': {
      const data = await getReceptionDoctorAvailability(
        args.date ? String(args.date) : undefined,
        args.doctorId ? String(args.doctorId) : undefined,
      );
      return { data, toolUsed: 'reception_check_doctor_availability' };
    }
    case 'reception_get_queue_summary': {
      const data = await getReceptionQueueSummary(args.date ? String(args.date) : undefined);
      return { data, toolUsed: 'reception_get_queue_summary' };
    }
    case 'reception_get_daily_report': {
      const data = await getReceptionDailyReport(
        args.date ? String(args.date) : undefined,
        args.dateFrom ? String(args.dateFrom) : undefined,
        args.dateTo ? String(args.dateTo) : undefined,
      );
      return { data, toolUsed: 'reception_get_daily_report' };
    }
    case 'doctor_get_today_appointments': {
      const data = await getDoctorTodayAppointments(
        String(args.doctorId || userContext?.userId || ''),
        args.date ? String(args.date) : undefined,
      );
      return { data, toolUsed: 'doctor_get_today_appointments' };
    }
    case 'doctor_get_queue': {
      const data = await getDoctorQueue(
        String(args.doctorId || userContext?.userId || ''),
        args.date ? String(args.date) : undefined,
      );
      return { data, toolUsed: 'doctor_get_queue' };
    }
    case 'doctor_get_opd_fee_report': {
      const data = await getDoctorOpdFeeReport(
        String(args.doctorId || userContext?.userId || ''),
        args.dateFrom ? String(args.dateFrom) : undefined,
        args.dateTo ? String(args.dateTo) : undefined,
      );
      return { data, toolUsed: 'doctor_get_opd_fee_report' };
    }
    case 'admin_get_full_opd_and_revenue_report': {
      const data = await getAdminFullOpdAndRevenueReport(
        args.dateFrom ? String(args.dateFrom) : undefined,
        args.dateTo ? String(args.dateTo) : undefined,
        args.doctorId ? String(args.doctorId) : undefined,
      );
      return { data, toolUsed: 'admin_get_full_opd_and_revenue_report' };
    }
    case 'admin_get_clinic_stats': {
      const data = await getAdminClinicStats();
      return { data, toolUsed: 'admin_get_clinic_stats' };
    }
    case 'admin_get_unpaid_invoices': {
      const data = await getAdminUnpaidInvoices(args.limit ? Number(args.limit) : 50);
      return { data, toolUsed: 'admin_get_unpaid_invoices' };
    }
    case 'pharmacy_search_medicine': {
      const data = await getPharmacyMedicineSearch(String(args.query || ''));
      return { data, toolUsed: 'pharmacy_search_medicine' };
    }
    default:
      throw new Error(`Unsupported tool: ${toolName}`);
  }
}

function formatToolResultToNaturalText(toolUsed: string, data: any, _rawQ: string): string {
  if (!data) {
    return 'No record found in the database for this request.';
  }

  switch (toolUsed) {
    case 'reception_check_doctor_availability': {
      const day = data.day || '';
      const date = data.date || '';
      const docs = Array.isArray(data.doctors) ? data.doctors : [];
      if (docs.length === 0) {
        return `No doctors are scheduled or available for today (${day} ${date}).`;
      }
      const lines = docs.map((d: any, idx: number) => {
        const spec = d.specialization ? ` (${d.specialization})` : '';
        const fee = d.consultationFee ? ` | Fee: Rs. ${Number(d.consultationFee).toLocaleString()}` : '';
        const timing = d.timing && d.timing !== 'No slots' ? ` | Timing: ${d.timing}` : '';
        return `${idx + 1}. ${d.name}${spec}\n   Status: ${d.status}${timing}${fee}`;
      });
      return `Doctor availability for today (${day}, ${date}):\n\n${lines.join('\n\n')}\n\nPlease specify a doctor name if you would like to book an appointment.`;
    }

    case 'clinic_search_doctor': {
      if (data.found && data.doctor) {
        const d = data.doctor;
        const st = data.status || {};
        return `${d.name} (${d.specialization || 'Doctor'}):\nStatus: ${st.status || 'Active'}\nTiming: ${st.timing || 'Clinic hours'}\nConsultation Fee: Rs. ${Number(d.consultationFee || 0).toLocaleString()}`;
      }
      const avail = Array.isArray(data.availableDoctors) ? data.availableDoctors.join(', ') : '';
      return `Doctor '${data.searchedName || ''}' was not found. Currently available doctors: ${avail || 'None'}.`;
    }

    case 'reception_create_appointment': {
      if (data.success) {
        return `Appointment successfully booked!\n• Patient: ${data.patientName || 'Patient'} (${data.mrNumber || ''})\n• Doctor: ${data.doctorName || ''}\n• Time: ${data.timeFormatted || data.time || 'Today'}\n• Status: ${data.status || 'CONFIRMED'}`;
      }
      return `Unable to book appointment: ${data.error || 'Please verify patient and doctor details'}.`;
    }

    case 'reception_get_queue_summary': {
      const total = data.totalWaiting ?? 0;
      const docs = Array.isArray(data.doctors) ? data.doctors : [];
      const lines = docs.map((d: any) => `• ${d.doctorName} (${d.room || 'Chamber'}): ${d.waitingCount} waiting${d.currentToken ? `, Token #${d.currentToken}` : ''}`);
      return `Live Clinic Queue Summary:\nTotal ${total} patient(s) waiting.\n\n${lines.length ? lines.join('\n') : 'No patients currently waiting in queue.'}`;
    }

    case 'reception_get_daily_report': {
      const total = Number(data.totalCollected || 0).toLocaleString();
      const cash = Number(data.cashCollected || 0).toLocaleString();
      const card = Number(data.cardCollected || 0).toLocaleString();
      const count = data.opdPatientsCount || 0;
      return `Desk Counter Collection Report:\n• Total Collection: Rs. ${total}\n• Cash: Rs. ${cash}\n• Card / Online: Rs. ${card}\n• OPD Patient Visits: ${count}`;
    }

    case 'doctor_get_today_appointments': {
      const appts = Array.isArray(data.appointments) ? data.appointments : [];
      if (appts.length === 0) {
        return 'No appointments scheduled for today.';
      }
      const lines = appts.slice(0, 5).map((a: any, idx: number) => `${idx + 1}. ${a.patientName} (${a.timeFormatted || a.time || ''}) - ${a.reason || 'Checkup'}`);
      return `Today's Appointments (${appts.length}):\n\n${lines.join('\n')}${appts.length > 5 ? `\n...and ${appts.length - 5} more.` : ''}`;
    }

    case 'doctor_get_opd_fee_report': {
      const fin = data.financials || {};
      return `OPD Consultation Fees Summary:\n• Net Earnings: Rs. ${Number(fin.netDoctorEarnings || 0).toLocaleString()}\n• Gross Fees: Rs. ${Number(fin.grossConsultationFees || 0).toLocaleString()}\n• Total Discount: Rs. ${Number(fin.totalDiscount || 0).toLocaleString()}`;
    }

    case 'pharmacy_search_medicine': {
      const meds = Array.isArray(data.medicines) ? data.medicines : [];
      if (meds.length === 0) {
        return 'This medicine was not found in pharmacy inventory.';
      }
      const lines = meds.slice(0, 5).map((m: any) => `• ${m.name} (${m.dosageForm || 'Unit'}) - Stock: ${m.stockQuantity ?? m.stock ?? 0}`);
      return `Pharmacy Stock Results:\n\n${lines.join('\n')}`;
    }

    case 'admin_get_clinic_stats': {
      return `Clinic Key Statistics:\n• Total Registered Patients: ${data.totalPatients || 0}\n• Today's Appointments: ${data.appointmentsToday || 0}\n• Monthly Invoices: ${data.totalInvoicesMonth || 0}`;
    }

    case 'admin_get_unpaid_invoices': {
      const count = data.count ?? (Array.isArray(data.invoices) ? data.invoices.length : 0);
      return `Unpaid Invoices:\nTotal ${count} unpaid invoices pending.`;
    }

    default: {
      if (typeof data === 'object') {
        const entries = Object.entries(data)
          .filter(([_, v]) => typeof v !== 'object')
          .map(([k, v]) => `• ${k}: ${v}`);
        if (entries.length > 0) return `Record details:\n${entries.join('\n')}`;
      }
      return String(data);
    }
  }
}

async function askGeminiMcpAgent(
  rawQ: string,
  userContext?: UserContext,
): Promise<{ reply: string; toolUsed: string; data: any } | null> {
  const historyText = (userContext?.history || [])
    .slice(-6)
    .map((m) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  const userPrompt = historyText
    ? `Recent Conversation History:\n${historyText}\n\nCurrent User Message: ${rawQ}`
    : `Current User Message: ${rawQ}`;

  const intentRaw = await callGeminiAi(GEMINI_MCP_INTENT_SYSTEM, userPrompt);
  if (!intentRaw) return null;

  try {
    const cleanJson = intentRaw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const intent = JSON.parse(cleanJson);

    if (intent.action === 'direct_reply' && intent.reply) {
      return {
        reply: cleanOutputText(intent.reply),
        toolUsed: 'gemini_direct',
        data: null,
      };
    }

    if (intent.action === 'tool_call' && intent.tool) {
      const { data, toolUsed } = await executeMcpTool(intent.tool, intent.args || {}, userContext);

      // Ask Gemini to format the final answer in the user's exact language using the returned data:
      const formatPrompt = `User Query: "${rawQ}"\nExecuted Tool: ${toolUsed}\nDatabase Result:\n${JSON.stringify(data, null, 2)}`;
      let formattedReply = await callGeminiAi(GEMINI_MCP_FORMATTER_SYSTEM, formatPrompt);

      // If initial format call fails or is throttled, retry once after a short pause
      if (!formattedReply) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        formattedReply = await callGeminiAi(GEMINI_MCP_FORMATTER_SYSTEM, formatPrompt);
      }

      if (formattedReply) {
        return {
          reply: cleanOutputText(formattedReply),
          toolUsed,
          data,
        };
      }

      // Fallback: Never return raw JSON brackets to the user! Use clean, natural text:
      const naturalReply = formatToolResultToNaturalText(toolUsed, data, rawQ);
      return {
        reply: cleanOutputText(naturalReply),
        toolUsed,
        data,
      };
    }
  } catch (parseErr) {
    console.warn('[MCP AI Gemini] Intent parse failed:', parseErr, intentRaw);
    return null;
  }

  return null;
}

// =========================================================================
// IPC HANDLER REGISTRATION
// =========================================================================

export function registerMcpIpc(): void {
  // 1. Raw MCP Tool Caller
  ipcMain.handle('mcp:callTool', async (_event, { name, args }: { name: string; args: Record<string, unknown> }) => {
    switch (name) {
      case 'doctor_get_today_appointments':
        return getDoctorTodayAppointments(String(args.doctorId || ''), args.date ? String(args.date) : undefined);
      case 'doctor_get_queue':
        return getDoctorQueue(String(args.doctorId || ''), args.date ? String(args.date) : undefined);
      case 'doctor_get_patient_history':
        return getPatientMedicalHistory(String(args.search || ''));
      case 'doctor_get_opd_fee_report':
        return getDoctorOpdFeeReport(
          String(args.doctorId || ''),
          args.dateFrom ? String(args.dateFrom) : undefined,
          args.dateTo ? String(args.dateTo) : undefined,
        );
      case 'reception_get_daily_report':
        return getReceptionDailyReport(
          args.date ? String(args.date) : undefined,
          args.dateFrom ? String(args.dateFrom) : undefined,
          args.dateTo ? String(args.dateTo) : undefined,
        );
      case 'reception_check_doctor_availability':
        return getReceptionDoctorAvailability(
          args.date ? String(args.date) : undefined,
          args.doctorId ? String(args.doctorId) : undefined,
        );
      case 'reception_search_patient':
        return getReceptionPatientSearch(String(args.query || ''));
      case 'reception_get_queue_summary':
        return getReceptionQueueSummary(args.date ? String(args.date) : undefined);
      case 'admin_get_full_opd_and_revenue_report':
        return getAdminFullOpdAndRevenueReport(
          args.dateFrom ? String(args.dateFrom) : undefined,
          args.dateTo ? String(args.dateTo) : undefined,
          args.doctorId ? String(args.doctorId) : undefined,
        );
      case 'admin_get_clinic_stats':
        return getAdminClinicStats();
      case 'admin_get_unpaid_invoices':
        return getAdminUnpaidInvoices(args.limit ? Number(args.limit) : 50);
      case 'pharmacy_search_medicine':
        return getPharmacyMedicineSearch(String(args.query || ''));
      case 'clinic_search_doctor':
        return searchDoctorByName(String(args.nameQuery || ''));
      case 'reception_create_appointment':
        return bookPatientAppointment({
          patientSearch: String(args.patientSearch || ''),
          doctorSearch: args.doctorSearch ? String(args.doctorSearch) : undefined,
          date: args.date ? String(args.date) : undefined,
          time: args.time ? String(args.time) : undefined,
          reason: args.reason ? String(args.reason) : undefined,
        });
      default:
        throw new Error(`Unknown MCP Tool: ${name}`);
    }
  });

  // 2. Intelligent AI Natural Language Assistant
  ipcMain.handle(
    'mcp:askAssistant',
    async (_event, { query, userContext }: { query: string; userContext: UserContext }) => {
      const rawQ = query.trim();

      // 1. PRIMARY ENGINE: Google Gemini AI Agent with MCP Tool Execution & Natural Formatting
      try {
        const geminiResult = await askGeminiMcpAgent(rawQ, userContext);
        if (geminiResult && geminiResult.reply) {
          return geminiResult;
        }
      } catch (geminiErr) {
        console.warn('[MCP AI] Gemini agent encountered error, falling back to local engine:', geminiErr);
      }

      // Offline / Connection Fallback Notice
      return {
        reply: cleanOutputText(
          'CareFlow AI Assistant requires an active connection to process requests. Please ensure your internet and license connection are active.'
        ),
        toolUsed: 'offline_notice',
        data: null,
      };
    },
  );
}
