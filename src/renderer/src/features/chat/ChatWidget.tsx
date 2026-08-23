import { Badge, Button, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { Chat24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ChatWorkspace } from './ChatWorkspace';

const useStyles = makeStyles({
  panel: {
    position: 'fixed',
    right: '24px',
    bottom: '92px',
    width: '360px',
    maxWidth: 'calc(100vw - 32px)',
    height: '520px',
    maxHeight: 'calc(100vh - 130px)',
    zIndex: 1400,
    overflow: 'hidden',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: tokens.shadow64,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  fabWrap: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    zIndex: 1400,
  },
  fab: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    minWidth: '56px',
    boxShadow: '0 12px 28px rgba(22, 163, 74, 0.35)',
  },
});

export function ChatWidget(): React.JSX.Element | null {
  const styles = useStyles();
  const { user } = useAuth();
  const { can } = useLicense();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  if (!user || !can('chat') || location.pathname === '/chat') return null;

  return (
    <>
      <div className={styles.panel} style={{ display: open ? 'flex' : 'none' }}>
        <ChatWorkspace variant="widget" onUnreadChange={setUnread} />
      </div>
      <div className={styles.fabWrap}>
        <Tooltip content={open ? 'Close chat' : 'Staff chat'} relationship="label" positioning="before">
          <Badge
            appearance="filled"
            color="danger"
            size="medium"
            style={open || unread === 0 ? { visibility: 'hidden' } : undefined}
          >
            {/* Badge wraps button via children in Fluent — use separate badge overlay */}
          </Badge>
        </Tooltip>
        <Tooltip content={open ? 'Close chat' : 'Staff chat'} relationship="label" positioning="before">
          <div style={{ position: 'relative' }}>
            {!open && unread > 0 && (
              <Badge
                appearance="filled"
                color="danger"
                size="small"
                style={{ position: 'absolute', top: -4, right: -4, zIndex: 1 }}
              >
                {Math.min(unread, 9)}
              </Badge>
            )}
            <Button
              appearance="primary"
              className={styles.fab}
              icon={open ? <Dismiss24Regular /> : <Chat24Regular />}
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Close chat' : 'Staff chat'}
            />
          </div>
        </Tooltip>
      </div>
    </>
  );
}
