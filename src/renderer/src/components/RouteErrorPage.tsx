import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router-dom';

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
  const theme = useTheme();
  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 440,
          width: '100%',
          p: 3.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          boxShadow: `0 8px 28px ${alpha(theme.palette.common.black, 0.06)}`,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: 'auto',
            mb: 2,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.error.main, 0.1),
            color: 'error.main',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          {detail}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<RefreshOutlinedIcon />}
            onClick={onRetry}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Try again
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeOutlinedIcon />}
            onClick={onHome}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Go to dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

/** React Router route error UI (`errorElement`). */
export function RouteErrorPage(): React.JSX.Element {
  const error = useRouteError();
  const navigate = useNavigate();
  const { title, detail } = errorMessage(error);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <ErrorFallback
        title={title}
        detail={detail}
        onRetry={() => navigate(0)}
        onHome={() => navigate('/dashboard', { replace: true })}
      />
    </Box>
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
      <Box sx={{ minHeight: '100vh' }}>
        <ErrorFallback
          title={title}
          detail={detail}
          onRetry={() => this.setState({ error: null })}
          onHome={() => {
            this.setState({ error: null });
            window.location.hash = '#/dashboard';
          }}
        />
      </Box>
    );
  }
}
