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
  poLine: { fontSize: 10, color: C.grey, marginBottom: 14 },
  poBold: { fontFamily: "Helvetica-Bold" },
  tableHeader: { flexDirection: "row", backgroundColor: C.lightGrey, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.divider },
  tableHeaderText: { fontSize: 8, color: C.grey, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.divider, alignItems: "center" },
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

          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}><Text style={s.tableHeaderText}>Product</Text></View>
            <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text></View>
            <View style={s.colPrice}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Price</Text></View>
            <View style={s.colTotal}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Total</Text></View>
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
                <View style={s.colPrice}><Text style={s.priceText}>{"\u00A3"}{item.price.toFixed(2)}</Text></View>
                <View style={s.colTotal}><Text style={s.totalText}>{"\u00A3"}{item.line_total.toFixed(2)}</Text></View>
              </View>
            );
          })}

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
