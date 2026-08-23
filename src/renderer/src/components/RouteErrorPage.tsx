import { Button, Text, Title2, makeStyles, tokens } from '@fluentui/react-components';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorOutlineIcon, HomeOutlinedIcon, RefreshOutlinedIcon } from '@/icons/fluent';
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router-dom';

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
  },
  center: {
    minHeight: '100%',
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingVerticalXXL,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    maxWidth: '440px',
    width: '100%',
    padding: '28px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
  },
  iconBox: {
    width: '64px',
    height: '64px',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusLarge,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  detail: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground2,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    justifyContent: 'center',
  },
});

function errorMessage(error: unknown): { title: string; detail: string } {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return { title: 'Page not found', detail: 'This screen does not exist or was moved.' };
    }
    return {
      title: `Error ${error.status}`,
      detail: error.statusText || (typeof error.data === 'string' ? error.data : 'Something went wrong loading this page.'),
    };
  }
  if (error instanceof Error) {
    return {
      title: 'Something went wrong',
      detail: error.message || 'An unexpected error stopped this screen.',
    };
  }
  return {
    title: 'Something went wrong',
    detail: 'An unexpected error stopped this screen.',
  };
}

function ErrorFallback({
  title,
  detail,
  onRetry,
  onHome,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
  onHome: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <div className={styles.iconBox}>
          <ErrorOutlineIcon style={{ fontSize: 32 }} />
        </div>
        <Title2>{title}</Title2>
        <Text className={styles.detail} block>
          {detail}
        </Text>
        <div className={styles.actions}>
          <Button appearance="primary" icon={<RefreshOutlinedIcon />} onClick={onRetry}>
            Try again
          </Button>
          <Button appearance="secondary" icon={<HomeOutlinedIcon />} onClick={onHome}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

/** React Router route error UI (`errorElement`). */
export function RouteErrorPage(): React.JSX.Element {
  const styles = useStyles();
  const error = useRouteError();
  const navigate = useNavigate();
  const { title, detail } = errorMessage(error);

  return (
    <div className={styles.page}>
      <ErrorFallback
        title={title}
        detail={detail}
        onRetry={() => navigate(0)}
        onHome={() => navigate('/dashboard', { replace: true })}
      />
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

/** Catches render errors outside / around the router. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const { title, detail } = errorMessage(this.state.error);
    return (
      <div style={{ minHeight: '100vh' }}>
        <ErrorFallback
          title={title}
          detail={detail}
          onRetry={() => this.setState({ error: null })}
          onHome={() => {
            this.setState({ error: null });
            window.location.hash = '#/dashboard';
          }}
        />
      </div>
    );
  }
}
