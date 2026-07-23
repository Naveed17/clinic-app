# Clinic Management System

Desktop foundation for a clinic management system built with Electron, React, Vite, TypeScript, Material UI, React Router, TanStack Query, React Hook Form, Zod, Prisma, and SQLite.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run dev`.

## Commands

- `npm run dev` - Start Electron with Vite development tooling.
- `npm run build` - Type-check and create production bundles.
- `npm run lint` - Run ESLint.
- `npm run format:check` - Check Prettier formatting.
- `npm run prisma:migrate` - Create and apply local SQLite migrations.

## Structure

- `src/main` - Electron main process and desktop configuration.
- `src/preload` - Secure renderer-to-main bridge.
- `src/renderer/src/app` - Application providers, theme, and routing.
- `src/renderer/src/components` - Reusable presentational components.
- `src/renderer/src/layouts` - Shared application layouts.
- `src/renderer/src/pages` - Route-level pages.
- `src/renderer/src/features` - Feature-owned code: auth, patients, appointments, billing, and reports.
- `src/renderer/src/hooks`, `services`, `database`, `types`, and `utils` - Shared renderer layers.
- `src/renderer/src/theme` - Theme exports for UI consumers.
- `prisma` - Prisma schema and SQLite database artifacts.
