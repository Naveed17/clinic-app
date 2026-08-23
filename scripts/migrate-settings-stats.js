/* eslint-disable no-console */
const fs = require('fs');

function save(file, text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\0/g, '');
  fs.writeFileSync(file, clean, 'utf8');
  const b = fs.readFileSync(file);
  console.log(
    file,
    'bytes=',
    b.length,
    'nulls=',
    [...b].filter((x) => x === 0).length,
    'mui=',
    /@mui/.test(clean),
  );
}

function stripSx(attrs) {
  return attrs
    .replace(/\s*sx=\{\{[\s\S]*?\}\}/g, '')
    .replace(/\s*sx=\{[^}]+\}/g, '')
    .replace(/\s*elevation=\{\d+\}/g, '')
    .replace(/\s*variant="outlined"/g, '')
    .replace(/\s*variant="contained"/g, '')
    .replace(/\s*variant="text"/g, '')
    .replace(/\s*size="small"/g, '')
    .replace(/\s*fullWidth/g, '')
    .replace(/\s*disableElevation/g, '')
    .replace(/\s*disableRipple/g, '');
}

function migrateSettings(src) {
  let s = src;

  // Icons
  s = s.replace(/import (\w+) from '@mui\/icons-material\/\1';\r?\n/g, '');
  s = s.replace(
    /from 'react';\r?\nimport \{[\s\S]*?\} from '@mui\/material';\r?\n/,
    `from 'react';
import {
  Badge,
  Button,
  Divider,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Skeleton,
  Tab,
  TabList,
  Text,
  Textarea,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  DnsOutlinedIcon,
  LaptopOutlinedIcon,
  DevicesOutlinedIcon,
  BackupOutlinedIcon,
  RestoreOutlinedIcon,
  CloudUploadOutlinedIcon,
  CloudDownloadOutlinedIcon,
  CloudOutlinedIcon,
  SystemUpdateAltOutlinedIcon,
  WifiTetheringOutlinedIcon,
  AutoAwesomeOutlinedIcon,
  TuneOutlinedIcon,
  WhatsAppIcon,
  CampaignOutlinedIcon,
  SupportAgentOutlinedIcon,
  EmailOutlinedIcon,
  LocalPhoneOutlinedIcon,
  ImageOutlinedIcon,
} from '@/icons/fluent';
`,
  );

  // Remove leftover mui icon imports if any
  s = s.replace(/import \w+ from '@mui\/icons-material\/[^']+';\r?\n/g, '');
  s = s.replace(/import \{[^}]+\} from '@mui\/material\/styles';\r?\n/g, '');
  s = s.replace(/import \{[^}]+\} from '@mui\/material';\r?\n/g, '');

  // Insert makeStyles before export function
  if (!s.includes('const useStyles = makeStyles')) {
    s = s.replace(
      /export function SettingsPage/,
      `const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalL },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  row: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: tokens.spacingHorizontalM, flexWrap: 'wrap' },
  card: {
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusXLarge,
    border: \`1px solid \${tokens.colorNeutralStroke2}\`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  muted: { color: tokens.colorNeutralForeground2 },
  toggleGroup: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  toggleBtn: { minWidth: '130px', height: 'auto', padding: tokens.spacingVerticalM },
  logoBox: {
    width: '72px', height: '72px', borderRadius: tokens.borderRadiusMedium,
    border: \`1px solid \${tokens.colorNeutralStroke2}\`, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  toast: { position: 'fixed', right: '24px', bottom: '24px', zIndex: 1000, maxWidth: '380px' },
});

export function SettingsPage`,
    );
  }

  s = s.replace(
    /export function SettingsPage\(\): React\.JSX\.Element \{\r?\n\s*const theme = useTheme\(\);\r?\n/,
    `export function SettingsPage(): React.JSX.Element {
  const styles = useStyles();
`,
  );
  s = s.replace(/\s*const theme = useTheme\(\);\r?\n/, '\n');

  // alpha(...) → tokens
  s = s.replace(/alpha\(theme\.palette\.\w+(?:\.\w+)?, [^)]+\)/g, 'tokens.colorNeutralBackground3');
  s = s.replace(/theme\.palette\.primary\.main/g, 'tokens.colorBrandForeground1');
  s = s.replace(/theme\.palette\.text\.secondary/g, 'tokens.colorNeutralForeground2');
  s = s.replace(/theme\.palette\.text\.primary/g, 'tokens.colorNeutralForeground1');
  s = s.replace(/theme\.palette\.divider/g, 'tokens.colorNeutralStroke2');
  s = s.replace(/theme\.palette\.background\.paper/g, 'tokens.colorNeutralBackground1');
  s = s.replace(/theme\.spacing\((\d+)\)/g, 'tokens.spacingVerticalM');

  // Structural tags
  s = s.replace(/<Stack\b([^>]*)>/g, (_, a) => `<div className={styles.stack}${stripSx(a)}>`);
  s = s.replace(/<\/Stack>/g, '</div>');
  s = s.replace(/<Box\b([^>]*)>/g, (_, a) => `<div${stripSx(a)}>`);
  s = s.replace(/<\/Box>/g, '</div>');
  s = s.replace(/<Paper\b([^>]*)>/g, (_, a) => `<div className={styles.card}${stripSx(a)}>`);
  s = s.replace(/<\/Paper>/g, '</div>');

  s = s.replace(/<Typography\s+variant="h[456]"([^>]*)>/g, (_, a) => `<Title3${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="subtitle[12]"([^>]*)>/g, (_, a) => `<Text weight="semibold"${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="body2"([^>]*)>/g, (_, a) => `<Text size={200} className={styles.muted}${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="caption"([^>]*)>/g, (_, a) => `<Text size={100} className={styles.muted}${stripSx(a)}>`);
  s = s.replace(/<Typography\b([^>]*)>/g, (_, a) => `<Text${stripSx(a)}>`);
  s = s.replace(/<\/Typography>/g, '</Text>');

  s = s.replace(/<Alert\s+severity="(\w+)"([^>]*)>/g, '<MessageBar intent="$1"$2><MessageBarBody>');
  s = s.replace(/<Alert\b([^>]*)>/g, '<MessageBar intent="info"$1><MessageBarBody>');
  s = s.replace(/<\/Alert>/g, '</MessageBarBody></MessageBar>');

  s = s.replace(/<Chip\b([^>]*)\/>/g, (_, a) => {
    const label = (a.match(/label=\{([^}]+)\}/) || a.match(/label="([^"]+)"/) || [])[1] || '';
    return `<Badge appearance="tint">${label.startsWith('{') ? label : `{${JSON.stringify(label)}}`}</Badge>`;
  });
  s = s.replace(/<Chip\b([^>]*)>([\s\S]*?)<\/Chip>/g, '<Badge appearance="tint"$1>$2</Badge>');

  s = s.replace(/<LinearProgress\b([^>]*)\/>/g, '<ProgressBar$1 />');
  s = s.replace(/variant="determinate"\s*/g, '');
  s = s.replace(/variant="indeterminate"\s*/g, '');

  // TextField → Field+Input (best-effort)
  s = s.replace(
    /<TextField\b([^>]*?)\/>/g,
    (_, a) => {
      const label = (a.match(/label="([^"]+)"/) || [])[1] || '';
      const value = (a.match(/value=\{([^}]+)\}/) || [])[1] || "''";
      const onChange = (a.match(/onChange=\{([^}]+)\}/) || [])[1] || '';
      const type = (a.match(/type="([^"]+)"/) || [])[1] || 'text';
      const multiline = /multiline/.test(a);
      const control = multiline
        ? `<Textarea value={${value}} ${onChange ? `onChange={${onChange}}` : ''} />`
        : `<Input type="${type}" value={String(${value})} ${onChange ? `onChange={${onChange}}` : ''} />`;
      return `<Field label="${label}">${control}</Field>`;
    },
  );

  // Tabs
  s = s.replace(
    /<Tabs\s+value=\{([^}]+)\}\s+onChange=\{[^}]*setSettingsTab[^}]*\}([^>]*)>/g,
    '<TabList selectedValue={$1} onTabSelect={(_, d) => setSettingsTab(d.value as typeof settingsTab)}>',
  );
  s = s.replace(
    /<Tabs\s+value=\{([^}]+)\}\s+onChange=\{\([^)]*\)\s*=>\s*setSettingsTab\(([^)]+)\)\}([^>]*)>/g,
    '<TabList selectedValue={$1} onTabSelect={(_, d) => setSettingsTab(d.value as typeof settingsTab)}>',
  );
  s = s.replace(/<\/Tabs>/g, '</TabList>');
  s = s.replace(
    /<Tab\s+icon=\{([^}]+)\}\s+iconPosition="start"\s+label="([^"]+)"\s+value="([^"]+)"([^>]*)\/>/g,
    '<Tab icon={$1} value="$3">$2</Tab>',
  );
  s = s.replace(
    /<Tab\s+value="([^"]+)"\s+icon=\{([^}]+)\}\s+iconPosition="start"\s+label="([^"]+)"([^>]*)\/>/g,
    '<Tab icon={$2} value="$1">$3</Tab>',
  );

  // ToggleButtonGroup → div of Buttons
  s = s.replace(/<ToggleButtonGroup\b([^>]*)>/g, '<div className={styles.toggleGroup}>');
  s = s.replace(/<\/ToggleButtonGroup>/g, '</div>');
  s = s.replace(
    /<ToggleButton\b([^>]*)>/g,
    (_, a) => {
      const value = (a.match(/value="([^"]+)"/) || a.match(/value=\{([^}]+)\}/) || [])[1] || '';
      return `<Button className={styles.toggleBtn} appearance="secondary" data-value={${value.includes('"') || value.includes("'") ? value : JSON.stringify(value)}}>`;
    },
  );
  s = s.replace(/<\/ToggleButton>/g, '</Button>');

  // Snackbar → fixed MessageBar
  s = s.replace(/<Snackbar\b[\s\S]*?\/>/g, '{null}');
  s = s.replace(/<Snackbar\b[\s\S]*?<\/Snackbar>/g, '{null}');

  // Button variants
  s = s.replace(/\s*variant="contained"/g, ' appearance="primary"');
  s = s.replace(/\s*variant="outlined"/g, ' appearance="secondary"');
  s = s.replace(/\s*variant="text"/g, ' appearance="transparent"');
  s = s.replace(/\s*startIcon=\{/g, ' icon={');
  s = s.replace(/\s*endIcon=\{/g, ' icon={');
  s = s.replace(/\s*color="(primary|error|success|inherit|secondary)"/g, '');

  // Clean remaining sx
  s = s.replace(/\s*sx=\{\{[\s\S]*?\}\}/g, '');
  s = s.replace(/\s*sx=\{[^}]+\}/g, '');

  return s;
}

function migrateStats(src) {
  let s = src;

  s = s.replace(/import \w+ from '@mui\/icons-material\/[^']+';\r?\n/g, '');
  s = s.replace(/import \{[^}]+\} from '@mui\/material\/styles';\r?\n/g, '');
  s = s.replace(
    /import \{[\s\S]*?\} from '@mui\/material';\r?\n/,
    `import {
  Badge,
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Skeleton,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CalendarMonthOutlinedIcon,
  GroupOutlinedIcon,
  PaymentsOutlinedIcon,
  TrendingUpOutlinedIcon,
  KeyboardArrowDownRoundedIcon,
} from '@/icons/fluent';
`,
  );

  if (!s.includes('const useStyles = makeStyles')) {
    s = s.replace(
      /type OverviewRange = /,
      `const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalL },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  row: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: tokens.spacingHorizontalM, flexWrap: 'wrap' },
  card: {
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusXLarge,
    border: \`1px solid \${tokens.colorNeutralStroke2}\`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  muted: { color: tokens.colorNeutralForeground2 },
  statsGrid: { display: 'grid', gap: tokens.spacingHorizontalM, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' },
});

type OverviewRange = `,
    );
  }

  s = s.replace(
    /export function StatisticsPage\(\): React\.JSX\.Element \{\r?\n\s*const theme = useTheme\(\);\r?\n/,
    `export function StatisticsPage(): React.JSX.Element {
  const styles = useStyles();
`,
  );
  s = s.replace(/\s*const theme = useTheme\(\);\r?\n/g, '\n');

  s = s.replace(/theme\.palette\.mode\s*===\s*['"]light['"]/g, 'true');
  s = s.replace(/theme\.palette\.mode/g, "'light'");
  s = s.replace(/theme\.palette\.primary\.main/g, 'tokens.colorBrandForeground1');
  s = s.replace(/theme\.palette\.success\.main/g, 'tokens.colorPaletteGreenForeground1');
  s = s.replace(/theme\.palette\.success\.dark/g, 'tokens.colorPaletteGreenForeground2');
  s = s.replace(/theme\.palette\.info\.main/g, 'tokens.colorPaletteBlueForeground2');
  s = s.replace(/theme\.palette\.text\.primary/g, 'tokens.colorNeutralForeground1');
  s = s.replace(/theme\.palette\.text\.secondary/g, 'tokens.colorNeutralForeground2');
  s = s.replace(/theme\.palette\.divider/g, 'tokens.colorNeutralStroke2');
  s = s.replace(/theme\.palette\.background\.paper/g, 'tokens.colorNeutralBackground1');
  s = s.replace(/theme\.typography\.fontFamily/g, 'tokens.fontFamilyBase');
  s = s.replace(/alpha\([^)]+\)/g, 'tokens.colorNeutralBackground3');

  s = s.replace(/<Stack\b([^>]*)>/g, (_, a) => `<div className={styles.stack}${stripSx(a)}>`);
  s = s.replace(/<\/Stack>/g, '</div>');
  s = s.replace(/<Box\b([^>]*)>/g, (_, a) => `<div${stripSx(a)}>`);
  s = s.replace(/<\/Box>/g, '</div>');
  s = s.replace(/<Paper\b([^>]*)>/g, (_, a) => `<div className={styles.card}${stripSx(a)}>`);
  s = s.replace(/<\/Paper>/g, '</div>');

  s = s.replace(/<Typography\s+variant="h4"([^>]*)>/g, (_, a) => `<Title2${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="h6"([^>]*)>/g, (_, a) => `<Title3${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="body2"([^>]*)>/g, (_, a) => `<Text size={200} className={styles.muted}${stripSx(a)}>`);
  s = s.replace(/<Typography\s+variant="caption"([^>]*)>/g, (_, a) => `<Text size={100} className={styles.muted}${stripSx(a)}>`);
  s = s.replace(/<Typography\b([^>]*)>/g, (_, a) => `<Text${stripSx(a)}>`);
  s = s.replace(/<\/Typography>/g, '</Text>');

  s = s.replace(/<Chip\b([^>]*)\/>/g, '<Badge appearance="tint" />');
  s = s.replace(/<Chip\b([^>]*)>([\s\S]*?)<\/Chip>/g, '<Badge appearance="tint">$2</Badge>');

  // Menu → Fluent Menu (best-effort keep open state via Menu open)
  s = s.replace(
    /<Menu\s+anchorEl=\{([^}]+)\}\s+open=\{([^}]+)\}\s+onClose=\{([^}]+)\}[^>]*>/g,
    '<Menu open={$2} onOpenChange={(_, d) => { if (!d.open) ($3)(); }}>',
  );
  s = s.replace(/<\/Menu>/g, '</Menu>');
  // Wrap MenuItem usages — leave as MenuItem (Fluent has MenuItem)

  s = s.replace(/\s*variant="contained"/g, ' appearance="primary"');
  s = s.replace(/\s*variant="outlined"/g, ' appearance="secondary"');
  s = s.replace(/\s*variant="text"/g, ' appearance="transparent"');
  s = s.replace(/\s*startIcon=\{/g, ' icon={');
  s = s.replace(/\s*endIcon=\{/g, ' icon={');
  s = s.replace(/\s*sx=\{\{[\s\S]*?\}\}/g, '');
  s = s.replace(/\s*sx=\{[^}]+\}/g, '');

  // StatCardsSkeleton import name from LoadingUI
  s = s.replace(
    /import \{ StatCardsSkeleton \} from '@\/components\/LoadingUI';/,
    "import { StatCardsSkeleton } from '@/components/LoadingUI';",
  );

  return s;
}

const settingsPath = 'src/renderer/src/features/settings/SettingsPage.tsx';
const statsPath = 'src/renderer/src/features/statistics/StatisticsPage.tsx';

save(settingsPath, migrateSettings(fs.readFileSync(settingsPath, 'utf8')));
save(statsPath, migrateStats(fs.readFileSync(statsPath, 'utf8')));

console.log('Remaining @mui settings', (fs.readFileSync(settingsPath, 'utf8').match(/@mui/g) || []).length);
console.log('Remaining @mui stats', (fs.readFileSync(statsPath, 'utf8').match(/@mui/g) || []).length);
console.log('Remaining Box settings', (fs.readFileSync(settingsPath, 'utf8').match(/<Box\b/g) || []).length);
console.log('Remaining Typography stats', (fs.readFileSync(statsPath, 'utf8').match(/Typography/g) || []).length);
