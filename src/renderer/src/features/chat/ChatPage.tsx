import { Box, Paper, Typography } from '@mui/material';
import { softCardSx } from '@/components/TableUI';
import { ChatWorkspace } from './ChatWorkspace';

export function ChatPage(): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minHeight: 0 }}>
      <Box>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
          Staff Chat
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Team chat plus direct messages. Green dot means that person is online now.
        </Typography>
      </Box>
      <Paper
        elevation={0}
        sx={{
          ...softCardSx,
          flexGrow: 1,
          minHeight: 420,
          height: { xs: 'calc(100vh - 210px)', md: 'min(720px, calc(100vh - 190px))' },
          overflow: 'hidden',
        }}
      >
        <ChatWorkspace variant="page" />
      </Paper>
    </Box>
  );
}
