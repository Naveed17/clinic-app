import { Text, Title2, makeStyles, tokens } from '@fluentui/react-components';
import { ChatWorkspace } from './ChatWorkspace';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    flexGrow: 1,
    minHeight: 0,
  },
  subtitle: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
  },
  card: {
    flexGrow: 1,
    minHeight: '420px',
    height: 'min(720px, calc(100vh - 190px))',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
});

export function ChatPage(): React.JSX.Element {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div>
        <Title2 style={{ letterSpacing: '-0.02em', fontWeight: 900 }}>Staff Chat</Title2>
        <Text className={styles.subtitle} block>
          Team chat plus direct messages. Green dot means that person is online now.
        </Text>
      </div>
      <div className={styles.card}>
        <ChatWorkspace variant="page" />
      </div>
    </div>
  );
}
