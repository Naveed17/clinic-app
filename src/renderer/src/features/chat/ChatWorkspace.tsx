import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import {
  Badge,
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DoctorAvatar, avatarFallbackFromRole } from '@/components/DoctorAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { chatService, type ChatInboxItem, type ChatMessage, type ChatStaff } from '@/services/chat.service';
import { realtimeService } from '@/services/realtime.service';
import {
  CHAT_ROOM_STORAGE,
  TEAM_CHAT_ROOM,
  dmRoomId,
  isTeamRoom,
  isThreadUnread,
  markRoomRead,
  otherUserId,
} from './chatRooms';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Reception',
  lab_technician: 'Lab',
  pharmacist: 'Pharmacy',
};

function roleLabel(role?: string): string {
  const key = String(role || '').toLowerCase();
  return ROLE_LABELS[key] || (role ? role.replace(/_/g, ' ') : 'Staff');
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString();
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function OnlineAvatar({
  src,
  name,
  role,
  size,
  online,
}: {
  src?: string | null;
  name: string;
  role?: string;
  size: number;
  online?: boolean;
}): React.JSX.Element {
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      invisible={!online}
      sx={{
        '& .MuiBadge-dot': {
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: '#22c55e',
          border: '2px solid',
          borderColor: 'background.paper',
        },
      }}
    >
      <DoctorAvatar src={src} name={name} size={size} fallback={avatarFallbackFromRole(role)} />
    </Badge>
  );
}

type ChatWorkspaceProps = {
  variant?: 'page' | 'widget';
  onUnreadChange?: (count: number) => void;
};

export function ChatWorkspace({ variant = 'page', onUnreadChange }: ChatWorkspaceProps): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const me = user?.id || '';
  const compact = variant === 'widget';
  const [roomId, setRoomId] = useState(() => window.sessionStorage.getItem(CHAT_ROOM_STORAGE) || TEAM_CHAT_ROOM);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const online = useMemo(() => new Set(onlineIds), [onlineIds]);

  const staffQuery = useQuery({
    queryKey: ['chat-staff'],
    queryFn: () => chatService.staff(),
  });
  const inboxQuery = useQuery({
    queryKey: ['chat-inbox', me],
    queryFn: () => chatService.inbox(me),
    enabled: Boolean(me),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
  const messagesQuery = useQuery({
    queryKey: ['chat', roomId],
    queryFn: () => chatService.list(roomId),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const staff = staffQuery.data || [];
  const inbox = inboxQuery.data || [];
  const inboxByRoom = useMemo(() => {
    const map = new Map<string, ChatInboxItem>();
    for (const item of inbox) map.set(item.roomId, item);
    return map;
  }, [inbox]);

  const others = staff.filter((person) => person.id !== me);
  const filtered = others.filter((person) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${person.name} ${person.role}`.toLowerCase().includes(q);
  });

  const unreadCount = useMemo(() => {
    let n = 0;
    if (isThreadUnread(TEAM_CHAT_ROOM, inboxByRoom.get(TEAM_CHAT_ROOM)?.lastAt, inboxByRoom.get(TEAM_CHAT_ROOM)?.senderId, me)) n += 1;
    for (const person of others) {
      const room = dmRoomId(me, person.id);
      const item = inboxByRoom.get(room);
      if (isThreadUnread(room, item?.lastAt, item?.senderId, me)) n += 1;
    }
    return n;
  }, [inboxByRoom, me, others]);

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [onUnreadChange, unreadCount]);

  const selectedStaff: ChatStaff | undefined = useMemo(() => {
    const other = otherUserId(roomId, me);
    return staff.find((person) => person.id === other);
  }, [me, roomId, staff]);

  const headerTitle = isTeamRoom(roomId) ? 'Staff team' : selectedStaff?.name || 'Direct message';
  const headerSub = isTeamRoom(roomId)
    ? `${others.filter((p) => online.has(p.id)).length} online · everyone in this clinic`
    : `${roleLabel(selectedStaff?.role)}${selectedStaff && online.has(selectedStaff.id) ? ' · Online' : ''}`;

  const send = useMutation({
    mutationFn: (message: string) =>
      chatService.send({
        roomId,
        senderId: me,
        senderName: user?.name || 'Staff',
        role: user?.role || '',
        message,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', roomId], (prev) => {
        const list = prev || [];
        if (list.some((item) => item.id === created.id)) return list;
        return [...list, created];
      });
      void queryClient.invalidateQueries({ queryKey: ['chat-inbox', me] });
      setDraft('');
    },
  });

  useEffect(() => {
    window.sessionStorage.setItem(CHAT_ROOM_STORAGE, roomId);
  }, [roomId]);

  useEffect(() => {
    if (!me) return;
    void realtimeService.identify(me);
    const unsubPresence = realtimeService.onPresence((payload) => {
      setOnlineIds(Array.isArray(payload?.userIds) ? payload.userIds : []);
    });
    const unsubMessage = realtimeService.onChatMessage((message) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', message.roomId], (prev) => {
        const list = prev || [];
        if (list.some((item) => item.id === message.id)) return list;
        return [...list, message];
      });
      void queryClient.invalidateQueries({ queryKey: ['chat-inbox', me] });
      if (compact && message.senderId && message.senderId !== me && message.roomId) {
        setRoomId(message.roomId);
        setDraft('');
      }
    });
    return () => {
      unsubPresence();
      unsubMessage();
    };
  }, [compact, me, queryClient]);

  const messages = messagesQuery.data || [];
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    const last = messages[messages.length - 1];
    if (last) markRoomRead(roomId, last.createdAt);
  }, [messages, roomId]);

  const canSend = draft.trim().length > 0 && !send.isPending && Boolean(me);

  function openRoom(next: string): void {
    setRoomId(next);
    setDraft('');
  }

  function submit(): void {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexGrow: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {!compact && (
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.25 }}>
            Messages
          </Typography>
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.default' } }}
          />
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'auto', px: 0.75, pb: 1 }}>
          <ThreadRow
            active={isTeamRoom(roomId)}
            compact={false}
            title="Staff team"
            subtitle={inboxByRoom.get(TEAM_CHAT_ROOM)?.lastMessage || 'Clinic-wide chat'}
            time={inboxByRoom.get(TEAM_CHAT_ROOM)?.lastAt}
            unread={isThreadUnread(TEAM_CHAT_ROOM, inboxByRoom.get(TEAM_CHAT_ROOM)?.lastAt, inboxByRoom.get(TEAM_CHAT_ROOM)?.senderId, me)}
            icon={<GroupsOutlinedIcon sx={{ fontSize: 22 }} />}
            onClick={() => openRoom(TEAM_CHAT_ROOM)}
          />
          {filtered.map((person) => {
            const room = dmRoomId(me, person.id);
            const item = inboxByRoom.get(room);
            return (
              <ThreadRow
                key={person.id}
                active={roomId === room}
                compact={false}
                title={person.name}
                subtitle={item?.lastMessage || roleLabel(person.role)}
                time={item?.lastAt}
                unread={isThreadUnread(room, item?.lastAt, item?.senderId, me)}
                online={online.has(person.id)}
                avatar={<OnlineAvatar src={person.avatar} name={person.name} role={person.role} size={40} online={online.has(person.id)} />}
                onClick={() => openRoom(room)}
              />
            );
          })}
        </Box>
      </Box>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            position: 'relative',
            color: compact ? 'primary.contrastText' : 'text.primary',
            borderBottom: compact ? 'none' : '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            px: compact ? 0 : 2.5,
            pt: compact ? 0 : 1.75,
            pb: compact ? 0 : 1.75,
            bgcolor: compact ? 'primary.main' : 'transparent',
            background: compact
              ? `linear-gradient(105deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 48%, ${theme.palette.primary.light} 100%)`
              : undefined,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              position: 'relative',
              zIndex: 1,
              px: compact ? 1.75 : 0,
              pt: compact ? 1.5 : 0,
              pb: compact ? 1 : 0,
            }}
          >
            {isTeamRoom(roomId) ? (
              <Box sx={{ display: 'flex', pl: 0.5 }}>
                {others.slice(0, 3).map((person, index) => (
                  <Box key={person.id} sx={{ ml: index === 0 ? 0 : -1 }}>
                    <OnlineAvatar src={person.avatar} name={person.name} role={person.role} size={compact ? 28 : 34} online={online.has(person.id)} />
                  </Box>
                ))}
              </Box>
            ) : (
              <OnlineAvatar
                src={selectedStaff?.avatar}
                name={headerTitle}
                role={selectedStaff?.role}
                size={compact ? 34 : 40}
                online={Boolean(selectedStaff && online.has(selectedStaff.id))}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap fontSize={compact ? 14 : 16}>
                {compact && isTeamRoom(roomId) ? 'Chat with the team' : headerTitle}
              </Typography>
              {!compact ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {headerSub}
                </Typography>
              ) : null}
            </Box>
          </Stack>
          {compact ? (
            <Box
              sx={{
                position: 'relative',
                px: 1.75,
                pt: 0.4,
                pb: 4.75,
                bgcolor: alpha(theme.palette.common.black, 0.14),
              }}
            >
              <Typography
                variant="caption"
                sx={{ visibility: 'hidden', position: 'relative', zIndex: 1, display: 'block' }}
                noWrap
              >
                We typically reply in a few minutes.
              </Typography>
              <Box
                component="svg"
                viewBox="0 0 360 56"
                preserveAspectRatio="none"
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: -1,
                  width: '100%',
                  height: 52,
                  display: 'block',
                  pointerEvents: 'none',
                }}
              >
                <path
                  d="M0 36 C70 52 130 8 220 12 C290 16 330 34 360 30 L360 56 L0 56 Z"
                  fill={theme.palette.background.paper}
                />
              </Box>
            </Box>
          ) : null}
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            px: compact ? 1.5 : 2.5,
            py: 2,
            bgcolor: compact ? 'background.paper' : alpha(theme.palette.primary.main, 0.02),
          }}
        >
          {messages.length === 0 && !messagesQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 8 }}>
              {isTeamRoom(roomId) ? 'No team messages yet. Say hello.' : `Message ${headerTitle} directly.`}
            </Typography>
          ) : null}
          <Stack spacing={1.1}>
            {messages.map((item, index) => {
              const mine = Boolean(me) && item.senderId === me;
              const showDay = dayKey(item.createdAt) !== dayKey(messages[index - 1]?.createdAt || '');
              const isDark = theme.palette.mode === 'dark';
              const bubbleColor = mine
                ? theme.palette.primary.main
                : isDark
                  ? alpha(theme.palette.common.white, 0.08)
                  : compact
                    ? '#F1F3F4'
                    : theme.palette.background.paper;
              return (
                <Box key={item.id}>
                  {showDay && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', my: 1.25 }}>
                      {dayLabel(item.createdAt)}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent={mine ? 'flex-end' : 'flex-start'}
                    alignItems="flex-end"
                    sx={{ width: '100%' }}
                  >
                    {!mine && (
                      <DoctorAvatar
                        src={item.senderAvatar}
                        name={item.senderName}
                        size={26}
                        fallback={avatarFallbackFromRole(item.role)}
                      />
                    )}
                    <Box
                      sx={{
                        width: 'fit-content',
                        maxWidth: compact ? '85%' : '75%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        ml: mine ? 'auto' : 0,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ display: 'block', mb: 0.4, textAlign: mine ? 'right' : 'left' }}
                      >
                        {!mine && isTeamRoom(roomId) ? `${item.senderName} · ` : ''}
                        {formatClock(item.createdAt)}
                      </Typography>
                      <Box
                        sx={{
                          position: 'relative',
                          overflow: 'visible',
                          width: '100%',
                          px: 1.4,
                          py: 0.9,
                          borderRadius: mine ? '8px 8px 0 8px' : '8px 8px 8px 0',
                          backgroundColor: bubbleColor,
                          color: mine ? 'primary.contrastText' : 'text.primary',
                          boxShadow: `0 4px 14px ${alpha(theme.palette.common.black, 0.05)}`,
                          '&::before, &::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: 0,
                            width: 10,
                            height: 10,
                            [mine ? 'right' : 'left']: -8,
                            backgroundColor: 'inherit',
                            clipPath: mine
                              ? 'polygon(0 0, 0 100%, 100% 100%)'
                              : 'polygon(100% 0, 0 100%, 100% 100%)',
                          },
                          '&::before': {
                            zIndex: 0,
                            filter: `drop-shadow(0 3px 4px ${alpha(theme.palette.common.black, 0.12)})`,
                          },
                          '&::after': {
                            zIndex: 1,
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {item.message}
                        </Typography>
                      </Box>
                    </Box>
                    {mine && (
                      <DoctorAvatar
                        src={item.senderAvatar}
                        name={item.senderName}
                        size={26}
                        fallback={avatarFallbackFromRole(item.role)}
                      />
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <div ref={bottomRef} />
        </Box>

        <Box sx={{ px: compact ? 1.25 : 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={1}
              maxRows={4}
              placeholder={isTeamRoom(roomId) ? 'Message the team…' : `Message ${headerTitle}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  py: 1,
                  px: 1.5,
                  fontSize: 13.5,
                  lineHeight: 1.4,
                },
                '& .MuiOutlinedInput-input': {
                  p: 0,
                },
              }}
            />
            <IconButton
              color="primary"
              disabled={!canSend}
              onClick={() => submit()}
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              }}
            >
              <SendOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function ThreadRow({
  active,
  compact,
  title,
  subtitle,
  time,
  unread,
  online,
  avatar,
  icon,
  onClick,
}: {
  active: boolean;
  compact: boolean;
  title: string;
  subtitle: string;
  time?: string;
  unread?: boolean;
  online?: boolean;
  avatar?: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: compact ? 1 : 1.25,
        py: compact ? 0.85 : 1.05,
        mb: 0.4,
        borderRadius: '10px',
        cursor: 'pointer',
        bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.12) : 'transparent',
        '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, active ? 0.14 : 0.06) },
      }}
    >
      {avatar || (
        <Box
          sx={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {icon || <ChatOutlinedIcon fontSize="small" />}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" spacing={0.5}>
          <Typography fontWeight={unread ? 800 : 700} noWrap fontSize={compact ? 12.5 : 13.5}>
            {title}
          </Typography>
          {time && (
            <Typography variant="caption" color={unread ? 'primary.main' : 'text.disabled'} sx={{ flexShrink: 0 }}>
              {formatClock(time)}
            </Typography>
          )}
        </Stack>
        <Typography variant="caption" color={unread ? 'text.primary' : 'text.secondary'} noWrap sx={{ display: 'block' }}>
          {online && !compact ? 'Online · ' : ''}{subtitle}
        </Typography>
      </Box>
      {unread && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
    </Box>
  );
}
