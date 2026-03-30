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
