import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage(): React.JSX.Element {
  return (
    <Box
      sx={{ display: 'grid', minHeight: '100vh', placeItems: 'center', textAlign: 'center', p: 3 }}
    >
      <div>
        <Typography variant="h4" component="h1">
          Page not found
        </Typography>
        <Button component={RouterLink} to="/dashboard" sx={{ mt: 2 }} variant="contained">
          Return to dashboard
        </Button>
      </div>
    </Box>
  );
}
