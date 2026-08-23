import { Button, Title2, makeStyles, tokens } from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles({
  root: {
    display: 'grid',
    minHeight: '100vh',
    placeItems: 'center',
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
  },
  actions: {
    marginTop: tokens.spacingVerticalL,
  },
});

export function NotFoundPage(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();

  return (
    <div className={styles.root}>
      <div>
        <Title2 as="h1">Page not found</Title2>
        <div className={styles.actions}>
          <Button appearance="primary" onClick={() => navigate('/dashboard')}>
            Return to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
