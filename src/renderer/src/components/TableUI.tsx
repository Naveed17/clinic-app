import {
  Box,
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
import type { ReactNode } from 'react';

export const tableSx = {
  head: {
    '& .MuiTableCell-head': {
      fontSize: 12,
      fontWeight: 500,
      color: 'text.disabled',
      py: 1.5,
      px: 2,
      borderBottom: 'none',
      bgcolor: 'transparent',
      whiteSpace: 'nowrap',
    },
  },
  row: {
    cursor: 'default',
    '& .MuiTableCell-body': {
      fontSize: 13.5,
      py: 0.75,
      px: 2,
      border: 'none',
      color: 'text.primary',
    },
    '&:hover .MuiTableCell-body': {
      bgcolor: 'action.hover',
      '&:first-of-type': { borderRadius: '8px 0 0 8px' },
      '&:last-of-type': { borderRadius: '0 8px 8px 0' },
    },
    transition: 'background 0.12s',
  },
} satisfies Record<string, SxProps<Theme>>;

export const chipSx = {
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: 11.5,
  height: 22,
  border: 'none',
  '& .MuiChip-label': { px: 1 },
};

// Green/grey dot before status text — matches "• Active" in image
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
  width: 30,
  height: 30,
  borderRadius: '8px',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.selected', color: 'text.primary' },
};

interface TablePageShellProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  sx?: SxProps<Theme>;
}

export function TablePageShell({ title, subtitle, action, toolbar, children, error, sx }: TablePageShellProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: { sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>
        </Box>
        {action}
      </Box>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {toolbar && (
          <Box sx={{
            px: 2.5, pt: 2, pb: 1.75,
            display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
          }}>
            {toolbar}
          </Box>
        )}
        {error}
        <TableContainer sx={{ px: 1.5, pb: 1.5 }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 2px', '& tbody tr:last-child td': { borderBottom: 0 } }}>
            {children}
          </Table>
        </TableContainer>
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
          sx: { borderRadius: 2, fontSize: 13.5 },
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
  if (totalPages <= 1) return <></>;
  return (
    <Box
      className="TablePager-root"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.25,
      }}
    >
      <Typography fontSize={13} color="text.secondary">
        Page {currentPage} of {totalPages}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box
          component="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          sx={{
            px: 1.75, py: 0.5,
            fontSize: 13, fontWeight: 500,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '6px',
            bgcolor: 'background.paper',
            color: page === 0 ? 'text.disabled' : 'text.primary',
            cursor: page === 0 ? 'not-allowed' : 'pointer',
            '&:hover:not(:disabled)': { bgcolor: 'action.hover' },
            transition: 'background 0.12s',
          }}
        >
          Previous
        </Box>
        <Box
          component="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(page + 1)}
          sx={{
            px: 1.75, py: 0.5,
            fontSize: 13, fontWeight: 500,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '6px',
            bgcolor: 'background.paper',
            color: currentPage >= totalPages ? 'text.disabled' : 'text.primary',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            '&:hover:not(:disabled)': { bgcolor: 'action.hover' },
            transition: 'background 0.12s',
          }}
        >
          Next
        </Box>
      </Box>
    </Box>
  );
}
