import React, { useState, useEffect } from 'react';
import { Snackbar, Button, Alert, IconButton } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CloseIcon from '@mui/icons-material/Close';
import { useUpdate } from '@/context/updateProvider';

export function UpdateBanner(): React.JSX.Element | null {
  const { isReady, isDownloading, installUpdate } = useUpdate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isReady) {
      setDismissed(false);
    }
  }, [isReady]);

  if (dismissed || (!isReady && !isDownloading)) return null;

  return (
    <Snackbar
      open={!dismissed && (isReady || isDownloading)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ zIndex: 99999 }}
    >
      <Alert
        severity={isReady ? 'success' : 'info'}
        variant="filled"
        icon={<SystemUpdateAltIcon fontSize="inherit" />}
        action={
          <>
            {isReady && (
              <Button
                color="inherit"
                size="small"
                onClick={installUpdate}
                sx={{
                  fontWeight: 'bold',
                  textTransform: 'none',
                  mr: 1,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Restart & Update
              </Button>
            )}
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={() => setDismissed(true)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{ alignItems: 'center' }}
      >
        {isReady
          ? 'A new software update is ready to install!'
          : 'Downloading update…'}
      </Alert>
    </Snackbar>
  );
}