import { useEffect, useState } from 'react';
import { Snackbar, Button, Alert } from '@mui/material';

export function UpdateBanner(): React.JSX.Element | null {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.clinic?.update) return;
    const unsub = window.clinic.update.onReady(() => setReady(true));
    return unsub;
  }, []);

  if (!ready) return null;

  return (
    <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={() => window.clinic.update.install()}>
            Restart & Update
          </Button>
        }
      >
        A new update is ready to install.
      </Alert>
    </Snackbar>
  );
}
