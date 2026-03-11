# Balfour Beatty Signage Portal — Rebrand Guide

This guide covers every step to convert the Persimmon Signage Portal into a Balfour Beatty branded portal. The product catalog, shop flow, custom sign builder, and admin dashboard all stay the same — only the branding and infrastructure change.

---

## Brand Colour Mapping

The entire UI derives from CSS custom properties in `shop/app/globals.css`. Change the values, everything updates.

| CSS Variable | Persimmon Value | Balfour Beatty Value | Role |
|---|---|---|---|
| `--persimmon-green` | `#3db28c` | `#005d99` | Primary accent — buttons, links, active states |
| `--persimmon-green-light` | `#5ac4a1` | `#1a7ab8` | Hover backgrounds |
| `--persimmon-green-dark` | `#007961` | `#004477` | Button hover, dark accent |
| `--persimmon-navy` | `#00474a` | `#002b49` | Primary text, headings, header background |
| `--persimmon-navy-light` | `#006266` | `#003d6b` | Secondary text |
| `--persimmon-gray` | `#F4F6F8` | `#F4F6F8` | Page background (keep) |
| `--persimmon-gray-dark` | `#E2E6EA` | `#E2E6EA` | Borders (keep) |

**Optional accent**: Balfour Beatty gold `#f7bc60` — can be used for status badges or highlights. Not suitable as a button colour (poor contrast with white text).

**Accessibility note**: The blue values above all pass WCAG AA contrast against white backgrounds.

---

## Step-by-Step Checklist

### Phase 1: Brand Identity

#### 1.1 Colours — `shop/app/globals.css`

Replace the CSS custom property values using the table above. Also update the Tailwind colour mappings in the same file (`--color-persimmon-green`, etc.).

**Keep the CSS class names** (`text-persimmon-green`, `bg-persimmon-navy`, etc.) — just change the underlying values. This is the fastest approach and avoids touching every component file.

#### 1.2 Logos — `shop/public/assets/`

Replace these 3 SVGs with Balfour Beatty equivalents:
- `persimmon_icon.svg` — Square icon (header, splash screen, favicon)
- `persimmon_wordmark.svg` — Text logo (header)
- `persimmon_full_logo.svg` — Combined logo (available but currently unused)

Also replace:
- `shop/app/icon.svg` — Favicon
- `shop/app/apple-icon.png` — Touch icon (PNG, ~180x180)

#### 1.3 Text References — Find and replace "Persimmon"

| File | What to change |
|------|---------------|
| `shop/app/layout.tsx` | `title` and `description` in metadata |
| `shop/components/Header.tsx` | "Signage Portal" subtitle |
| `shop/components/SplashScreen.tsx` | "SIGNAGE PORTAL" text |
| `shop/app/(auth)/login/page.tsx` | Login page title and description |
| `shop/lib/email.ts` | Sender name: `Balfour Beatty Signage <...>` |
| `shop/app/not-found.tsx` | Footer text |
| `shop/components/BasketContext.tsx` | localStorage key: change `"persimmon-basket"` to `"balfour-basket"` |

#### 1.4 Email Branding — `shop/lib/email.ts`

- Header background colour → `#002b49`
- Accent colours in the HTML template → `#005d99`
- Sender name → `Balfour Beatty Signage`
- Footer text

#### 1.5 Order Number Prefix — `shop/app/api/orders/route.ts`

Change `"PER-"` to `"BAL-"` in the order number generation logic.

---

### Phase 2: Infrastructure

#### 2.1 Supabase — Same Project, New Tables

Uses the **same Supabase instance** as Persimmon. No new project needed. Create `bal_` prefixed tables to keep data separate from the existing `psp_` tables.

Run this migration in the Supabase SQL editor:

```sql
CREATE TABLE bal_orders ( ... );        -- same schema as psp_orders
CREATE TABLE bal_order_items ( ... );   -- same schema as psp_order_items
CREATE TABLE bal_suggestions ( ... );   -- same schema as psp_suggestions
```

Full SQL is in the init prompt doc. Then rename all table references in code:

| File | Change |
|------|--------|
| `shop/app/api/orders/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/api/orders/[orderNumber]/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/api/suggestions/route.ts` | `"psp_suggestions"` → `"bal_suggestions"` |
| `shop/supabase-setup.sql` | Update documentation to reflect `bal_` tables |

#### 2.2 Vercel — New Project

- Create a new Vercel project
- Set root directory to `shop/`
- Connect to the new GitHub repo

#### 2.3 Environment Variables

Set these in Vercel (and local `.env` for development):

```
SUPABASE_URL=<same as Persimmon — shared Supabase project>
SUPABASE_SERVICE_ROLE_KEY=<same as Persimmon — shared Supabase project>
SHOP_PASSWORD=<new password for Balfour Beatty staff>
ADMIN_PASSWORD=<admin password for Onesign>
SHOP_AUTH_TOKEN=<generate: openssl rand -hex 32>
ADMIN_AUTH_TOKEN=<generate: openssl rand -hex 32>
SITE_URL=<new Vercel URL>
RESEND_API_KEY=<same Resend API key>
TEAM_NOTIFICATION_EMAIL=<who receives order notifications>
FROM_EMAIL=<sender email — needs Resend domain verification>
```

**Shared**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
**New**: `SHOP_PASSWORD`, `ADMIN_PASSWORD`, `SHOP_AUTH_TOKEN`, `ADMIN_AUTH_TOKEN`, `SITE_URL`

#### 2.4 Resend — Email Domain

If using a custom FROM_EMAIL:
- Add DKIM and SPF TXT records in the domain's DNS
- Verify in the Resend dashboard
- Or omit `FROM_EMAIL` to fall back to `onboarding@resend.dev`

---

### Phase 3: Product Catalog

**No changes needed.** The same `shop/data/catalog.json` and product images in `shop/public/images/products/` carry over as-is since Balfour Beatty uses the same Onesign signage range.

---

### Phase 4: Verification

Run through this checklist after all changes:

- [ ] Login page shows Balfour Beatty branding
- [ ] Splash screen shows correct logo and text
- [ ] Header shows Balfour Beatty logo and correct colours
- [ ] Homepage category grid renders with new accent colour
- [ ] Product pages show correct brand colours
- [ ] Custom sign builder works (submit a test)
- [ ] Basket and checkout pages branded correctly
- [ ] Order confirmation page shows correct styling
- [ ] Order number starts with `BAL-`
- [ ] Email confirmation received with correct branding
- [ ] Admin dashboard accessible and functional
- [ ] Suggestion widget appears and submits successfully
- [ ] Order history page loads and shows correct data
- [ ] Mobile responsive — no overflow or layout issues
- [ ] Orders write to `bal_orders` / `bal_order_items` (not `psp_`)
- [ ] Suggestions write to `bal_suggestions` (not `psp_`)
- [ ] `next build` passes cleanly

---

## What Stays the Same

- Product catalog (`catalog.json`) — same signage range
- Product images — same files
- Custom sign builder — same flow and preview
- Shop flow — browse → basket → checkout → confirmation
- Admin dashboard — orders + suggestions management
- Auth model — shared passwords, cookie-based
- All component logic and page structure
- Supabase instance — same project, just `bal_` tables instead of `psp_`
