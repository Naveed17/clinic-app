import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Fab,
  Tooltip,
  Typography,
  IconButton,
  TextField,
  Chip,
  Avatar,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Zoom,
  Divider,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PaymentsIcon from '@mui/icons-material/Payments';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import InsightsIcon from '@mui/icons-material/Insights';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { useAuth } from '@/features/auth/AuthContext';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolUsed?: string;
  data?: any;
  timestamp: string;
}

function formatCleanText(raw: string): string {
  if (!raw) return '';
  const text = raw.trim();

  // If text is a raw JSON string like {"date":"...","doctors":[...]}
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.doctors && Array.isArray(parsed.doctors)) {
        return `Available Doctors Today:\n\n${parsed.doctors
          .map(
            (d: any, i: number) =>
              `${i + 1}. ${d.name} (${d.specialization || 'Doctor'})\n   Status: ${d.status || 'Available'}${
                d.timing && d.timing !== 'No slots' ? ` | Timing: ${d.timing}` : ''
              }${d.consultationFee ? ` | Fee: Rs. ${Number(d.consultationFee).toLocaleString()}` : ''}`,
          )
          .join('\n\n')}\n\nPlease specify a doctor if you would like to schedule an appointment.`;
      }
      if (parsed.reply) {
        return formatCleanText(parsed.reply);
      }
      if (parsed.totalWaiting !== undefined) {
        return `Clinic Queue: Total ${parsed.totalWaiting} patient(s) waiting.`;
      }
      if (parsed.totalCollected !== undefined) {
        return `Desk Collection: Rs. ${Number(parsed.totalCollected).toLocaleString()} (Cash: Rs. ${Number(parsed.cashCollected || 0).toLocaleString()})`;
      }
    } catch {
      // not valid JSON, fallback to standard clean
    }
  }

  return text
    .replace(/\*+/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    .trim();
}

export function AiAssistantWidget(): React.JSX.Element | null {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const role = user?.role?.toUpperCase() || 'RECEPTIONIST';

  useEffect(() => {
    if (messages.length === 0 && user) {
      // Welcome message based on role
      const initialGreeting =
        role === 'DOCTOR'
          ? `Welcome Dr. ${user.name}! I am your CareFlow AI Assistant. You can ask about today's appointments, OPD consultation earnings, or the live patient queue.`
          : role === 'ADMIN'
            ? `Welcome ${user.name}! CareFlow AI Assistant is ready. Ask about clinic revenue, doctor fees, unpaid invoices, or clinic analytics.`
            : `Welcome ${user.name}! CareFlow AI Assistant is ready. Ask about daily collections, doctor schedules, or live queue status.`;

      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: initialGreeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [user, role, messages.length]);

  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener('careflow:open-ai-assistant', handleOpenEvent);
    return () => window.removeEventListener('careflow:open-ai-assistant', handleOpenEvent);
  }, []);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  if (!user) return null;

  async function handleSend(queryText?: string) {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await window.clinic.mcp.askAssistant(textToSend, {
        userId: user!.id,
        role,
        name: user!.name,
        history: messages.slice(-10).map((m) => ({
          sender: m.sender,
          text: m.text,
          data: m.data,
        })),
      });

      const assistantMsg: Message = {
        id: `${Date.now()}-assistant`,
        sender: 'assistant',
        text: res.reply,
        toolUsed: res.toolUsed,
        data: res.data,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          sender: 'assistant',
          text: `Sorry, unable to process request: ${err?.message || 'Server unreachable'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Quick Action Prompts based on User Role
  const quickChips =
    role === 'DOCTOR'
      ? [
          { label: "Today's Appointments", icon: <CalendarMonthIcon sx={{ fontSize: 16 }} />, query: "What are my appointments for today?" },
          { label: "My OPD Fees", icon: <PaymentsIcon sx={{ fontSize: 16 }} />, query: "Show my OPD consultation fee report" },
          { label: "Patient Queue", icon: <PeopleAltIcon sx={{ fontSize: 16 }} />, query: "How is my patient waiting queue?" },
        ]
      : role === 'ADMIN'
        ? [
            { label: "Full OPD & Revenue", icon: <PaymentsIcon sx={{ fontSize: 16 }} />, query: "Show today's full OPD and revenue report" },
            { label: "Clinic Stats & KPIs", icon: <InsightsIcon sx={{ fontSize: 16 }} />, query: "Show clinic key statistics and KPIs" },
            { label: "Unpaid Invoices", icon: <ReceiptLongIcon sx={{ fontSize: 16 }} />, query: "Show list of unpaid invoices" },
          ]
        : [
            { label: "Daily Collection Report", icon: <PaymentsIcon sx={{ fontSize: 16 }} />, query: "What is today's desk counter collection summary?" },
            { label: "Doctor Availability", icon: <MedicalServicesIcon sx={{ fontSize: 16 }} />, query: "Check doctor availability and schedules for today" },
            { label: "Clinic Queue Summary", icon: <PeopleAltIcon sx={{ fontSize: 16 }} />, query: "Show live clinic queue status" },
          ];

  return (
    <>
      {/* Floating Chat Drawer / Window */}
      <Paper
        elevation={16}
        sx={{
          position: 'fixed',
          right: { xs: 16, sm: 24 },
          bottom: 154,
          width: { xs: 'calc(100vw - 32px)', sm: 390 },
          height: { xs: 'min(540px, calc(100vh - 170px))', sm: 540 },
          zIndex: 1450,
          borderRadius: 1,
          overflow: 'hidden',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', width: 36, height: 36 }}>
              <AutoAwesomeIcon sx={{ color: '#fef08a', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                CareFlow AI Assistant
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: '0.72rem' }}>
                Powered by Clinic MCP • {role}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Clear chat">
              <IconButton size="small" onClick={() => setMessages([])} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#ffffff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Quick Action Chips */}
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'grey.50'),
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {quickChips.map((chip, idx) => (
            <Chip
              key={idx}
              icon={chip.icon}
              label={chip.label}
              size="small"
              clickable
              onClick={() => handleSend(chip.query)}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                height: 30,
                borderRadius: '8px',
                flexShrink: 0,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'primary.main',
                  transform: 'translateY(-1px)',
                },
                '& .MuiChip-icon': {
                  color: 'primary.main',
                  fontSize: 16,
                  ml: 0.75,
                },
                '& .MuiChip-label': {
                  px: 1,
                },
              }}
            />
          ))}
        </Box>

        {/* Messages Body */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
          }}
        >
          {messages.map((msg) => {
            const isMe = msg.sender === 'user';
            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  gap: 1,
                  alignItems: 'flex-start',
                }}
              >
                {!isMe && (
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', mt: 0.5 }}>
                    <SmartToyIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                )}

                <Box sx={{ maxWidth: '85%' }}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: isMe ? 'primary.main' : 'background.paper',
                      color: isMe ? 'primary.contrastText' : 'text.primary',
                      border: isMe ? 'none' : '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {formatCleanText(msg.text)}
                    </Typography>

                    {/* Rich Doctor Availability Card */}
                    {msg.data?.doctors && Array.isArray(msg.data.doctors) && msg.data.doctors.length > 0 && (
                      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: 'text.secondary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <MedicalServicesIcon sx={{ fontSize: 14 }} /> Available Doctors ({msg.data.doctors.length})
                        </Typography>
                        {msg.data.doctors.slice(0, 4).map((d: any) => {
                          const isAvail = d.status?.toLowerCase().includes('avail') || d.scheduledToday;
                          return (
                            <Paper
                              key={d.id}
                              variant="outlined"
                              sx={{
                                p: 1.25,
                                borderRadius: 1.5,
                                bgcolor: 'background.default',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>
                                  {d.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                  {d.specialization || 'Doctor'} {d.timing && d.timing !== 'No slots' ? `• ${d.timing}` : ''}
                                </Typography>
                                {d.consultationFee > 0 && (
                                  <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: '0.7rem' }}>
                                    Fee: Rs. {d.consultationFee.toLocaleString()}
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                                <Chip
                                  label={isAvail ? 'Available' : 'Off Duty'}
                                  size="small"
                                  color={isAvail ? 'success' : 'default'}
                                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                                {role === 'RECEPTIONIST' && (
                                  <Chip
                                    label="Book"
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    clickable
                                    onClick={() => handleSend(`Book an appointment with ${d.name}`)}
                                    sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer' }}
                                  />
                                )}
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    )}

                    {/* Rich Queue Summary Card */}
                    {msg.data?.totalWaiting !== undefined && (
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Total Waiting Patients:
                          </Typography>
                          <Chip
                            label={`${msg.data.totalWaiting} Waiting`}
                            size="small"
                            color={msg.data.totalWaiting > 0 ? 'warning' : 'success'}
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                          />
                        </Stack>
                        {Array.isArray(msg.data.doctors) && msg.data.doctors.length > 0 && (
                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {msg.data.doctors.slice(0, 3).map((doc: any, i: number) => (
                              <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  {doc.doctorName} ({doc.room || 'OPD'}):
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {doc.waitingCount} in line
                                </Typography>
                              </Stack>
                            ))}
                          </Box>
                        )}
                      </Paper>
                    )}

                    {/* Rich Daily Collection Card */}
                    {msg.data?.totalCollected !== undefined && !msg.data?.financials && (
                      <Card variant="outlined" sx={{ mt: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary">Desk Collection:</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main' }}>
                              Rs. {Number(msg.data.totalCollected).toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Cash / Card:</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              Rs. {Number(msg.data.cashCollected || 0).toLocaleString()} / Rs. {Number(msg.data.cardCollected || 0).toLocaleString()}
                            </Typography>
                          </Stack>
                          {msg.data.opdPatientsCount !== undefined && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">OPD Patients:</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {msg.data.opdPatientsCount}
                              </Typography>
                            </Stack>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Rich OPD Fees Card */}
                    {msg.data?.financials && (
                      <Card variant="outlined" sx={{ mt: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary">Net Earnings:</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main' }}>
                              Rs. {msg.data.financials.netDoctorEarnings?.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Gross Fees:</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              Rs. {msg.data.financials.grossConsultationFees?.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Discounts:</Typography>
                            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                              - Rs. {msg.data.financials.totalDiscount?.toLocaleString()}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    )}

                    {/* Rich Single Appointment Booked Confirmation Card */}
                    {msg.data?.appointmentId && (
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)'),
                          borderColor: 'success.main',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {msg.data.patientName} ({msg.data.mrNumber})
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {msg.data.doctorName} • {msg.data.timeFormatted}
                          </Typography>
                        </Box>
                        <Chip label={msg.data.status} size="small" color="success" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                      </Paper>
                    )}

                    {/* Rich Appointments Card */}
                    {msg.data?.appointments && msg.data.appointments.length > 0 && (
                      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {msg.data.appointments.slice(0, 4).map((a: any) => (
                          <Paper
                            key={a.id}
                            variant="outlined"
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: 'background.default',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                                {a.patientName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {a.time} • {a.reason}
                              </Typography>
                            </Box>
                            <Chip label={a.status} size="small" color={a.status === 'SCHEDULED' ? 'primary' : 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, px: 0.5, display: 'block', textAlign: isMe ? 'right' : 'left', fontSize: '0.65rem' }}>
                    {msg.timestamp}
                  </Typography>
                </Box>

                {isMe && (
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', mt: 0.5 }}>
                    <PersonIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                )}
              </Box>
            );
          })}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}>
                <SmartToyIcon sx={{ fontSize: 16 }} />
              </Avatar>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5, px: 0.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'text.secondary',
                    animation: 'geminiPulse 1.4s infinite ease-in-out both',
                    animationDelay: '0s',
                    '@keyframes geminiPulse': {
                      '0%, 80%, 100%': {
                        transform: 'scale(0.4)',
                        opacity: 0.3,
                      },
                      '40%': {
                        transform: 'scale(1)',
                        opacity: 1,
                      },
                    },
                  }}
                />
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'text.secondary',
                    animation: 'geminiPulse 1.4s infinite ease-in-out both',
                    animationDelay: '0.2s',
                  }}
                />
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'text.secondary',
                    animation: 'geminiPulse 1.4s infinite ease-in-out both',
                    animationDelay: '0.4s',
                  }}
                />
              </Box>
            </Box>
          )}
          <div ref={scrollRef} />
        </Box>

        <Divider />

        {/* Input Bar */}
        <Box sx={{ p: 1.5, bgcolor: 'background.paper', display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask CareFlow AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
                fontSize: '0.85rem',
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: '#ffffff',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              borderRadius: 1,
              p: 1,
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Paper>

      {/* Floating Trigger Button */}
      <Zoom in>
        <Box sx={{ position: 'fixed', right: 24, bottom: 88, zIndex: 1400 }}>
          <Tooltip title={open ? 'Close CareFlow AI' : 'CareFlow AI Assistant'} placement="left">
            <Fab
              onClick={() => setOpen((prev) => !prev)}
              sx={{
                background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(13, 148, 136, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #047857 0%, #0f766e 100%)',
                },
              }}
            >
              {open ? <CloseIcon /> : <AutoAwesomeIcon sx={{ color: '#fef08a' }} />}
            </Fab>
          </Tooltip>
        </Box>
      </Zoom>
    </>
  );
}
