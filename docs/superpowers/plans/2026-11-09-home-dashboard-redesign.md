# Home Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Arabic home dashboard easier to scan and use by bringing work shortcuts forward, aligning summary cards, and compacting empty reminders.

**Architecture:** Keep the existing data loading, permission checks, counts, links, and alert logic. Reorder the existing sections, group the two reminder panels in a responsive layout, and scope dashboard styling to the home page.

**Tech Stack:** React, TypeScript, existing CSS, Vitest/Testing Library, Playwright with local Chromium.

**Spec:** `docs/superpowers/specs/2026-11-09-home-dashboard-design.md`

## Global Constraints

- Keep the interface in clear Egyptian Arabic and RTL.
- Do not change database queries, access permissions, counts, or alert windows.
- Respect the existing dark and light theme variables; add no UI dependency.
- Support 320px mobile screens without page-level horizontal scrolling. Keep every authorized menu link visible on small screens.

## Review Focus

- A staff member with no case permissions must not see case counts, case actions, or reminders; existing permission tests cover this.
- Donation-only staff must retain donation totals and actions without case data requests; existing donation permission tests cover this.
- Failed totals and reminder requests must remain errors rather than becoming zero or empty; existing failure-state tests cover this.
- A narrow viewport must keep action links, metrics, filters, forms, and navigation readable; verify signed-out login, home, cases list/create/detail, donations, assistant, and staff at 320px and 360px.
- Dark mode must preserve contrast and card boundaries; verify the dashboard under both theme values in browser inspection.

---

### Task 1: Reorder and compact the home dashboard

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/shared/app.css`

**Interfaces:**
- Consumes: existing `HomePage` props, permission checks, counts, reminders, and action links.
- Produces: a task-first page order: welcome, work shortcuts, summary cards, then grouped reminders.

- [x] **Step 1: Add a focused failing test** asserting the “ابدأ من هنا” section precedes the reminder area, and reminder headings remain present.
- [x] **Step 2: Run** `npm test -- --run src/features/home/HomePage.test.tsx`; confirm the section-order assertion fails against the current page.
- [x] **Step 3: Reorder the existing JSX** without changing fetch logic; place action cards before stats and group card-expiry and age reminders under one compact follow-up section.
- [x] **Step 4: Update scoped CSS** to use a consistent summary grid, compact empty reminders, two reminder columns on wide screens, and single-column layouts on phones. Mobile navigation now wraps into a visible two-column menu; the wide case table gets a swipe hint on phones.
- [x] **Step 5: Verify** unit/build checks and Playwright page flows at desktop and 320px/360px mobile widths, including light/dark theme, navigation, donation form disclosure, assistant prompt selection, case intake, details, list filters, and login.
- [x] **Step 6: Commit** with `feat: reorganize Arabic home dashboard` and push to the feature branch and Cloudflare Pages `preview` branch as requested.
