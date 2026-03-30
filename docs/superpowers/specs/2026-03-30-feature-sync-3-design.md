# Feature Sync #3 — Design Spec

**Date:** 2026-03-30
**Source:** `docs/balfour-beatty-feature-sync-3.md`

## Summary

Port remaining Persimmon features to the Balfour Beatty signage portal: PDF generation (quote, order list), delivery note upload/download, custom size pricing, email header branding, admin document buttons, artwork registry, and fix existing Onesign branding in delivery-note.tsx.

## Database Migration

Add three columns to `bal_orders` for delivery note document storage:

- `dn_document_name TEXT`
- `dn_document_data TEXT`
- `dn_document_type TEXT`

Run via Supabase SQL editor (not automated).

## New Files

### PDF Libraries

- **`shop/lib/quote-pdf.tsx`** — Quote PDF generator using `@react-pdf/renderer`. Mirrors delivery-note.tsx pattern but includes prices. Brand colours: navy `#002b49`, blue `#005d99`. Uses Balfour Beatty logo SVG and company details.
- **`shop/lib/order-list-pdf.tsx`** — Order list PDF with artwork status column. Reads `shop/data/artwork-registry.json` to determine artwork-ready status per product code. "Yes" colour: `#005d99`.

### API Routes for PDFs

- **`shop/app/api/orders/[orderNumber]/quote/route.ts`** — Fetches order from `bal_orders`/`bal_order_items`, generates quote PDF, returns as download.
- **`shop/app/api/orders/[orderNumber]/order-list/route.ts`** — Same pattern, generates order list PDF.

### Delivery Note Upload/Download

- **`shop/app/api/orders/[orderNumber]/upload-dn/route.ts`** — Accepts file upload, stores as base64 in `bal_orders` dn columns. Admin-auth required.
- **`shop/app/api/orders/[orderNumber]/download-dn/route.ts`** — Serves stored DN document. Uses `bal_orders`.
- **`shop/app/dn-upload/[orderNumber]/page.tsx`** — Upload page (outside `(shop)` route group).
- **`shop/app/dn-upload/[orderNumber]/DnUploadForm.tsx`** — Upload form component. Mirrors existing PO upload pattern.

### Custom Size Pricing

- **`shop/lib/custom-size-pricing.ts`** — Pricing engine that finds nearest standard size for given dimensions, or flags as "requires quote".
- **`shop/components/CustomSizeSection.tsx`** — Client component for entering custom width/height. Uses Tailwind brand classes.

### Data

- **`shop/data/artwork-registry.json`** — Product codes with production-ready artwork. Starts with empty `codes` array.

## Modified Files

### `shop/app/api/orders/route.ts`

**GET handler:**
- Auto-correct stuck `awaiting_po` orders that already have PO uploaded → set to `new`
- Add `dnDocumentName: o.dn_document_name || null` to response transform

**POST handler:**
- Accept `customSizeData` on order items, store via `custom_data: item.customSizeData || item.customSign || null`

### `shop/app/api/orders/[orderNumber]/upload-po/route.ts`

- Fetch current status before update
- Only transition `awaiting_po` → `new` (not unconditionally set to `awaiting_po`)

### `shop/lib/email.ts`

- Add shared `emailHeaderHtml(title, siteUrl)` function with navy header, accent bar, logo, company details
- Apply header to all email functions
- Handle custom size data in `itemRowsHtml()` for items with dimension info

### `shop/lib/delivery-note.tsx` (branding fix)

- Replace `OnesignIcon` SVG → Balfour Beatty house icon
- Replace "Onesign and Digital" → "Balfour Beatty"
- Replace "D86 Princesway, Gateshead NE11 0TU" → Balfour Beatty address
- Replace "0191 487 6767" → Balfour Beatty phone
- Replace "onesignanddigital.com" → Balfour Beatty website

### `shop/components/BasketContext.tsx`

- Add `customSizeData` optional field to `BasketItem` interface

### `shop/app/(shop)/product/[code]/page.tsx`

- Import and render `CustomSizeSection` below standard variant selector

### `shop/app/(shop)/basket/page.tsx`

- Show custom size dimensions (e.g. "450 x 300mm")
- Show "Priced as {matchedSize}" or "Requires quote" badge
- Quote items: amber badge; priced items: green badge

### `shop/app/(shop)/checkout/page.tsx`

- Make purchaser mandatory (`canSubmit` requires `selectedPurchaser`)
- Add red asterisk to purchaser label
- Pass `customSizeData` through in order submission
- Show quote badges and disclaimer for quote items

### `shop/app/(shop)/admin/page.tsx`

- Add `dnDocumentName` to Order interface
- Add document action buttons in collapsed header: Quote PDF, Order List PDF, DN generate, DN download (if uploaded), Upload signed DN (if no DN), Upload PO (if no PO)
- Show custom size data in expanded order detail

## Branding Constants

| Property | Value |
|---|---|
| Navy | `#002b49` |
| Blue | `#005d99` |
| Company name | Balfour Beatty |
| Logo | SVG from `public/assets/balfour_house_icon.svg` |

## Data Flow: Custom Sizes

1. Product page → `CustomSizeSection` (user enters width × height)
2. `custom-size-pricing.ts` finds nearest standard size or flags "requires quote"
3. Stored as `customSizeData` on `BasketItem` in `BasketContext`
4. Checkout passes through to orders POST API
5. API stores in `custom_data` JSONB on `bal_order_items`
6. Admin, emails, and PDFs display dimensions + pricing info

## Implementation Order

1. Install `@react-pdf/renderer` if not already present
2. Create artwork-registry.json
3. Create custom-size-pricing.ts and CustomSizeSection.tsx
4. Create PDF libraries (quote-pdf.tsx, order-list-pdf.tsx)
5. Create API routes (quote, order-list, upload-dn, download-dn)
6. Create DN upload pages
7. Fix delivery-note.tsx branding
8. Update email.ts (header function + custom size support)
9. Update orders/route.ts (GET + POST)
10. Update upload-po/route.ts (status transition)
11. Update BasketContext.tsx
12. Update product page (CustomSizeSection)
13. Update basket page (custom size display)
14. Update checkout page (purchaser mandatory + customSizeData)
15. Update admin page (document buttons + custom size display)
16. Build verification
