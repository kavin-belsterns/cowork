# Interface rules

All screens follow shared design tokens, five page states and verified copy rules.
Components adhere to **WCAG 2.2 AA** across all viewports.

## Colour roles

Semantic colour roles supply consistent theme colours in light and dark modes.
Every surface pairs with a contrasting foreground token.
All text pairs meet a contrast ratio of at least **4.5:1**.

| Role | Light token | Dark token | Usage |
|---|---|---|---|
| `background` | oklch(0.99 0.003 260) | oklch(0.15 0.015 260) | Page background |
| `foreground` | oklch(0.21 0.02 260) | oklch(0.98 0.005 260) | Primary text and headings |
| `muted` | oklch(0.96 0.006 260) | oklch(0.22 0.02 260) | Subdued surfaces and skeletons |
| `muted-foreground` | oklch(0.35 0.02 260) | oklch(0.78 0.02 260) | Secondary text and hints |
| `primary` | oklch(0.21 0.02 260) | oklch(0.98 0.005 260) | Primary buttons and key actions |
| `primary-foreground` | oklch(0.99 0.003 260) | oklch(0.15 0.015 260) | Text on primary surfaces |
| `accent` | oklch(0.92 0.01 260) | oklch(0.25 0.02 260) | Hover backgrounds and tabs |
| `accent-foreground` | oklch(0.21 0.02 260) | oklch(0.98 0.005 260) | Text on accent surfaces |
| `destructive` | oklch(0.48 0.18 27) | oklch(0.45 0.18 25) | Critical actions and field errors |
| `destructive-foreground` | oklch(0.99 0.003 260) | oklch(0.98 0.005 260) | Text on destructive surfaces |
| `border` | oklch(0.55 0.02 260) | oklch(0.52 0.02 260) | Component and divider borders |
| `ring` | oklch(0.45 0.17 262) | oklch(0.7 0.14 262) | Keyboard focus indicator ring |

## Status tokens

Status tokens communicate room and visitor states across all role views.
Components must display a clear text label and **never rely on colour alone**.

| Status token | Light value | Dark value | Context and label |
|---|---|---|---|
| `status-free` | oklch(0.95 0.05 145) | oklch(0.28 0.08 145) | Available room slots labelled Free |
| `status-booked` | oklch(0.94 0.01 260) | oklch(0.25 0.02 260) | Reserved room slots labelled Booked |
| `status-expected` | oklch(0.93 0.05 240) | oklch(0.28 0.09 245) | Pre-registered visitors labelled Expected |
| `status-checked-in` | oklch(0.94 0.06 175) | oklch(0.28 0.08 175) | Active visitors labelled Checked in |
| `status-not-checked-out` | oklch(0.95 0.06 85) | oklch(0.32 0.1 65) | Past visits labelled Not checked out |

## Typography

The interface uses one font family loaded through next/font.
The type scale defines **seven font sizes** with fixed line heights.

| Token | Font size | Line height | Usage |
|---|---|---|---|
| `text-xs` | 12 px (0.75rem) | 1.5 | Badges, timestamps, helper text |
| `text-sm` | 14 px (0.875rem) | 1.5 | Form labels, table cells, buttons |
| `text-base` | 16 px (1.000rem) | 1.5 | Standard body text, input fields |
| `text-lg` | 18 px (1.125rem) | 1.5 | Subheadings, card titles |
| `text-xl` | 24 px (1.500rem) | 1.3 | Section headings, dialog titles |
| `text-2xl` | 32 px (2.000rem) | 1.2 | Page titles, summary counts |
| `text-3xl` | 40 px (2.500rem) | 1.2 | Visitor badge display names |

## Spacing and layout

Layouts follow a four pixel grid with mobile first breakpoints.
Responsive designs adapt across **three viewports** to support mobile and desktop.
The base spacing unit is 4 px (0.25 rem).

| Breakpoint | Minimum width | Layout behavior |
|---|---|---|
| `sm` | 375 px | Tables stack into single column cards |
| `md` | 768 px | Forms display as two columns |
| `lg` | 1280 px | Today view displays rooms and visitors side by side |

## Radius, shadow and motion

Surfaces use subtle corner radii and functional shadow elevations.
Transitions rely on **three motion tokens** with reduced motion overrides.

| Token category | Value | Semantic usage |
|---|---|---|
| `radius-sm` | 4 px (0.25rem) | Input fields and checkbox frames |
| `radius-md` | 8 px (0.50rem) | Buttons, badges and slot buttons |
| `radius-lg` | 12 px (0.75rem) | Cards, panels and dialog windows |
| `shadow-sm` | 0 1px 2px 0 | Subtle elevation on interactive cards |
| `shadow-md` | 0 4px 8px -2px | Dropdown menus and popover cards |
| `shadow-lg` | 0 12px 24px -6px | Modal dialogs and alert dialogs |

| Motion token | Duration | Purpose |
|---|---|---|
| `motion-hover` | 150 ms | Hover and active control changes |
| `motion-enter` | 200 ms | Modal and popover entrance |
| `motion-max` | 300 ms | Complex layout shifts and banners |

Animations wrap in motion-safe utilities.
The prefers-reduced-motion setting sets all animation durations to zero.

## Page states

Every Next.js route implements five explicit user interface states.
Routes render **five standard states** to guide users during navigation.

| State | App Router file | Rendered interface |
|---|---|---|
| Loading | `loading.tsx` | Skeleton layout matching page content shape |
| Empty | `page.tsx` | Informative explanation with one primary action |
| Error | `error.tsx` | Explanation, recovery action, retry button and reference identifier |
| Not found | `not-found.tsx` | Item missing message with home navigation link |
| Success | `page.tsx` | Target content with inline confirmation or toast |

Pages render one primary action aligned to the left.
Empty states and authentication views center content on screen.

## Accessibility and interaction

All interactive elements support keyboard navigation and assistive technology.
Interactive controls maintain a minimum target size of **24 by 24 pixels**.

| Requirement | Standard | Implementation rule |
|---|---|---|
| Focus indicator | WCAG 2.4.7 | Visible 2 px ring with 3:1 contrast against background |
| Keyboard access | WCAG 2.1.1 | Tab, Enter, Space and Escape control all interactions |
| Target size | WCAG 2.5.8 | Minimum 24 by 24 CSS pixels on all buttons and room slots |
| Form errors | WCAG 3.3.1 | Error summary receives focus, fields link via aria-describedby |
| Status announcements | WCAG 4.1.3 | Async notifications and arrivals announce via role status |
| Session timeout | WCAG 2.2.1 | Warning appears 5 minutes before the 12 hour absolute limit |

## Standard copy and messages

Interface copy uses clear language without technical jargon.
All interface labels and actions use **sentence case** typography.

| Error type | Status | Trigger condition | Displayed message |
|---|---|---|---|
| `validation` | 400 | Invalid form input or missing field | Inline error message at each field |
| `unauthenticated` | 401 | Missing, invalid or expired session | Please sign in again. |
| `forbidden` | 403 | Role lacks required permission | You do not have access to this. |
| `not-found` | 404 | Missing record or record at another office | We could not find this item. |
| `booking-conflict` | 409 | Room booked by a concurrent request | This slot was just booked. Choose another time. |
| `version-conflict` | 409 | Record modified concurrently | Someone changed this. Reload to see it. |
| `request-in-progress` | 409 | Duplicate idempotent operation active | This is still saving. Wait a moment. |
| `request-changed` | 422 | Idempotency key reused with new payload | This request changed. Submit it again. |
| `rule-violation` | 422 | Business constraint violation | Specific domain rule message |
| `locked` | 429 | Failed sign-in lockout or rate limit | Too many attempts. Try again in 15 minutes. |
| `internal` | 500 | Unexpected server error | Something went wrong. Try again. If it happens again, give reference [id] to your admin. |

| Scenario | Message text |
|---|---|
| Expired temporary password | This temporary password has expired. Ask your admin for a new one. |
| Time zone change blocked | Move or cancel future bookings before changing the time zone. |
| Concurrent import blocked | Another import for this office is running. Try again in a minute. |
| Last platform admin guard | The company needs at least one platform admin. |
| No free dates for series | No dates were free. Nothing was booked. |
| Office closed on day | This office is closed on [day]. |
| Visitor arrival banner | Your visitor [name] has arrived at reception. |
| Sign-in reset hint | Forgot your password? Ask your office admin to reset it. |
| Temporary password issue | Shown once. Give it to the user in person. |
| Anonymised visit history | Visitor details removed |
| Activity history visitor | Visitor V-3F2A |
| Date display format | Mon 16 Nov 2026 |
| Time display format | 24-hour format, such as 14:00 |
| Cross-office time display | 14:00 with office time zone short name |
