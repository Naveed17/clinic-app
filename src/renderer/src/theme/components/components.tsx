import type { Components } from '@mui/material/styles';
import type { Theme } from '../types';
import { MuiAvatar } from './avatar';
import { MuiButton } from './button';
import { MuiCard } from './card';
import { MuiCardContent } from './card-content';
import { MuiCardHeader } from './card-header';
import { MuiChip } from './chip';
import { MuiDialog } from './dialog';
import { MuiInputBase } from './inputBase';
import { MuiLinearProgress } from './linear-progress';
import { MuiLink } from './link';
import { MuiOutlinedInput } from './outlined-input';
import { MuiPaper } from './paper';
import { MuiPickersInputBase, MuiPickersOutlinedInput, MuiPickersTextField } from './pickers';
import { MuiStack } from './stack';
import { MuiTab } from './tab';
import { MuiTable } from './table';
import { MuiTableBody } from './table-body';
import { MuiTableCell } from './table-cell';
import { MuiTableHead } from './table-head';
import { MuiTextField } from './text-field';

export const components = {
  MuiAvatar,
  MuiButton,
  MuiCard,
  MuiCardContent,
  MuiCardHeader,
  MuiChip,
  MuiDialog,
  MuiInputBase,
  MuiLinearProgress,
  MuiLink,
  MuiOutlinedInput,
  MuiPaper,
  MuiPickersInputBase,
  MuiPickersOutlinedInput,
  MuiPickersTextField,
  MuiStack,
  MuiTab,
  MuiTable,
  MuiTableBody,
  MuiTableCell,
  MuiTableHead,
  MuiTextField,
} satisfies Components<Theme>;
