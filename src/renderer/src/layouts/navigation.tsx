

import type { ReactNode } from 'react';
import type { UserRole } from '@/features/auth/AuthContext';
import type { AppRoute } from '@/app/access';
import { canAccess, isModuleEnabled } from '@/app/access';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';
import { AssessmentOutlinedIcon, BarChartOutlinedIcon, BiotechOutlinedIcon, CalendarMonthOutlinedIcon, ChatOutlinedIcon, ConfirmationNumberOutlinedIcon, DashboardOutlinedIcon, EventAvailableOutlinedIcon, GroupOutlinedIcon, LocalHospitalOutlinedIcon, ManageAccountsOutlinedIcon, MedicationOutlinedIcon, MeetingRoomOutlinedIcon, PaymentsOutlinedIcon } from '@/icons/fluent';

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: ReactNode;
}

const ALL_NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard',    path: '/dashboard',    icon: <DashboardOutlinedIcon /> },
  { label: 'Patients',     path: '/patients',     icon: <GroupOutlinedIcon /> },
  { label: 'Appointments', path: '/appointments', icon: <CalendarMonthOutlinedIcon /> },
  { label: 'Tokens',       path: '/tokens',       icon: <ConfirmationNumberOutlinedIcon /> },
  { label: 'Billing',      path: '/billing',      icon: <PaymentsOutlinedIcon /> },
  { label: 'OPD Reports',  path: '/opd-reports',  icon: <AssessmentOutlinedIcon /> },
  { label: 'Medicines',    path: '/medicines',    icon: <MedicationOutlinedIcon /> },
  { label: 'Lab',          path: '/lab',          icon: <BiotechOutlinedIcon /> },
  { label: 'Statistics',   path: '/statistics',   icon: <BarChartOutlinedIcon /> },
  { label: 'Doctors',      path: '/doctors',      icon: <LocalHospitalOutlinedIcon /> },
  { label: 'Schedule',     path: '/schedule',     icon: <EventAvailableOutlinedIcon /> },
  { label: 'Users',        path: '/users',        icon: <ManageAccountsOutlinedIcon /> },
  { label: 'Chat',         path: '/chat',         icon: <ChatOutlinedIcon /> },
  { label: 'Waiting Room', path: '/waiting-room', icon: <MeetingRoomOutlinedIcon /> },
];

export function getNavItems(role: UserRole, modules: LicenseModules | undefined): NavigationItem[] {
  return ALL_NAV_ITEMS.filter(
    (item) => canAccess(role, item.path) && isModuleEnabled(modules, item.path, role),
  );
}

// kept for non-role contexts (topbar indicator count etc.)
export const navigationItems = ALL_NAV_ITEMS;
