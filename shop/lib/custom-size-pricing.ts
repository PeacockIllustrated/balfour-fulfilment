import { type Variant, type Product, type Category } from "./catalog";

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

  const fitting = candidates.filter(
    (c) =>
      (c.w >= width && c.h >= height) ||
      (c.h >= width && c.w >= height)
  );

  if (fitting.length === 0) {
    return { ...base, matchedCode: null, matchedSize: null, matchedPrice: null, requiresQuote: true };
  }

  fitting.sort((a, b) => a.w * a.h - b.w * b.h);
  const best = fitting[0];

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

export function getAvailableMaterials(category: Category): string[] {
  const materials = new Set<string>();
  for (const p of category.products) {
    for (const v of p.variants) {
      if (v.material) materials.add(v.material);
    }
  }
  return Array.from(materials).sort();
}
