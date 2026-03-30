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
