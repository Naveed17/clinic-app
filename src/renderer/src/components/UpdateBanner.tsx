import { useEffect, useState } from 'react';
import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useUpdate } from '@/context/updateProvider';
import { CloseIcon, SystemUpdateAltIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  wrap: {
    position: 'fixed',
    bottom: tokens.spacingVerticalXXL,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 99999,
    maxWidth: '520px',
    width: 'calc(100% - 32px)',
  },
});

export function UpdateBanner(): React.JSX.Element | null {
  const styles = useStyles();
  const { isReady, isDownloading, installUpdate } = useUpdate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isReady) {
      setDismissed(false);
    }
  }, [isReady]);

  if (dismissed || (!isReady && !isDownloading)) return null;

  return (
    <div className={styles.wrap}>
      <MessageBar intent={isReady ? 'success' : 'info'} icon={<SystemUpdateAltIcon />}>
        <MessageBarBody>
          <MessageBarTitle>
            {isReady
              ? 'A new software update is ready to install!'
              : 'Downloading update…'}
          </MessageBarTitle>
        </MessageBarBody>
        <MessageBarActions
          containerAction={
            <Button
              appearance="transparent"
              icon={<CloseIcon />}
              aria-label="close"
              onClick={() => setDismissed(true)}
            />
          }
        >
          {isReady ? (
            <Button appearance="primary" size="small" onClick={installUpdate}>
              Restart & Update
            </Button>
          ) : null}
        </MessageBarActions>
      </MessageBar>
    </div>
  );
}
