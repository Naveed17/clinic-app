import { useEffect, useState } from 'react';
import { Snackbar, Button, Alert } from '@mui/material';

export function UpdateBanner(): React.JSX.Element | null {
  const [ready, setReady] = useState(false);

  useEffect(() => {

    const updateApi = window.clinic?.update;
    if (!updateApi) return;
    const unSub = updateApi.onReady(() => {
      setReady(true);
    });

    return () => {
      if (typeof unSub === 'function') unSub();
    };
  }, []);

  if (!ready) return null;

  return (
    <Snackbar
      open={ready}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ zIndex: 99999 }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.clinic?.update?.install()}
            sx={{ fontWeight: 'bold' }}
          >
            Restart & Update
          </Button>
        }
      >
        A new update is ready to install.
      </Alert>
    </Snackbar>
  );
}