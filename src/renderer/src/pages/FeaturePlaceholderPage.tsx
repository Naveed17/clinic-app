import { Paper, Stack, Typography } from '@mui/material';

interface FeaturePlaceholderPageProps {
  title: string;
}

export function FeaturePlaceholderPage({ title }: FeaturePlaceholderPageProps): React.JSX.Element {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary">
          This workspace is ready for its feature implementation.
        </Typography>
      </div>
      <Paper variant="outlined" sx={{ p: 3, minHeight: 200 }} />
    </Stack>
  );
}
