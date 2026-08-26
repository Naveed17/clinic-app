import { Avatar, Badge, Button, Text, Tooltip, tokens } from '@fluentui/react-components';
import { CalendarMonthOutlinedIcon, PrintOutlinedIcon } from '@/icons/fluent';
import type { Appointment } from '@/types/appointment';

const statusBadgeColor: Record<string, 'brand' | 'warning' | 'success' | 'informative' | 'danger'> = {
  SCHEDULED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'informative',
  NO_SHOW: 'danger',
};

const leftBorder: Record<string, string> = {
  SCHEDULED: tokens.colorBrandStroke1,
  CHECKED_IN: tokens.colorBrandStroke1,
  COMPLETED: tokens.colorPaletteGreenBorder2,
  CANCELLED: tokens.colorNeutralStroke1,
  NO_SHOW: tokens.colorPaletteRedBorder2,
};

interface Props {
  appointments: Appointment[];
  selectedId?: string;
  onOpen?: (appointment: Appointment) => void;
  onPrint: (appointment: Appointment) => void;
  printingId?: string | null;
  showNotes?: boolean;
}

export function formatTokenLabel(tokenNumber: number | null | undefined): string {
  return tokenNumber != null ? `#${String(tokenNumber).padStart(3, '0')}` : 'No token';
}

export function AppointmentVisitList({
  appointments,
  selectedId,
  onOpen,
  onPrint,
  printingId: _printingId,
  showNotes = true,
}: Props): React.JSX.Element {
  if (!appointments.length) {
    return (
      <Text size={200} block style={{ padding: '16px 0', color: tokens.colorNeutralForeground2 }}>
        No visits found.
      </Text>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {appointments.map((a) => {
        const selected = selectedId === a.id;
        return (
          <div
            key={a.id}
            onClick={() => onOpen?.(a)}
            style={{
              padding: '12px',
              borderRadius: tokens.borderRadiusMedium,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: onOpen ? 'pointer' : 'default',
              backgroundColor: selected ? tokens.colorBrandBackground2 : tokens.colorNeutralBackground2,
              border: `1px solid ${selected ? tokens.colorBrandStroke1 : tokens.colorNeutralStroke1}`,
              borderLeft: `4px solid ${leftBorder[a.status] ?? tokens.colorNeutralStroke1}`,
            }}
          >
            <Avatar
              name={a.tokenNumber != null ? String(a.tokenNumber).padStart(3, '0') : undefined}
              icon={a.tokenNumber == null ? <CalendarMonthOutlinedIcon /> : undefined}
              size={40}
              shape="square"
              color="brand"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <Text weight="bold" block style={{ fontSize: 14 }}>
                    {new Date(a.startsAt).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text size={200} block style={{ color: tokens.colorNeutralForeground2 }}>
                    Dr. {a.provider.firstName} {a.provider.lastName}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge appearance="tint" color={statusBadgeColor[a.status] ?? 'informative'}>
                    {a.status.replace('_', ' ')}
                  </Badge>
                  <Tooltip content={a.tokenNumber != null || a.tokenId ? 'Print token' : 'No token for this visit'} relationship="label">
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<PrintOutlinedIcon />}
                      disabled={!a.tokenNumber && !a.tokenId}
                      onClick={(e) => { e.stopPropagation(); onPrint(a); }}
                    />
                  </Tooltip>
                </div>
              </div>
              {showNotes && a.notes && (
                <Text size={200} block style={{ marginTop: 6, color: tokens.colorNeutralForeground2 }}>
                  {a.notes}
                </Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
