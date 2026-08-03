import { Snackbar, Button, Alert, Box, LinearProgress, Typography, Stack } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { useUpdate } from '@/context/updateProvider';

export function UpdateBanner(): React.JSX.Element | null {
  const { isReady, isDownloading, progress, installUpdate } = useUpdate();

  if (!isReady && !isDownloading) return null;

  if (isDownloading) {
    return (
      <Snackbar
        open={isDownloading}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: 99999 }}
      >
        <Alert
          severity="info"
          variant="filled"
          icon={<SystemUpdateAltIcon fontSize="inherit" />}
          sx={{ width: '100%', minWidth: 320 }}
        >
          <Box sx={{ width: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                Downloading software update...
              </Typography>
              <Typography variant="caption" fontWeight={700}>
                {progress}%
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} color="inherit" sx={{ height: 4, borderRadius: 2 }} />
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  return (
    <Snackbar
      open={isReady}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ zIndex: 99999 }}
    >
      <Alert
        severity="success"
        variant="filled"
        icon={<SystemUpdateAltIcon fontSize="inherit" />}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={installUpdate}
            sx={{ fontWeight: 'bold', textTransform: 'none', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
          >
            Restart & Update
          </Button>
        }
      >
        A new update is downloaded and ready to install!
      </Alert>
    </Snackbar>
  );
}