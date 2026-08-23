import {
  Button,
  Input,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DoctorAvatar, avatarFallbackFromRole } from '@/components/DoctorAvatar';
import { useAuth } from '@/features/auth/AuthContext';
import { chatService, type ChatInboxItem, type ChatMessage, type ChatStaff } from '@/services/chat.service';
import { realtimeService } from '@/services/realtime.service';
import { ChatOutlinedIcon, GroupsOutlinedIcon, SearchOutlinedIcon, SendOutlinedIcon } from '@/icons/fluent';
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

const useOnlineStyles = makeStyles({
  wrap: {
    position: 'relative',
    display: 'inline-flex',
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    border: `2px solid ${tokens.colorNeutralBackground1}`,
  },
});

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
  const styles = useOnlineStyles();
  return (
    <div className={styles.wrap}>
      <DoctorAvatar src={src} name={name} size={size} fallback={avatarFallbackFromRole(role)} />
      {online ? <span className={styles.dot} /> : null}
    </div>
  );
}

type ChatWorkspaceProps = {
  variant?: 'page' | 'widget';
  onUnreadChange?: (count: number) => void;
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sidebar: {
    width: '280px',
    flexShrink: 0,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sidebarHead: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalS,
  },
  sidebarTitle: {
    fontWeight: tokens.fontWeightBold,
    marginBottom: tokens.spacingVerticalM,
    display: 'block',
  },
  searchInput: {
    borderRadius: '10px',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  threadList: {
    flexGrow: 1,
    overflow: 'auto',
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingBottom: tokens.spacingVerticalS,
  },
  main: {
    flexGrow: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
  },
  headerPage: {
    color: tokens.colorNeutralForeground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '14px',
    paddingBottom: '14px',
    backgroundColor: 'transparent',
  },
  headerWidget: {
    color: tokens.colorNeutralForegroundOnBrand,
    borderBottom: 'none',
    padding: 0,
    background: `linear-gradient(105deg, ${tokens.colorBrandBackgroundSelected} 0%, ${tokens.colorBrandBackground} 48%, ${tokens.colorBrandBackground2} 100%)`,
  },
  headerRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '10px',
  },
  avatarStack: {
    display: 'flex',
    paddingLeft: '4px',
  },
  avatarOverlap: {
    marginLeft: '-8px',
  },
  headerMeta: {
    minWidth: 0,
  },
  headerTitle: {
    fontWeight: tokens.fontWeightBold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  headerSub: {
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  waveBand: {
    position: 'relative',
    paddingLeft: '14px',
    paddingRight: '14px',
    paddingTop: '3px',
    paddingBottom: '38px',
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  waveHidden: {
    visibility: 'hidden',
    position: 'relative',
    zIndex: 1,
    display: 'block',
  },
  waveSvg: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '-1px',
    width: '100%',
    height: '52px',
    display: 'block',
    pointerEvents: 'none',
  },
  messages: {
    flexGrow: 1,
    overflow: 'auto',
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
  },
  messagesPage: {
    paddingLeft: '20px',
    paddingRight: '20px',
    backgroundColor: tokens.colorBrandBackground2,
  },
  messagesWidget: {
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  emptyMsg: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    marginTop: '64px',
    display: 'block',
  },
  dayLabel: {
    display: 'block',
    textAlign: 'center',
    marginTop: '10px',
    marginBottom: '10px',
    color: tokens.colorNeutralForeground3,
  },
  bubbleRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
    width: '100%',
  },
  bubbleMeta: {
    display: 'block',
    marginBottom: '3px',
    color: tokens.colorNeutralForeground3,
  },
  bubble: {
    position: 'relative',
    overflow: 'visible',
    width: '100%',
    paddingLeft: '11px',
    paddingRight: '11px',
    paddingTop: '7px',
    paddingBottom: '7px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
  },
  composer: {
    paddingTop: '10px',
    paddingBottom: '10px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  composerRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  sendBtn: {
    width: '40px',
    height: '40px',
    minWidth: '40px',
    flexShrink: 0,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
      color: tokens.colorNeutralForegroundOnBrand,
    },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
    },
  },
  threadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    borderRadius: '10px',
    cursor: 'pointer',
    marginBottom: '3px',
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  threadActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  teamIcon: {
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  threadMeta: {
    minWidth: 0,
    flexGrow: 1,
  },
  threadTitleRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '4px',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    flexShrink: 0,
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export function ChatWorkspace({ variant = 'page', onUnreadChange }: ChatWorkspaceProps): React.JSX.Element {
  const styles = useStyles();
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
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });
  const messagesQuery = useQuery({
    queryKey: ['chat', roomId],
    queryFn: () => chatService.list(roomId),
    refetchInterval: 12_000,
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
    <div className={styles.root}>
      {!compact && (
        <div className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <Text className={styles.sidebarTitle} size={400}>Messages</Text>
            <Input
              size="small"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
              placeholder="Search staff"
              className={styles.searchInput}
              contentBefore={<SearchOutlinedIcon style={{ fontSize: 18, color: 'currentColor' }} />}
            />
          </div>
          <div className={styles.threadList}>
            <ThreadRow
              active={isTeamRoom(roomId)}
              compact={false}
              title="Staff team"
              subtitle={inboxByRoom.get(TEAM_CHAT_ROOM)?.lastMessage || 'Clinic-wide chat'}
              time={inboxByRoom.get(TEAM_CHAT_ROOM)?.lastAt}
              unread={isThreadUnread(TEAM_CHAT_ROOM, inboxByRoom.get(TEAM_CHAT_ROOM)?.lastAt, inboxByRoom.get(TEAM_CHAT_ROOM)?.senderId, me)}
              icon={<GroupsOutlinedIcon style={{ fontSize: 22 }} />}
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
          </div>
        </div>
      )}

      <div className={styles.main}>
        <div className={`${styles.header} ${compact ? styles.headerWidget : styles.headerPage}`}>
          <div
            className={styles.headerRow}
            style={compact ? { paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 8 } : undefined}
          >
            {isTeamRoom(roomId) ? (
              <div className={styles.avatarStack}>
                {others.slice(0, 3).map((person, index) => (
                  <div key={person.id} className={index === 0 ? undefined : styles.avatarOverlap} style={index === 0 ? undefined : { marginLeft: -8 }}>
                    <OnlineAvatar src={person.avatar} name={person.name} role={person.role} size={compact ? 28 : 34} online={online.has(person.id)} />
                  </div>
                ))}
              </div>
            ) : (
              <OnlineAvatar
                src={selectedStaff?.avatar}
                name={headerTitle}
                role={selectedStaff?.role}
                size={compact ? 34 : 40}
                online={Boolean(selectedStaff && online.has(selectedStaff.id))}
              />
            )}
            <div className={styles.headerMeta}>
              <Text className={styles.headerTitle} style={{ fontSize: compact ? 14 : 16 }}>
                {compact && isTeamRoom(roomId) ? 'Chat with the team' : headerTitle}
              </Text>
              {!compact ? (
                <Text size={200} className={styles.headerSub}>{headerSub}</Text>
              ) : null}
            </div>
          </div>
          {compact ? (
            <div className={styles.waveBand}>
              <Text size={200} className={styles.waveHidden}>
                We typically reply in a few minutes.
              </Text>
              <svg
                className={styles.waveSvg}
                viewBox="0 0 360 56"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M0 36 C70 52 130 8 220 12 C290 16 330 34 360 30 L360 56 L0 56 Z"
                  fill={tokens.colorNeutralBackground1}
                />
              </svg>
            </div>
          ) : null}
        </div>

        <div className={`${styles.messages} ${compact ? styles.messagesWidget : styles.messagesPage}`}>
          {messages.length === 0 && !messagesQuery.isLoading ? (
            <Text size={300} className={styles.emptyMsg}>
              {isTeamRoom(roomId) ? 'No team messages yet. Say hello.' : `Message ${headerTitle} directly.`}
            </Text>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {messages.map((item, index) => {
              const mine = Boolean(me) && item.senderId === me;
              const showDay = dayKey(item.createdAt) !== dayKey(messages[index - 1]?.createdAt || '');
              const bubbleColor = mine
                ? tokens.colorBrandBackground
                : compact
                  ? '#F1F3F4'
                  : tokens.colorNeutralBackground1;
              const textColor = mine ? tokens.colorNeutralForegroundOnBrand : tokens.colorNeutralForeground1;
              return (
                <div key={item.id}>
                  {showDay && (
                    <Text size={200} className={styles.dayLabel}>
                      {dayLabel(item.createdAt)}
                    </Text>
                  )}
                  <div
                    className={styles.bubbleRow}
                    style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}
                  >
                    {!mine && (
                      <DoctorAvatar
                        src={item.senderAvatar}
                        name={item.senderName}
                        size={26}
                        fallback={avatarFallbackFromRole(item.role)}
                      />
                    )}
                    <div
                      style={
                        compact
                          ? {
                              width: '75%',
                              maxWidth: '75%',
                              flex: '0 0 75%',
                              minWidth: 0,
                              boxSizing: 'border-box',
                            }
                          : {
                              width: 'fit-content',
                              maxWidth: '75%',
                              minWidth: 0,
                              boxSizing: 'border-box',
                            }
                      }
                    >
                      <Text
                        size={200}
                        className={styles.bubbleMeta}
                        style={{ textAlign: mine ? 'right' : 'left' }}
                      >
                        {!mine && isTeamRoom(roomId) ? `${item.senderName} · ` : ''}
                        {formatClock(item.createdAt)}
                      </Text>
                      <div
                        className={styles.bubble}
                        style={{
                          borderRadius: mine ? '8px 8px 0 8px' : '8px 8px 8px 0',
                          backgroundColor: bubbleColor,
                          color: textColor,
                        }}
                      >
                        <Text size={300} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' }}>
                          {item.message}
                        </Text>
                      </div>
                    </div>
                    {mine && (
                      <DoctorAvatar
                        src={item.senderAvatar}
                        name={item.senderName}
                        size={26}
                        fallback={avatarFallbackFromRole(item.role)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div ref={bottomRef} />
        </div>

        <div
          className={styles.composer}
          style={{ paddingLeft: compact ? 10 : 16, paddingRight: compact ? 10 : 16 }}
        >
          <div className={styles.composerRow}>
            <Textarea
              style={{ flex: 1, borderRadius: 10, minHeight: 40 }}
              rows={1}
              placeholder={isTeamRoom(roomId) ? 'Message the team…' : `Message ${headerTitle}…`}
              value={draft}
              onChange={(_, d) => setDraft(d.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              appearance="primary"
              disabled={!canSend}
              onClick={() => submit()}
              className={styles.sendBtn}
              icon={<SendOutlinedIcon style={{ fontSize: 18 }} />}
              aria-label="Send"
            />
          </div>
        </div>
      </div>
    </div>
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
  const styles = useStyles();
  return (
    <div
      onClick={onClick}
      className={`${styles.threadRow}${active ? ` ${styles.threadActive}` : ''}`}
      style={{
        paddingLeft: compact ? 8 : 10,
        paddingRight: compact ? 8 : 10,
        paddingTop: compact ? 7 : 8,
        paddingBottom: compact ? 7 : 8,
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      {avatar || (
        <div
          className={styles.teamIcon}
          style={{ width: compact ? 32 : 40, height: compact ? 32 : 40 }}
        >
          {icon || <ChatOutlinedIcon style={{ fontSize: 18 }} />}
        </div>
      )}
      <div className={styles.threadMeta}>
        <div className={styles.threadTitleRow}>
          <Text
            className={styles.truncate}
            style={{ fontWeight: unread ? 800 : 700, fontSize: compact ? 12.5 : 13.5 }}
          >
            {title}
          </Text>
          {time && (
            <Text
              size={200}
              style={{
                flexShrink: 0,
                color: unread ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3,
              }}
            >
              {formatClock(time)}
            </Text>
          )}
        </div>
        <Text
          size={200}
          className={styles.truncate}
          style={{
            display: 'block',
            color: unread ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground2,
          }}
        >
          {online && !compact ? 'Online · ' : ''}{subtitle}
        </Text>
      </div>
      {unread && <div className={styles.unreadDot} />}
    </div>
  );
}
