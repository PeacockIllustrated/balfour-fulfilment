# Balfour Beatty Signage Portal — Initializing Prompt

Copy everything below the line into Claude as your first message in the new project.

---

## Prompt

You are working on a signage ordering portal for Balfour Beatty, a UK construction company. This codebase is a copy of the Persimmon Signage Portal built by Onesign. The product catalog, shop flow, custom sign builder, and admin dashboard are all identical — your job is to rebrand the visual identity from Persimmon to Balfour Beatty.

### Brand Identity

**Balfour Beatty colours** (replace the CSS custom properties in `shop/app/globals.css`):

```
--persimmon-green: #005d99        /* BB blue — buttons, links, active states */
--persimmon-green-light: #1a7ab8  /* Hover backgrounds */
--persimmon-green-dark: #004477   /* Button hover, dark accent */
--persimmon-navy: #002b49         /* BB dark navy — headings, header bg */
--persimmon-navy-light: #003d6b   /* Secondary text */
--persimmon-gray: #F4F6F8         /* Keep — page background */
--persimmon-gray-dark: #E2E6EA    /* Keep — borders */
```

Also update the Tailwind mappings in the same file (`--color-persimmon-green: var(--persimmon-green)` etc.).

Keep the CSS class names as-is (`text-persimmon-green`, `bg-persimmon-navy`). Only change the values.

### Logos

Replace these files with Balfour Beatty SVGs/PNGs (I will provide the files):
- `shop/public/assets/balfour_icon.svg` — Square icon
- `shop/public/assets/balfour_wordmark.svg` — Text logo
- `shop/public/assets/balfour_full_logo.svg` — Combined logo
- `shop/app/icon.svg` — Favicon
- `shop/app/apple-icon.png` — Touch icon (180x180 PNG)

### Text Replacements

Find and replace "Persimmon" with "Balfour Beatty" in these files:

1. `shop/app/layout.tsx` — page title and meta description
2. `shop/components/Header.tsx` — subtitle text
3. `shop/components/SplashScreen.tsx` — splash text
4. `shop/app/(auth)/login/page.tsx` — login page title and description
5. `shop/lib/email.ts` — sender name, header bg colour (#002b49), accent colour (#005d99), footer text
6. `shop/app/not-found.tsx` — footer text
7. `shop/components/BasketContext.tsx` — change localStorage key from `"persimmon-basket"` to `"balfour-basket"`

### Order Prefix

In `shop/app/api/orders/route.ts`, change the order number prefix from `"PER-"` to `"BAL-"`.

### Database — Same Supabase, New Tables

This project shares the same Supabase instance as Persimmon. The env variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) stay the same. To keep data separate, all table names change from `psp_` (Persimmon) to `bal_` (Balfour Beatty).

**SQL migration to run in Supabase:**

```sql
-- Balfour Beatty tables (same schema as Persimmon, different prefix)
CREATE TABLE bal_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'new',
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  site_name TEXT NOT NULL,
  site_address TEXT NOT NULL,
  po_number TEXT,
  notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  vat NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bal_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES bal_orders(id),
  code TEXT NOT NULL,
  base_code TEXT,
  name TEXT NOT NULL,
  size TEXT,
  material TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  custom_data JSONB DEFAULT NULL
);

CREATE TABLE bal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','noted','done','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bal_orders_created_at ON bal_orders(created_at DESC);
CREATE INDEX idx_bal_suggestions_created_at ON bal_suggestions(created_at DESC);

ALTER TABLE bal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bal_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bal_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_bal_orders" ON bal_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bal_order_items" ON bal_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bal_suggestions" ON bal_suggestions FOR ALL USING (true) WITH CHECK (true);
```

**Code changes — rename all table references from `psp_` to `bal_`:**

| File | What to change |
|------|---------------|
| `shop/app/api/orders/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/api/orders/[orderNumber]/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/api/suggestions/route.ts` | `"psp_suggestions"` → `"bal_suggestions"` |
| `shop/supabase-setup.sql` | Update the schema documentation to reflect `bal_` tables |

### What NOT to change

- `shop/data/catalog.json` — same product catalog
- `shop/public/images/products/` — same product images
- All page structure, components, and shop flow — identical
- Custom sign builder — same
- Admin dashboard — same
- Auth model — same (cookie-based with shared passwords)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — same Supabase project

### Infrastructure (separate from code changes)

- Run the `bal_` SQL migration above in Supabase (same project as Persimmon)
- New Vercel project with root directory `shop/`
- Environment variables: copy from Persimmon, but use new values for `SHOP_PASSWORD`, `ADMIN_PASSWORD`, `SHOP_AUTH_TOKEN`, `ADMIN_AUTH_TOKEN`, `SITE_URL`. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the same.
- Resend: same API key works, but `FROM_EMAIL` may need a new verified domain

### Task

Please work through the changes systematically:
1. Update CSS colours in globals.css
2. Update text references in all listed files
3. Update email template branding in lib/email.ts
4. Update order prefix in the orders API
5. Update localStorage key in BasketContext
6. Rename all `psp_` table references to `bal_` in API routes
7. Update supabase-setup.sql with the `bal_` schema
8. Run `next build` to confirm everything compiles cleanly

Do not touch the product catalog, images, or any page/component logic. This is a visual rebrand only (plus the table prefix rename).
