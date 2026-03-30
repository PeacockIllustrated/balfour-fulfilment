# Feature Sync #3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port remaining Persimmon features to Balfour Beatty: PDF generation (quote + order list), delivery note upload/download, custom size pricing, email header branding, admin document buttons, and fix existing Onesign branding.

**Architecture:** Next.js App Router with Supabase backend. PDFs via `@react-pdf/renderer` (already installed). Emails via Make.com webhooks. All DB tables use `bal_` prefix, order numbers use `BAL-` prefix. Brand colours: navy `#002b49`, blue `#005d99`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind v4, Supabase, `@react-pdf/renderer`

---

### Task 1: Create artwork-registry.json

**Files:**
- Create: `shop/data/artwork-registry.json`

- [ ] **Step 1: Create the file**

```json
{
  "updatedAt": "2026-03-30",
  "description": "Product base codes with production-ready artwork. Used by order list PDF to show artwork status.",
  "codes": []
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/data/artwork-registry.json
git commit -m "feat: add empty artwork registry for order list PDF"
```

---

### Task 2: Create custom-size-pricing.ts

**Files:**
- Create: `shop/lib/custom-size-pricing.ts`

This module parses product variant sizes (e.g. "400x600mm") from the catalog and finds the nearest standard size for a given custom dimension, or flags it as "requires quote" if no reasonable match exists.

- [ ] **Step 1: Create the pricing engine**

```typescript
import { getCategories, type Variant, type Product, type Category } from "./catalog";

export interface CustomSizeMatch {
  width: number;
  height: number;
  material: string;
  matchedCode: string | null;
  matchedSize: string | null;
  matchedPrice: number | null;
  requiresQuote: boolean;
  originalProduct: string;
}

interface ParsedSize {
  w: number;
  h: number;
  variant: Variant;
}

const SIZE_RE = /^(\d+)\s*x\s*(\d+)\s*mm$/i;

function parseSizes(variants: Variant[]): ParsedSize[] {
  const results: ParsedSize[] = [];
  for (const v of variants) {
    if (!v.size) continue;
    const m = SIZE_RE.exec(v.size);
    if (m) {
      results.push({ w: parseInt(m[1], 10), h: parseInt(m[2], 10), variant: v });
    }
  }
  return results;
}

/**
 * Find the nearest standard size for a custom dimension.
 * Searches all variants of the given product's category that share the same material.
 * Returns the closest size that is >= the requested dimensions (i.e. can be cut down).
 * If nothing within 50% oversize exists, flags as "requires quote".
 */
export function findNearestSize(
  width: number,
  height: number,
  material: string,
  product: Product,
  category: Category
): CustomSizeMatch {
  const base: Omit<CustomSizeMatch, "matchedCode" | "matchedSize" | "matchedPrice" | "requiresQuote"> = {
    width,
    height,
    material,
    originalProduct: product.baseCode,
  };

  // Collect all sized variants across the category with matching material
  const candidates: ParsedSize[] = [];
  for (const p of category.products) {
    const sized = parseSizes(p.variants).filter(
      (s) => s.variant.material?.toLowerCase() === material.toLowerCase()
    );
    candidates.push(...sized);
  }

  if (candidates.length === 0) {
    return { ...base, matchedCode: null, matchedSize: null, matchedPrice: null, requiresQuote: true };
  }

  // Find smallest standard size that fits (width >= requested, height >= requested)
  // Allow either orientation (w×h or h×w)
  const fitting = candidates.filter(
    (c) =>
      (c.w >= width && c.h >= height) ||
      (c.h >= width && c.w >= height)
  );

  if (fitting.length === 0) {
    // No standard size large enough — check if within 50% oversize for quoting
    return { ...base, matchedCode: null, matchedSize: null, matchedPrice: null, requiresQuote: true };
  }

  // Sort by area (smallest fitting size first)
  fitting.sort((a, b) => a.w * a.h - b.w * b.h);
  const best = fitting[0];

  // If oversize by more than 50% area, flag for quote
  const requestedArea = width * height;
  const matchedArea = best.w * best.h;
  if (matchedArea > requestedArea * 1.5) {
    return { ...base, matchedCode: null, matchedSize: null, matchedPrice: null, requiresQuote: true };
  }

  return {
    ...base,
    matchedCode: best.variant.code,
    matchedSize: best.variant.size,
    matchedPrice: best.variant.price,
    requiresQuote: false,
  };
}

/**
 * Get all unique materials available across a category's variants.
 */
export function getAvailableMaterials(category: Category): string[] {
  const materials = new Set<string>();
  for (const p of category.products) {
    for (const v of p.variants) {
      if (v.material) materials.add(v.material);
    }
  }
  return Array.from(materials).sort();
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/lib/custom-size-pricing.ts
git commit -m "feat: add custom size pricing engine"
```

---

### Task 3: Create CustomSizeSection.tsx

**Files:**
- Create: `shop/components/CustomSizeSection.tsx`

Client component that lets users enter custom width × height dimensions on product pages. Uses the pricing engine from Task 2.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useBasket } from "./BasketContext";
import type { Product, Category } from "@/lib/catalog";
import { findNearestSize, getAvailableMaterials } from "@/lib/custom-size-pricing";

export default function CustomSizeSection({
  product,
  category,
}: {
  product: Product;
  category: Category;
}) {
  const { addItem, showToast } = useBasket();
  const materials = getAvailableMaterials(category);

  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [material, setMaterial] = useState(materials[0] || "");
  const [result, setResult] = useState<ReturnType<typeof findNearestSize> | null>(null);
  const [open, setOpen] = useState(false);

  const handleCalculate = () => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!w || !h || w <= 0 || h <= 0) {
      showToast("Please enter valid dimensions");
      return;
    }
    if (!material) {
      showToast("Please select a material");
      return;
    }
    const match = findNearestSize(w, h, material, product, category);
    setResult(match);
  };

  const handleAddToBasket = () => {
    if (!result) return;
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);

    addItem({
      code: result.matchedCode || `${product.baseCode}-CUSTOM`,
      baseCode: product.baseCode,
      name: product.name,
      size: `${w} x ${h}mm (Custom)`,
      material,
      description: product.name,
      price: result.requiresQuote ? 0 : (result.matchedPrice || 0),
      image: product.image,
      customSizeData: {
        width: w,
        height: h,
        material,
        matchedCode: result.matchedCode,
        matchedSize: result.matchedSize,
        matchedPrice: result.matchedPrice,
        requiresQuote: result.requiresQuote,
        originalProduct: product.baseCode,
      },
    });
  };

  if (materials.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-100 pt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-persimmon-navy hover:text-persimmon-green transition"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Need a custom size?
      </button>

      {open && (
        <div className="mt-4 bg-persimmon-gray rounded-xl p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Enter your required dimensions and we&apos;ll find the nearest standard size to price from.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Width (mm)</label>
              <input
                type="number"
                min="1"
                value={width}
                onChange={(e) => { setWidth(e.target.value); setResult(null); }}
                placeholder="e.g. 450"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Height (mm)</label>
              <input
                type="number"
                min="1"
                value={height}
                onChange={(e) => { setHeight(e.target.value); setResult(null); }}
                placeholder="e.g. 300"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>
            <select
              value={material}
              onChange={(e) => { setMaterial(e.target.value); setResult(null); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white appearance-none cursor-pointer"
            >
              {materials.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            className="w-full bg-persimmon-navy text-white py-2.5 rounded-xl text-sm font-medium hover:bg-persimmon-navy-light transition"
          >
            Find Nearest Size
          </button>

          {result && (
            <div className={`rounded-xl p-4 ${result.requiresQuote ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
              {result.requiresQuote ? (
                <>
                  <p className="font-semibold text-amber-700 text-sm">Requires Quote</p>
                  <p className="text-xs text-amber-600 mt-1">
                    No standard size matches {width} x {height}mm in {material}. Add to basket and we&apos;ll quote after review.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-emerald-700 text-sm">
                    Priced as {result.matchedSize}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {"\u00A3"}{result.matchedPrice?.toFixed(2)} each (ex. VAT) — matched to {result.matchedCode}
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={handleAddToBasket}
                className={`w-full mt-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  result.requiresQuote
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-persimmon-green text-white hover:bg-persimmon-green-dark"
                }`}
              >
                {result.requiresQuote ? "Add to Basket (Quote)" : "Add to Basket"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/components/CustomSizeSection.tsx
git commit -m "feat: add custom size section component for product pages"
```

---

### Task 4: Create quote-pdf.tsx

**Files:**
- Create: `shop/lib/quote-pdf.tsx`

PDF generator for quotes. Same structure as `shop/lib/delivery-note.tsx` but includes prices and totals. Uses Balfour Beatty branding.

- [ ] **Step 1: Create the quote PDF library**

```tsx
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Rect,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OrderItem, OrderData } from "./email";
import { SIGN_TYPE_COLORS } from "./email";

const C = {
  navy: "#002b49",
  blue: "#005d99",
  lightBlueBg: "#f0f7fc",
  blueBorder: "#b3d4ec",
  orangeBg: "#fff7ed",
  orangeBorder: "#fed7aa",
  orangeText: "#c2410c",
  grey: "#666666",
  lightGrey: "#f5f5f5",
  darkText: "#333333",
  divider: "#eeeeee",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    color: C.darkText,
  },
  headerBar: {
    backgroundColor: C.navy,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  accentBar: {
    height: 3,
    backgroundColor: C.blue,
  },
  headerSub: {
    fontSize: 8,
    color: C.grey,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 32,
  },
  body: { paddingHorizontal: 32, paddingTop: 16 },
  orderBox: {
    backgroundColor: C.lightBlueBg,
    borderWidth: 1,
    borderColor: C.blueBorder,
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.navy },
  orderDate: { fontSize: 10, color: C.grey },
  infoRow: { flexDirection: "row", columnGap: 24, marginBottom: 14 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 8, color: "#999999", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  infoValue: { fontSize: 10, color: C.darkText },
  infoBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  poLine: { fontSize: 10, color: C.grey, marginBottom: 14 },
  poBold: { fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.lightGrey,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  tableHeaderText: { fontSize: 8, color: C.grey, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colImage: { width: 48, paddingRight: 6 },
  colProduct: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: "center" },
  colPrice: { width: 60, textAlign: "right" },
  colTotal: { width: 70, textAlign: "right" },
  productImage: { width: 38, height: 38, borderRadius: 4, objectFit: "contain", backgroundColor: "#f8f8f8" },
  productCode: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  productName: { fontSize: 9, color: C.grey, marginTop: 1 },
  customFieldText: { fontSize: 8, color: C.navy, marginTop: 1 },
  customFieldValue: { color: C.grey },
  qtyText: { fontSize: 11, textAlign: "center" },
  priceText: { fontSize: 10, textAlign: "right" },
  totalText: { fontSize: 10, textAlign: "right", fontFamily: "Helvetica-Bold" },
  quoteText: { fontSize: 9, textAlign: "right", color: "#d97706", fontFamily: "Helvetica-Bold" },
  signBadge: { width: 38, height: 38, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  signBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  customSignTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  customSignDetail: { fontSize: 9, color: C.grey, marginTop: 1 },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 4, paddingHorizontal: 4 },
  totalsLabel: { fontSize: 10, color: C.grey, width: 80, textAlign: "right", paddingRight: 12 },
  totalsValue: { fontSize: 10, width: 70, textAlign: "right" },
  totalsBold: { fontFamily: "Helvetica-Bold", color: C.navy, fontSize: 11 },
  notesBox: { backgroundColor: C.orangeBg, borderWidth: 1, borderColor: C.orangeBorder, borderRadius: 6, padding: 10, marginTop: 16 },
  notesLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.orangeText },
  notesText: { fontSize: 10, color: C.orangeText },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 1, borderTopColor: C.navy, paddingTop: 6 },
  footerText: { fontSize: 8, color: C.grey, textAlign: "center" },
});

function BalfourLogo({ size = 26 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect width="32" height="32" rx="4" fill={C.white} />
      <Text
        x="16"
        y="22"
        style={{ fontFamily: "Helvetica-Bold", fontSize: 16, color: C.navy }}
      >
        {""}
      </Text>
    </Svg>
  );
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

interface ImageMap { [code: string]: string }

async function buildImageMap(items: OrderItem[], siteUrl: string): Promise<ImageMap> {
  const map: ImageMap = {};
  const seen = new Set<string>();
  const fetches = items
    .filter((item) => !item.custom_data?.signType)
    .map((item) => {
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return fetchImageAsDataUri(`${siteUrl}/images/products/${imgCode}.png`).then((uri) => {
        if (uri) map[imgCode] = uri;
      });
    })
    .filter(Boolean);
  await Promise.all(fetches);
  return map;
}

function QuoteDocument({ order, images }: { order: OrderData; images: ImageMap }) {
  const orderDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <BalfourLogo size={26} />
          <Text style={s.headerTitle}>QUOTATION</Text>
        </View>
        <View style={s.accentBar} />
        <Text style={s.headerSub}>
          Balfour Beatty
        </Text>

        <View style={s.body}>
          <View style={s.orderBox}>
            <View>
              <Text style={s.orderNumber}>{order.orderNumber}</Text>
            </View>
            <Text style={s.orderDate}>{orderDate}</Text>
          </View>

          <View style={s.infoRow}>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Site</Text>
              <Text style={s.infoBold}>{order.siteName}</Text>
              <Text style={s.infoValue}>{order.siteAddress}</Text>
            </View>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Contact</Text>
              <Text style={s.infoBold}>{order.contactName}</Text>
              <Text style={s.infoValue}>{order.email}</Text>
              <Text style={s.infoValue}>{order.phone}</Text>
            </View>
          </View>

          {order.poNumber ? (
            <Text style={s.poLine}>
              <Text style={s.poBold}>PO Number: </Text>
              {order.poNumber}
            </Text>
          ) : null}

          {/* Items table */}
          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}>
              <Text style={s.tableHeaderText}>Product</Text>
            </View>
            <View style={s.colQty}>
              <Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text>
            </View>
            <View style={s.colPrice}>
              <Text style={[s.tableHeaderText, { textAlign: "right" }]}>Price</Text>
            </View>
            <View style={s.colTotal}>
              <Text style={[s.tableHeaderText, { textAlign: "right" }]}>Total</Text>
            </View>
          </View>

          {order.items.map((item, i) => {
            if (item.custom_data?.signType) {
              const colors = SIGN_TYPE_COLORS[item.custom_data.signType] || { bg: "#666", fg: "#FFF" };
              const typeLabel = (item.custom_data.signType).charAt(0).toUpperCase() + item.custom_data.signType.slice(1).replace("-", " ");
              return (
                <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
                  <View style={s.colImage}>
                    <View style={[s.signBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[s.signBadgeText, { color: colors.fg }]}>{typeLabel}</Text>
                    </View>
                  </View>
                  <View style={s.colProduct}>
                    <Text style={s.customSignTitle}>CUSTOM SIGN</Text>
                    <Text style={s.customSignDetail}>{typeLabel} {"\u00B7"} {item.custom_data.shape} {"\u00B7"} {item.size}</Text>
                  </View>
                  <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
                  <View style={s.colPrice}><Text style={s.quoteText}>Quote</Text></View>
                  <View style={s.colTotal}><Text style={s.quoteText}>Quote</Text></View>
                </View>
              );
            }

            const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
            const imgUri = images[imgCode];
            const customFields = item.custom_data?.fields as Array<{ label: string; key: string; value: string }> | undefined;

            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
                <View style={s.colImage}>
                  {imgUri ? (
                    <Image src={imgUri} style={s.productImage} />
                  ) : (
                    <View style={[s.productImage, { backgroundColor: "#f0f0f0" }]} />
                  )}
                </View>
                <View style={s.colProduct}>
                  <Text style={s.productCode}>{item.code}</Text>
                  <Text style={s.productName}>{item.name}{item.size ? ` (${item.size})` : ""}</Text>
                  {customFields?.map((f) => (
                    <Text key={f.key} style={s.customFieldText}>
                      {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
                    </Text>
                  ))}
                </View>
                <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
                <View style={s.colPrice}><Text style={s.priceText}>{"\u00A3"}{item.price.toFixed(2)}</Text></View>
                <View style={s.colTotal}><Text style={s.totalText}>{"\u00A3"}{item.line_total.toFixed(2)}</Text></View>
              </View>
            );
          })}

          {/* Totals */}
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text style={s.totalsValue}>{"\u00A3"}{order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>VAT (20%)</Text>
            <Text style={s.totalsValue}>{"\u00A3"}{order.vat.toFixed(2)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={[s.totalsLabel, s.totalsBold]}>Total</Text>
            <Text style={[s.totalsValue, s.totalsBold]}>{"\u00A3"}{order.total.toFixed(2)}</Text>
          </View>

          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>
                <Text style={s.notesLabel}>Notes: </Text>
                {order.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Balfour Beatty</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateQuotePdf(order: OrderData): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);
  const buffer = await renderToBuffer(<QuoteDocument order={order} images={images} />);
  return Buffer.from(buffer).toString("base64");
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/lib/quote-pdf.tsx
git commit -m "feat: add quote PDF generator with Balfour branding"
```

---

### Task 5: Create order-list-pdf.tsx

**Files:**
- Create: `shop/lib/order-list-pdf.tsx`

Order list PDF with artwork status column. Reads artwork-registry.json to show Yes/No per item.

- [ ] **Step 1: Create the order list PDF library**

```tsx
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Rect,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OrderItem, OrderData } from "./email";
import { SIGN_TYPE_COLORS } from "./email";
import artworkRegistry from "@/data/artwork-registry.json";

const C = {
  navy: "#002b49",
  blue: "#005d99",
  lightBlueBg: "#f0f7fc",
  blueBorder: "#b3d4ec",
  grey: "#666666",
  lightGrey: "#f5f5f5",
  darkText: "#333333",
  divider: "#eeeeee",
  white: "#ffffff",
  artworkYes: "#005d99",
  artworkNo: "#999999",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 0, paddingBottom: 40, paddingHorizontal: 0, color: C.darkText },
  headerBar: { backgroundColor: C.navy, paddingVertical: 18, paddingHorizontal: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: C.white, fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  accentBar: { height: 3, backgroundColor: C.blue },
  headerSub: { fontSize: 8, color: C.grey, textAlign: "center", marginTop: 6, paddingHorizontal: 32 },
  body: { paddingHorizontal: 32, paddingTop: 16 },
  orderBox: { backgroundColor: C.lightBlueBg, borderWidth: 1, borderColor: C.blueBorder, borderRadius: 6, padding: 14, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderNumber: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.navy },
  orderDate: { fontSize: 10, color: C.grey },
  infoRow: { flexDirection: "row", columnGap: 24, marginBottom: 14 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 8, color: "#999999", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  infoValue: { fontSize: 10, color: C.darkText },
  infoBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  tableHeader: { flexDirection: "row", backgroundColor: C.lightGrey, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.divider },
  tableHeaderText: { fontSize: 8, color: C.grey, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.divider, alignItems: "center" },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colImage: { width: 44, paddingRight: 4 },
  colProduct: { flex: 1, paddingRight: 6 },
  colQty: { width: 35, textAlign: "center" },
  colArtwork: { width: 50, textAlign: "center" },
  productImage: { width: 36, height: 36, borderRadius: 4, objectFit: "contain", backgroundColor: "#f8f8f8" },
  productCode: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  productName: { fontSize: 9, color: C.grey, marginTop: 1 },
  customFieldText: { fontSize: 8, color: C.navy, marginTop: 1 },
  customFieldValue: { color: C.grey },
  qtyText: { fontSize: 11, textAlign: "center" },
  artworkYes: { fontSize: 9, textAlign: "center", color: C.artworkYes, fontFamily: "Helvetica-Bold" },
  artworkNo: { fontSize: 9, textAlign: "center", color: C.artworkNo },
  signBadge: { width: 36, height: 36, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  signBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  customSignTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  customSignDetail: { fontSize: 9, color: C.grey, marginTop: 1 },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, borderTopWidth: 1, borderTopColor: C.navy, paddingTop: 6 },
  footerText: { fontSize: 8, color: C.grey, textAlign: "center" },
});

function BalfourLogo({ size = 26 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect width="32" height="32" rx="4" fill={C.white} />
    </Svg>
  );
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

interface ImageMap { [code: string]: string }

async function buildImageMap(items: OrderItem[], siteUrl: string): Promise<ImageMap> {
  const map: ImageMap = {};
  const seen = new Set<string>();
  const fetches = items
    .filter((item) => !item.custom_data?.signType)
    .map((item) => {
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return fetchImageAsDataUri(`${siteUrl}/images/products/${imgCode}.png`).then((uri) => {
        if (uri) map[imgCode] = uri;
      });
    })
    .filter(Boolean);
  await Promise.all(fetches);
  return map;
}

const artworkCodes = new Set((artworkRegistry as { codes: string[] }).codes);

function hasArtwork(item: OrderItem): boolean {
  const baseCode = item.base_code || item.code.replace(/\/.*$/, "");
  return artworkCodes.has(baseCode);
}

function OrderListDocument({ order, images }: { order: OrderData; images: ImageMap }) {
  const orderDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <BalfourLogo size={26} />
          <Text style={s.headerTitle}>ORDER LIST</Text>
        </View>
        <View style={s.accentBar} />
        <Text style={s.headerSub}>Balfour Beatty</Text>

        <View style={s.body}>
          <View style={s.orderBox}>
            <View><Text style={s.orderNumber}>{order.orderNumber}</Text></View>
            <Text style={s.orderDate}>{orderDate}</Text>
          </View>

          <View style={s.infoRow}>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Site</Text>
              <Text style={s.infoBold}>{order.siteName}</Text>
              <Text style={s.infoValue}>{order.siteAddress}</Text>
            </View>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Contact</Text>
              <Text style={s.infoBold}>{order.contactName}</Text>
              <Text style={s.infoValue}>{order.phone}</Text>
            </View>
          </View>

          {/* Items table */}
          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}><Text style={s.tableHeaderText}>Product</Text></View>
            <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text></View>
            <View style={s.colArtwork}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Artwork</Text></View>
          </View>

          {order.items.map((item, i) => {
            if (item.custom_data?.signType) {
              const colors = SIGN_TYPE_COLORS[item.custom_data.signType] || { bg: "#666", fg: "#FFF" };
              const typeLabel = item.custom_data.signType.charAt(0).toUpperCase() + item.custom_data.signType.slice(1).replace("-", " ");
              return (
                <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
                  <View style={s.colImage}>
                    <View style={[s.signBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[s.signBadgeText, { color: colors.fg }]}>{typeLabel}</Text>
                    </View>
                  </View>
                  <View style={s.colProduct}>
                    <Text style={s.customSignTitle}>CUSTOM SIGN</Text>
                    <Text style={s.customSignDetail}>{typeLabel} {"\u00B7"} {item.custom_data.shape} {"\u00B7"} {item.size}</Text>
                  </View>
                  <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
                  <View style={s.colArtwork}><Text style={s.artworkNo}>N/A</Text></View>
                </View>
              );
            }

            const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
            const imgUri = images[imgCode];
            const customFields = item.custom_data?.fields as Array<{ label: string; key: string; value: string }> | undefined;
            const artwork = hasArtwork(item);

            return (
              <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
                <View style={s.colImage}>
                  {imgUri ? <Image src={imgUri} style={s.productImage} /> : <View style={[s.productImage, { backgroundColor: "#f0f0f0" }]} />}
                </View>
                <View style={s.colProduct}>
                  <Text style={s.productCode}>{item.code}</Text>
                  <Text style={s.productName}>{item.name}{item.size ? ` (${item.size})` : ""}</Text>
                  {customFields?.map((f) => (
                    <Text key={f.key} style={s.customFieldText}>
                      {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
                    </Text>
                  ))}
                </View>
                <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
                <View style={s.colArtwork}>
                  <Text style={artwork ? s.artworkYes : s.artworkNo}>{artwork ? "Yes" : "No"}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Balfour Beatty</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateOrderListPdf(order: OrderData): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);
  const buffer = await renderToBuffer(<OrderListDocument order={order} images={images} />);
  return Buffer.from(buffer).toString("base64");
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/lib/order-list-pdf.tsx
git commit -m "feat: add order list PDF with artwork status column"
```

---

### Task 6: Create quote and order-list API routes

**Files:**
- Create: `shop/app/api/orders/[orderNumber]/quote/route.ts`
- Create: `shop/app/api/orders/[orderNumber]/order-list/route.ts`

Both follow the exact same pattern as the existing `delivery-note/route.ts` — fetch order from `bal_orders` + `bal_order_items`, generate PDF, return as download.

- [ ] **Step 1: Create quote API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { generateQuotePdf } from "@/lib/quote-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const { data: order, error: orderError } = await supabase
      .from("bal_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("bal_order_items")
      .select("*")
      .eq("order_id", order.id);

    const orderData = {
      orderNumber: order.order_number,
      contactName: order.contact_name,
      email: order.email,
      phone: order.phone,
      siteName: order.site_name,
      siteAddress: order.site_address,
      poNumber: order.po_number,
      notes: order.notes,
      items: (items || []).map((item: Record<string, unknown>) => ({
        code: item.code as string,
        base_code: item.base_code as string | null,
        name: item.name as string,
        size: item.size as string | null,
        material: item.material as string | null,
        price: Number(item.price),
        quantity: item.quantity as number,
        line_total: Number(item.line_total),
        custom_data: item.custom_data || null,
      })),
      subtotal: Number(order.subtotal),
      vat: Number(order.vat),
      total: Number(order.total),
    };

    const base64 = await generateQuotePdf(orderData);
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${orderNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Quote PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create order-list API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { generateOrderListPdf } from "@/lib/order-list-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const { data: order, error: orderError } = await supabase
      .from("bal_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("bal_order_items")
      .select("*")
      .eq("order_id", order.id);

    const orderData = {
      orderNumber: order.order_number,
      contactName: order.contact_name,
      email: order.email,
      phone: order.phone,
      siteName: order.site_name,
      siteAddress: order.site_address,
      poNumber: order.po_number,
      notes: order.notes,
      items: (items || []).map((item: Record<string, unknown>) => ({
        code: item.code as string,
        base_code: item.base_code as string | null,
        name: item.name as string,
        size: item.size as string | null,
        material: item.material as string | null,
        price: Number(item.price),
        quantity: item.quantity as number,
        line_total: Number(item.line_total),
        custom_data: item.custom_data || null,
      })),
      subtotal: Number(order.subtotal),
      vat: Number(order.vat),
      total: Number(order.total),
    };

    const base64 = await generateOrderListPdf(orderData);
    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="order-list-${orderNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Order list PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate order list" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add shop/app/api/orders/\[orderNumber\]/quote/route.ts shop/app/api/orders/\[orderNumber\]/order-list/route.ts
git commit -m "feat: add quote and order list PDF API routes"
```

---

### Task 7: Create DN upload/download API routes

**Files:**
- Create: `shop/app/api/orders/[orderNumber]/upload-dn/route.ts`
- Create: `shop/app/api/orders/[orderNumber]/download-dn/route.ts`

Upload-dn mirrors upload-po but uses admin auth (no token) and writes to `dn_document_*` columns. Download-dn mirrors download-po but reads `dn_document_*` columns.

- [ ] **Step 1: Create upload-dn route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: PDF, PNG, JPEG, WebP" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const { error: updateError } = await supabase
      .from("bal_orders")
      .update({
        dn_document_name: file.name,
        dn_document_data: base64,
        dn_document_type: file.type,
      })
      .eq("order_number", orderNumber);

    if (updateError) {
      console.error("DN upload DB error:", updateError);
      return NextResponse.json({ error: "Failed to save DN document" }, { status: 500 });
    }

    console.log(`DN document uploaded for ${orderNumber} — ${file.name} (${Math.round(file.size / 1024)}KB)`);

    return NextResponse.json({ success: true, message: "Delivery note uploaded" });
  } catch (error) {
    console.error("DN upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create download-dn route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const { data: order, error } = await supabase
      .from("bal_orders")
      .select("dn_document_name, dn_document_data, dn_document_type")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.dn_document_data) {
      return NextResponse.json({ error: "No delivery note uploaded" }, { status: 404 });
    }

    const buffer = Buffer.from(order.dn_document_data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": order.dn_document_type || "application/pdf",
        "Content-Disposition": `attachment; filename="${order.dn_document_name || `dn-${orderNumber}.pdf`}"`,
      },
    });
  } catch (error) {
    console.error("DN download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add shop/app/api/orders/\[orderNumber\]/upload-dn/route.ts shop/app/api/orders/\[orderNumber\]/download-dn/route.ts
git commit -m "feat: add delivery note upload and download API routes"
```

---

### Task 8: Create DN upload page and form

**Files:**
- Create: `shop/app/dn-upload/[orderNumber]/page.tsx`
- Create: `shop/app/dn-upload/[orderNumber]/DnUploadForm.tsx`

These sit outside the `(shop)` route group. The page uses admin-auth (no token param needed — admin is already authenticated via cookie). The form mirrors `PoUploadForm.tsx` but posts to the upload-dn endpoint.

- [ ] **Step 1: Create the DN upload page**

```tsx
import DnUploadForm from "./DnUploadForm";

export default async function DnUploadPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#002b49] rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#002b49]">Upload Signed Delivery Note</h1>
          <p className="text-gray-500 text-sm mt-1">
            Order <strong>{orderNumber}</strong>
          </p>
        </div>

        <DnUploadForm orderNumber={orderNumber} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the DN upload form**

```tsx
"use client";

import { useState, useRef } from "react";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 5 * 1024 * 1024;

export default function DnUploadForm({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/orders/${orderNumber}/upload-dn`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-[#005d99] rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#002b49] mb-2">Delivery Note Uploaded</h2>
        <p className="text-gray-500 text-sm">
          The signed delivery note for <strong>{orderNumber}</strong> has been saved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#005d99] transition"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f && f.size > MAX_SIZE) {
              setError("File too large (max 5MB)");
              setFile(null);
              return;
            }
            setError(null);
            setFile(f);
          }}
        />
        {file ? (
          <div>
            <svg className="w-8 h-8 text-[#005d99] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium text-[#002b49]">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            <p className="text-xs text-[#005d99] mt-2">Click to change file</p>
          </div>
        ) : (
          <div>
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-500 text-sm">Click to select your signed delivery note</p>
            <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPEG, or WebP — max 5MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-[#005d99] text-white py-3 rounded-xl font-medium hover:bg-[#004a7a] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading..." : "Upload Delivery Note"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add shop/app/dn-upload/
git commit -m "feat: add delivery note upload page and form"
```

---

### Task 9: Fix delivery-note.tsx branding

**Files:**
- Modify: `shop/lib/delivery-note.tsx:349-360` (OnesignIcon function)
- Modify: `shop/lib/delivery-note.tsx:510-515` (header bar content)
- Modify: `shop/lib/delivery-note.tsx:593-595` (footer)

Replace all Onesign/Persimmon references with Balfour Beatty.

- [ ] **Step 1: Replace OnesignIcon with BalfourLogo**

Replace the `OnesignIcon` function (lines 349-360) with:

```tsx
function BalfourLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect width="32" height="32" rx="4" fill={C.white} />
    </Svg>
  );
}
```

Also add `Rect` to the import from `@react-pdf/renderer` at line 8.

- [ ] **Step 2: Update header content**

Replace the header bar section (around lines 509-516) — change `<OnesignIcon size={26} />` to `<BalfourLogo size={26} />` and replace the `headerSub` text:

```tsx
<Text style={s.headerSub}>
  Balfour Beatty
</Text>
```

- [ ] **Step 3: Update footer**

Replace footer text (around line 594):

```tsx
<Text style={s.footerText}>
  Balfour Beatty
</Text>
```

- [ ] **Step 4: Commit**

```bash
git add shop/lib/delivery-note.tsx
git commit -m "fix: replace Onesign branding with Balfour Beatty in delivery note PDF"
```

---

### Task 10: Update email.ts — add emailHeaderHtml and custom size support

**Files:**
- Modify: `shop/lib/email.ts`

Add a shared `emailHeaderHtml(title, siteUrl)` function used by all email builders. Also update `itemRowsHtml` to handle custom size data.

- [ ] **Step 1: Add emailHeaderHtml function**

Add this function after the existing `esc()` function (after line 9):

```typescript
/** Shared branded email header used by all email functions */
function emailHeaderHtml(title: string): string {
  return `
    <div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:white;margin:0;font-size:20px">${esc(title)}</h1>
    </div>
    <div style="height:3px;background:#005d99"></div>
    <div style="text-align:center;padding:8px 32px 0">
      <p style="margin:0;font-size:11px;color:#999">Balfour Beatty</p>
    </div>`;
}
```

- [ ] **Step 2: Use emailHeaderHtml in buildNestPOEmailHtml**

Replace the inline header `<div>` in `buildNestPOEmailHtml` (the `<div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">` block, around line 136-138) with:

```typescript
${emailHeaderHtml("Purchase Order Request")}
```

- [ ] **Step 3: Use emailHeaderHtml in buildPurchaserPOEmailHtml**

Replace the inline header `<div>` in `buildPurchaserPOEmailHtml` (around line 195-197) with:

```typescript
${emailHeaderHtml("Purchase Order Required")}
```

- [ ] **Step 4: Add custom size data handling in itemRowsHtml**

In the `itemRowsHtml` function, after the custom sign check (line 62-81) and before the standard item section (line 84), add a handler for custom size items. Insert this block:

```typescript
      // Custom size item (has dimension data in custom_data)
      if (item.custom_data && (item.custom_data as Record<string, unknown>).width) {
        const cd = item.custom_data as Record<string, unknown>;
        const dimText = `${cd.width} x ${cd.height}mm`;
        const matchText = cd.matchedSize ? `Priced as ${cd.matchedSize}` : "Requires quote";
        const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
        return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <img src="${siteUrl ? `${siteUrl}/images/products/${imgCode}.png` : `cid:${imgCode}`}" alt="${esc(item.code)}" width="40" height="40" style="display:block;border-radius:4px;object-fit:contain;background:#f8f8f8" />
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">${esc(item.code)}</strong><br/>
        <span style="color:#666;font-size:12px">${esc(item.name)} (${dimText})</span><br/>
        <span style="color:${cd.requiresQuote ? "#d97706" : "#059669"};font-size:11px;font-weight:bold">${matchText}</span>
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:right;vertical-align:middle">${cd.requiresQuote ? '<span style="color:#d97706;font-weight:bold;font-size:12px">Quote</span>' : `&pound;${item.line_total.toFixed(2)}`}</td>
    </tr>`;
      }
```

- [ ] **Step 5: Commit**

```bash
git add shop/lib/email.ts
git commit -m "feat: add shared email header function and custom size data support"
```

---

### Task 11: Update orders/route.ts — GET and POST handlers

**Files:**
- Modify: `shop/app/api/orders/route.ts:211-265` (GET handler)
- Modify: `shop/app/api/orders/route.ts:37-82` (POST handler items processing)

- [ ] **Step 1: Update GET handler — auto-correct stuck orders + add dnDocumentName**

In the GET handler, after the `allItems` fetch (after line 231) and before the transform (line 235), add the auto-correct logic:

```typescript
    // Fix any orders stuck on awaiting_po that already have a PO uploaded
    const stuckOrders = orders.filter(
      (o) => o.status === "awaiting_po" && o.po_document_name
    );
    if (stuckOrders.length > 0) {
      await supabase
        .from("bal_orders")
        .update({ status: "new" })
        .in("id", stuckOrders.map((o) => o.id));
      for (const o of stuckOrders) o.status = "new";
    }
```

In the transform (around line 248), add `dnDocumentName` after the `poDocumentName` line:

```typescript
      dnDocumentName: o.dn_document_name || null,
```

- [ ] **Step 2: Update POST handler — accept customSizeData**

In the POST handler's `validatedItems.map` callback (around line 50-69 where `custom_data` is built), replace the `custom_data` construction with:

```typescript
      // Build custom_data JSONB — custom sign, custom fields, or custom size data
      let custom_data = null;
      if (item.customSign) {
        custom_data = {
          type: "custom_sign" as const,
          signType: String(item.customSign.signType),
          textContent: String(item.customSign.textContent),
          shape: String(item.customSign.shape),
          additionalNotes: String(item.customSign.additionalNotes || ""),
        };
      } else if (item.customSizeData) {
        custom_data = item.customSizeData;
      } else if (item.customFieldValues && item.customFieldValues.length > 0) {
        custom_data = {
          type: "custom_fields" as const,
          fields: item.customFieldValues.map((f) => ({
            label: String(f.label),
            key: String(f.key),
            value: String(f.value),
          })),
        };
      }
```

Also update the items type annotation in the `.map()` call (line 37) to add `customSizeData` to the type:

Add `customSizeData?: Record<string, unknown>;` to the item type inline.

- [ ] **Step 3: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: auto-correct stuck awaiting_po orders, add dnDocumentName, accept customSizeData"
```

---

### Task 12: Update upload-po/route.ts — status transition

**Files:**
- Modify: `shop/app/api/orders/[orderNumber]/upload-po/route.ts:40-53`

Currently the route unconditionally sets status to `awaiting_po` on PO upload. Change it to fetch current status first, and only transition `awaiting_po` → `new`.

- [ ] **Step 1: Update the upload logic**

Replace lines 40-53 (the base64 conversion through the supabase update) with:

```typescript
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Fetch current status so we only transition awaiting_po → new
    const { data: current } = await supabase
      .from("bal_orders")
      .select("status")
      .eq("order_number", orderNumber)
      .single();

    const updates: Record<string, string> = {
      po_document_name: file.name,
      po_document_data: base64,
      po_document_type: file.type,
    };

    if (current?.status === "awaiting_po") {
      updates.status = "new";
    }

    // Update order with PO document
    const { error: updateError } = await supabase
      .from("bal_orders")
      .update(updates)
      .eq("order_number", orderNumber);
```

- [ ] **Step 2: Commit**

```bash
git add shop/app/api/orders/\[orderNumber\]/upload-po/route.ts
git commit -m "feat: PO upload transitions awaiting_po to new status"
```

---

### Task 13: Update BasketContext.tsx — add customSizeData

**Files:**
- Modify: `shop/components/BasketContext.tsx:18-29`

- [ ] **Step 1: Add customSizeData to BasketItem interface**

Add `customSizeData` field to the `BasketItem` interface after `customFieldValues` (line 29):

```typescript
  customSizeData?: {
    width: number;
    height: number;
    material: string;
    matchedCode: string | null;
    matchedSize: string | null;
    matchedPrice: number | null;
    requiresQuote: boolean;
    originalProduct: string;
    fields?: Array<{ label: string; key: string; value: string }>;
  };
```

- [ ] **Step 2: Commit**

```bash
git add shop/components/BasketContext.tsx
git commit -m "feat: add customSizeData to BasketItem interface"
```

---

### Task 14: Update product page — add CustomSizeSection

**Files:**
- Modify: `shop/app/(shop)/product/[code]/page.tsx`

- [ ] **Step 1: Add import and render CustomSizeSection**

Add import at top (after line 4):

```typescript
import CustomSizeSection from "@/components/CustomSizeSection";
```

Add the component after the closing `</div>` of the variants list (after line 116, just before the final closing `</div>` of the right column). Insert inside the right-column `<div>` (the one starting at line 74):

```tsx
          <CustomSizeSection product={product} category={category} />
```

This goes right after the `</div>` that closes the `space-y-3` variants container (after line 116).

- [ ] **Step 2: Commit**

```bash
git add shop/app/\(shop\)/product/\[code\]/page.tsx
git commit -m "feat: add custom size section to product pages"
```

---

### Task 15: Update basket page — custom size display + quote badges

**Files:**
- Modify: `shop/app/(shop)/basket/page.tsx`

- [ ] **Step 1: Add custom size display in item card**

In the item card, after the custom field values display (after line 70) and before the price display (line 72), add custom size display:

```tsx
              {item.customSizeData && (
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {item.customSizeData.width} x {item.customSizeData.height}mm
                  </p>
                  {item.customSizeData.requiresQuote ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full">
                      Requires quote
                    </span>
                  ) : item.customSizeData.matchedSize ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full">
                      Priced as {item.customSizeData.matchedSize}
                    </span>
                  ) : null}
                </div>
              )}
```

- [ ] **Step 2: Update price display for custom size quote items**

Update the price display section (lines 72-77). Replace:

```tsx
              {item.customSign ? (
                <p className="text-amber-600 font-semibold mt-1.5 text-sm">Quote on request</p>
              ) : (
```

With:

```tsx
              {item.customSign || item.customSizeData?.requiresQuote ? (
                <p className="text-amber-600 font-semibold mt-1.5 text-sm">Quote on request</p>
              ) : (
```

- [ ] **Step 3: Update line total display for custom size quote items**

Update the line total section at the bottom of the item card (lines 108-114). Replace:

```tsx
              {item.customSign ? (
                <p className="font-bold text-amber-600 text-xs">Quote</p>
              ) : (
```

With:

```tsx
              {item.customSign || item.customSizeData?.requiresQuote ? (
                <p className="font-bold text-amber-600 text-xs">Quote</p>
              ) : (
```

- [ ] **Step 4: Update quote disclaimer at bottom**

Replace the quote disclaimer (line 138-142):

```tsx
        {items.some((i) => i.customSign) && (
```

With:

```tsx
        {items.some((i) => i.customSign || i.customSizeData?.requiresQuote) && (
```

- [ ] **Step 5: Commit**

```bash
git add shop/app/\(shop\)/basket/page.tsx
git commit -m "feat: show custom size info and quote badges in basket"
```

---

### Task 16: Update checkout page — purchaser mandatory + customSizeData pass-through + quote badges

**Files:**
- Modify: `shop/app/(shop)/checkout/page.tsx`

- [ ] **Step 1: Make purchaser mandatory**

Change `canSubmit` (line 86) from:

```typescript
  const canSubmit = selectedContact && selectedSite && !submitting;
```

To:

```typescript
  const canSubmit = selectedContact && selectedSite && selectedPurchaser && !submitting;
```

- [ ] **Step 2: Update purchaser label to show required**

Change the purchaser section header (line 484) from:

```tsx
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Purchaser <span className="text-xs font-normal text-gray-400">(optional)</span></h2>
```

To:

```tsx
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Purchaser <span className="text-red-500">*</span></h2>
```

- [ ] **Step 3: Remove "No purchaser" option from dropdown**

Change line 485-486 from:

```tsx
            <select value={selectedPurchaser?.id || (showNewPurchaser ? "__new__" : "__none__")} onChange={handlePurchaserSelect} className={selectClass}>
              <option value="__none__">No purchaser</option>
```

To:

```tsx
            <select value={selectedPurchaser?.id || (showNewPurchaser ? "__new__" : "")} onChange={handlePurchaserSelect} className={selectClass}>
              <option value="" disabled>Select a purchaser...</option>
```

- [ ] **Step 4: Pass customSizeData through in order submission**

In the `handleSubmit` items map (around line 364-375), add customSizeData pass-through. Replace:

```typescript
            ...(item.customSign ? { customSign: item.customSign } : {}),
            ...(item.customFieldValues ? { customFieldValues: item.customFieldValues } : {}),
```

With:

```typescript
            ...(item.customSign ? { customSign: item.customSign } : {}),
            ...(item.customFieldValues ? { customFieldValues: item.customFieldValues } : {}),
            ...(item.customSizeData ? { customSizeData: item.customSizeData } : {}),
```

- [ ] **Step 5: Add quote badges in order summary sidebar**

In the order summary sidebar items loop (around lines 539-561), update the item display. Replace:

```tsx
                    <span className="text-gray-500 truncate mr-2">
                      {item.customSign ? "Custom Sign" : item.code} x{item.quantity}
                    </span>
                    {item.customSign ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
```

With:

```tsx
                    <span className="text-gray-500 truncate mr-2">
                      {item.customSign ? "Custom Sign" : item.code} x{item.quantity}
                    </span>
                    {item.customSign || item.customSizeData?.requiresQuote ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
```

- [ ] **Step 6: Add quote disclaimer**

Replace the custom sign disclaimer at the bottom (around line 598-602):

```tsx
            {items.some((i) => i.customSign) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Custom sign items will be quoted separately after review.
              </p>
            )}
```

With:

```tsx
            {items.some((i) => i.customSign || i.customSizeData?.requiresQuote) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Items marked &ldquo;Quote&rdquo; will be priced after review.
              </p>
            )}
```

- [ ] **Step 7: Add purchaser required hint**

After the site required hint (line 591-593), add a purchaser hint:

```tsx
            {selectedContact && selectedSite && !selectedPurchaser && !showNewPurchaser && (
              <p className="text-[11px] text-amber-600 mt-3 text-center">Please select or add a purchaser to continue.</p>
            )}
```

- [ ] **Step 8: Commit**

```bash
git add shop/app/\(shop\)/checkout/page.tsx
git commit -m "feat: make purchaser mandatory, pass customSizeData, add quote badges"
```

---

### Task 17: Update admin page — document buttons + custom size display

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx`

This is the most complex UI change. Add document action links in the collapsed order card header, and custom size display in the expanded detail.

- [ ] **Step 1: Add dnDocumentName to Order interface**

In the `Order` interface (around line 36), add after `poDocumentName`:

```typescript
  dnDocumentName: string | null;
```

- [ ] **Step 2: Add document action buttons in collapsed card header**

In the order card, find the section that has the DN and PO links (around lines 519-542). Replace that entire block (from `<span className="flex-1" />` through the closing PO link) with:

```tsx
                    <span className="flex-1" />
                    {/* Document action links */}
                    <a
                      href={`/api/orders/${order.orderNumber}/quote`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-persimmon-green transition"
                      title="Download Quote PDF"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Quote
                    </a>
                    <a
                      href={`/api/orders/${order.orderNumber}/order-list`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-persimmon-green transition"
                      title="Download Order List PDF"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      List
                    </a>
                    <a
                      href={`/api/orders/${order.orderNumber}/delivery-note`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-persimmon-green transition"
                      title="Download Delivery Note PDF"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      DN
                    </a>
                    {order.dnDocumentName ? (
                      <a
                        href={`/api/orders/${order.orderNumber}/download-dn`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 transition"
                        title="Download signed DN"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Signed DN
                      </a>
                    ) : (
                      <a
                        href={`/dn-upload/${order.orderNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-600 transition"
                        title="Upload signed DN"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload DN
                      </a>
                    )}
                    {order.poDocumentName ? (
                      <a
                        href={`/api/orders/${order.orderNumber}/download-po`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-persimmon-green transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PO
                      </a>
                    ) : (
                      <a
                        href={`/po-upload/${order.orderNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-600 transition"
                        title="Upload PO"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload PO
                      </a>
                    )}
```

- [ ] **Step 3: Add custom size display in expanded order detail**

In the expanded order detail items table, in the standard item rendering section (around lines 705-733), after the custom fields display (lines 721-729), add custom size data display:

```tsx
                                    {item.customData?.matchedSize && (
                                      <p className="text-xs text-gray-500">
                                        {item.customData.width && item.customData.height
                                          ? `${item.customData.width} x ${item.customData.height}mm · `
                                          : ""}
                                        Priced as {item.customData.matchedSize}
                                      </p>
                                    )}
                                    {item.customData?.requiresQuote && (
                                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full">
                                        Requires quote
                                      </span>
                                    )}
```

- [ ] **Step 4: Update the expanded detail download links section**

In the expanded order detail, update the download links section (around lines 644-656) to include all document types. Replace:

```tsx
                      {/* Download links */}
                      <div className="flex gap-3">
                        <a
                          href={`/api/orders/${order.orderNumber}/delivery-note`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-persimmon-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Delivery Note
                        </a>
                      </div>
```

With:

```tsx
                      {/* Download links */}
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/api/orders/${order.orderNumber}/quote`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-persimmon-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Quote
                        </a>
                        <a href={`/api/orders/${order.orderNumber}/order-list`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-persimmon-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          Order List
                        </a>
                        <a href={`/api/orders/${order.orderNumber}/delivery-note`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-persimmon-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Delivery Note
                        </a>
                        {order.dnDocumentName && (
                          <a href={`/api/orders/${order.orderNumber}/download-dn`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition" onClick={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {order.dnDocumentName}
                          </a>
                        )}
                      </div>
```

- [ ] **Step 5: Commit**

```bash
git add shop/app/\(shop\)/admin/page.tsx
git commit -m "feat: add document action buttons and custom size display to admin"
```

---

### Task 18: Build verification

- [ ] **Step 1: Run next build**

```bash
cd shop && npm run build
```

Expected: Build completes successfully with no errors. Warnings about image optimization or other non-critical items are fine.

- [ ] **Step 2: Fix any build errors**

If build fails, read the error output carefully and fix each issue. Common issues:
- Import paths: ensure all new files use `@/` imports correctly
- Type mismatches: check that interfaces match between files
- Missing exports: verify `generateQuotePdf` and `generateOrderListPdf` are exported

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from feature sync #3"
```
