import {
  Box,
  Button,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

export const softCardSx: SxProps<Theme> = {
  borderRadius: '20px',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: (theme) => `0 4px 18px ${alpha(theme.palette.common.black, 0.04)}`,
};

export const tableSx = {
  head: {
    '& .MuiTableCell-head': {
      fontSize: 10.5,
      fontWeight: 800,
      color: 'text.secondary',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      py: 1.75,
      px: 2.25,
      borderBottom: '1px solid',
      borderColor: 'divider',
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.05),
      whiteSpace: 'nowrap',
    },
  },
  row: {
    cursor: 'default',
    '& .MuiTableCell-body': {
      fontSize: 13,
      py: 1.35,
      px: 2.25,
      border: 'none',
      color: 'text.primary',
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.02),
      transition: 'background 0.15s, border-color 0.15s',
    },
    '& .MuiTableCell-body:first-of-type': {
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4,
      borderLeft: '3px solid',
      borderLeftColor: 'transparent',
    },
    '& .MuiTableCell-body:last-of-type': {
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    '&:hover .MuiTableCell-body': {
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.06),
    },
    '&:hover .MuiTableCell-body:first-of-type': {
      borderLeftColor: 'primary.main',
    },
  },
} satisfies Record<string, SxProps<Theme>>;

export const chipSx = {
  borderRadius: 1,
  fontWeight: 700,
  fontSize: 11,
  height: 22,
  border: 'none',
  '& .MuiChip-label': { px: 1 },
};

export function StatusDot({ active = true }: { active?: boolean }): React.JSX.Element {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: active ? 'success.main' : 'text.disabled',
        mr: 0.75,
        verticalAlign: 'middle',
        mb: '1px',
        flexShrink: 0,
      }}
    />
  );
}

export const actionBtnSx = {
  width: 32,
  height: 32,
  borderRadius: 1,
  color: 'text.secondary',
  border: '1px solid',
  borderColor: 'divider',
  '&:hover': {
    bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.08),
    color: 'primary.main',
    borderColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.25),
  },
};

interface TablePageShellProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  pager?: ReactNode;
  sx?: SxProps<Theme>;
}

export function TablePageShell({ title, subtitle, action, toolbar, children, error, pager, sx }: TablePageShellProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: { sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        </Box>
        {action}
      </Box>

      <Paper elevation={0} sx={{ ...softCardSx, overflow: 'hidden', bgcolor: 'background.paper' }}>
        {toolbar && (
          <Box sx={{
            px: 2.5,
            pt: 2,
            pb: 1.75,
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
          }}>
            {toolbar}
          </Box>
        )}
        {error}
        <TableContainer sx={{ px: 2, py: 1.5, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 6px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
            {children}
          </Table>
        </TableContainer>
        {pager && (
          <Box sx={{ borderTop: '1px solid', borderTopColor: 'divider', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02) }}>
            {pager}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

export function SearchField({ value, onChange, placeholder = 'Search...', sx }: SearchFieldProps): React.JSX.Element {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ minWidth: 220, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          sx: {
            borderRadius: 2,
            fontSize: 13.5,
            bgcolor: 'background.paper',
            fontWeight: 500,
          },
        },
      }}
    />
  );
}

export { Table, TableHead, TableBody, TableRow, TableCell };

interface TablePagerProps {
  page: number;
  rowsPerPage: number;
  total: number;
  onPageChange: (next: number) => void;
}

export function TablePager({ page, rowsPerPage, total, onPageChange }: TablePagerProps): React.JSX.Element {
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = page + 1;
  if (total === 0) return <></>;

  return (
    <Box
      className="TablePager-root"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2.5,
        py: 1.5,
      }}
    >
      <Typography fontSize={13} fontWeight={600} color="text.secondary">
        Page {currentPage} of {totalPages}
        <Box component="span" sx={{ ml: 1, color: 'text.disabled', fontWeight: 500 }}>
          · {total} total
        </Box>
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          startIcon={<ChevronLeftIcon sx={{ fontSize: 18 }} />}
          sx={{ borderRadius: 2, fontWeight: 700, px: 1.5 }}
        >
          Previous
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(page + 1)}
          endIcon={<ChevronRightIcon sx={{ fontSize: 18 }} />}
          sx={{ borderRadius: 2, fontWeight: 700, px: 1.5 }}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
