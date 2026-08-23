import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import {
  Box,
  Button,
  InputAdornment,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers/PickerDay';
import { addMonths, isAfter, isBefore, isSameDay, isWithinInterval } from 'date-fns';
import { useMemo, useState } from 'react';

interface Props {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toYmd(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatDisplay(from: string, to: string): string {
  const fmt = (ymd: string) =>
    parseYmd(ymd).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function rangeDaySx(
  theme: Theme,
  day: Date,
  start: Date | null,
  end: Date | null,
  hoverDay: Date | null,
  outsideCurrentMonth?: boolean,
) {
  const previewEnd = end ?? (start && hoverDay && !end ? hoverDay : null);
  const rangeStart = start && previewEnd ? (isBefore(start, previewEnd) ? start : previewEnd) : null;
  const rangeEnd = start && previewEnd ? (isAfter(start, previewEnd) ? start : previewEnd) : null;
  const inRange =
    rangeStart &&
    rangeEnd &&
    !outsideCurrentMonth &&
    isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  const isStart = start && isSameDay(day, start);
  const isEnd = previewEnd && isSameDay(day, previewEnd);

  return {
    ...(inRange && {
      bgcolor: alpha(theme.palette.primary.main, 0.14),
      borderRadius: 0,
      '&:hover, &:focus': { bgcolor: alpha(theme.palette.primary.main, 0.22) },
    }),
    ...(isStart && {
      bgcolor: `${theme.palette.primary.main} !important`,
      color: `${theme.palette.primary.contrastText} !important`,
      borderTopLeftRadius: '50%',
      borderBottomLeftRadius: '50%',
    }),
    ...(isEnd && {
      bgcolor: `${theme.palette.primary.main} !important`,
      color: `${theme.palette.primary.contrastText} !important`,
      borderTopRightRadius: '50%',
      borderBottomRightRadius: '50%',
    }),
  };
}

function RangeCalendar({
  referenceDate,
  start,
  end,
  hoverDay,
  onPick,
  onHover,
  onMonthChange,
}: {
  referenceDate: Date;
  start: Date | null;
  end: Date | null;
  hoverDay: Date | null;
  onPick: (day: Date) => void;
  onHover: (day: Date | null) => void;
  onMonthChange?: (month: Date) => void;
}): React.JSX.Element {
  function RangeDay(props: PickerDayProps): React.JSX.Element {
    const { day, outsideCurrentMonth, onMouseEnter, sx, ...other } = props;
    return (
      <PickerDay
        {...other}
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        onMouseEnter={(event, value) => {
          onHover(value);
          onMouseEnter?.(event, value);
        }}
        sx={[
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          (theme) => rangeDaySx(theme, day, start, end, hoverDay, outsideCurrentMonth),
        ]}
      />
    );
  }

  return (
    <DateCalendar
      key={referenceDate.getTime()}
      referenceDate={referenceDate}
      onChange={(day) => day && onPick(day)}
      onMonthChange={onMonthChange}
      slots={{ day: RangeDay }}
    />
  );
}

export function DateRangePickerField({ dateFrom, dateTo, onChange }: Props): React.JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState<Date>(() => parseYmd(dateFrom));

  const open = Boolean(anchor);
  const display = formatDisplay(dateFrom, dateTo);
  const rightMonth = useMemo(() => addMonths(leftMonth, 1), [leftMonth]);

  function openPicker(event: React.MouseEvent<HTMLElement>): void {
    setAnchor(event.currentTarget);
    setDraftStart(parseYmd(dateFrom));
    setDraftEnd(dateFrom === dateTo ? null : parseYmd(dateTo));
    setLeftMonth(parseYmd(dateFrom));
    setHoverDay(null);
  }

  function closePicker(): void {
    setAnchor(null);
    setHoverDay(null);
  }

  function pickDay(day: Date): void {
    if (!draftStart || draftEnd) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }
    if (isBefore(day, draftStart)) {
      setDraftEnd(draftStart);
      setDraftStart(day);
    } else {
      setDraftEnd(day);
    }
  }

  function applyRange(): void {
    if (!draftStart) return;
    const end = draftEnd ?? draftStart;
    const from = isBefore(draftStart, end) ? draftStart : end;
    const to = isAfter(draftStart, end) ? draftStart : end;
    onChange(toYmd(from), toYmd(to));
    closePicker();
  }

  return (
    <>
      <TextField
        size="small"
        label="Date range"
        value={display}
        onClick={openPicker}
        sx={{ minWidth: { xs: '100%', sm: 280 }, cursor: 'pointer' }}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <CalendarMonthOutlinedIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={closePicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5 } } }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, pt: 0.5, display: 'block' }}>
            Click start date, then end date
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0}>
            <RangeCalendar
              referenceDate={leftMonth}
              start={draftStart}
              end={draftEnd}
              hoverDay={hoverDay}
              onPick={pickDay}
              onHover={setHoverDay}
              onMonthChange={setLeftMonth}
            />
            <RangeCalendar
              referenceDate={rightMonth}
              start={draftStart}
              end={draftEnd}
              hoverDay={hoverDay}
              onPick={pickDay}
              onHover={setHoverDay}
              onMonthChange={(month) => setLeftMonth(addMonths(month, -1))}
            />
          </Stack>
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 1.5, pb: 1 }}>
            <Button size="small" onClick={closePicker}>Cancel</Button>
            <Button size="small" variant="contained" disabled={!draftStart} onClick={applyRange}>
              Apply
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
