

import type { ReactNode } from 'react';
import type { UserRole } from '@/features/auth/AuthContext';
import type { AppRoute } from '@/app/access';
import { canAccess, isModuleEnabled } from '@/app/access';
import type { LicenseModules } from '@/features/auth/LicenseModulesContext';
import {
  Grid20Regular,
  Grid20Filled,
  ConferenceRoom20Regular,
  ConferenceRoom20Filled,
  People20Regular,
  People20Filled,
  Calendar20Regular,
  Calendar20Filled,
  Tag20Regular,
  Tag20Filled,
  Money20Regular,
  Money20Filled,
  DocumentText20Regular,
  DocumentText20Filled,
  Pill20Regular,
  Pill20Filled,
  Beaker20Regular,
  Beaker20Filled,
  DataTrending20Regular,
  DataTrending20Filled,
  Doctor20Regular,
  Doctor20Filled,
  CalendarClock20Regular,
  CalendarClock20Filled,
  PeopleSettings20Regular,
  PeopleSettings20Filled,
  Chat20Regular,
  Chat20Filled,
} from '@fluentui/react-icons';

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: ReactNode;
  activeIcon: ReactNode;
}

const ALL_NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard',    path: '/dashboard',    icon: <Grid20Regular />,            activeIcon: <Grid20Filled /> },
  { label: 'Waiting Room', path: '/waiting-room', icon: <ConferenceRoom20Regular />,  activeIcon: <ConferenceRoom20Filled /> },
  { label: 'Patients',     path: '/patients',     icon: <People20Regular />,          activeIcon: <People20Filled /> },
  { label: 'Appointments', path: '/appointments', icon: <Calendar20Regular />,        activeIcon: <Calendar20Filled /> },
  { label: 'Tokens',       path: '/tokens',       icon: <Tag20Regular />,             activeIcon: <Tag20Filled /> },
  { label: 'Billing',      path: '/billing',      icon: <Money20Regular />,           activeIcon: <Money20Filled /> },
  { label: 'OPD Reports',  path: '/opd-reports',  icon: <DocumentText20Regular />,   activeIcon: <DocumentText20Filled /> },
  { label: 'Medicines',    path: '/medicines',    icon: <Pill20Regular />,            activeIcon: <Pill20Filled /> },
  { label: 'Lab',          path: '/lab',          icon: <Beaker20Regular />,          activeIcon: <Beaker20Filled /> },
  { label: 'Statistics',   path: '/statistics',   icon: <DataTrending20Regular />,    activeIcon: <DataTrending20Filled /> },
  { label: 'Doctors',      path: '/doctors',      icon: <Doctor20Regular />,          activeIcon: <Doctor20Filled /> },
  { label: 'Schedule',     path: '/schedule',     icon: <CalendarClock20Regular />,   activeIcon: <CalendarClock20Filled /> },
  { label: 'Users',        path: '/users',        icon: <PeopleSettings20Regular />,  activeIcon: <PeopleSettings20Filled /> },
  { label: 'Chat',         path: '/chat',         icon: <Chat20Regular />,            activeIcon: <Chat20Filled /> },
];

export function getNavItems(role: UserRole, modules: LicenseModules | undefined): NavigationItem[] {
  return ALL_NAV_ITEMS.filter(
    (item) => canAccess(role, item.path) && isModuleEnabled(modules, item.path, role),
  );
}

// kept for non-role contexts (topbar indicator count etc.)
export const navigationItems = ALL_NAV_ITEMS;
