"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBasket } from "@/components/BasketContext";
import SignPreview, {
  generateSignPreviewDataUri,
  SIGN_TYPES,
  SIZE_DIMENSIONS,
} from "@/components/SignPreview";

const MATERIALS = [
  "4mm Correx",
  "10mm Correx",
  "5mm Foamex",
  "Zintec",
  "Dibond",
  "Self-Adhesive Vinyl",
];

const SHAPES = [
  {
    value: "rectangle",
    label: "Rectangle",
    icon: (
      <svg viewBox="0 0 32 24" className="w-8 h-6">
        <rect
          x="2"
          y="2"
          width="28"
          height="20"
          rx="3"
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    value: "square",
    label: "Square",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="3"
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    value: "circle",
    label: "Circle",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    value: "triangle",
    label: "Triangle",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <polygon
          points="12,2 22,22 2,22"
          fill="currentColor"
          opacity={0.15}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function CustomSignPage() {
  const { addItem } = useBasket();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({
    signType: "warning",
    textContent: "",
    shape: "rectangle",
    size: "M",
    material: "4mm Correx",
    additionalNotes: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddToBasket = () => {
    const sizeInfo = SIZE_DIMENSIONS[form.size];
    const typeInfo = SIGN_TYPES[form.signType];
    const code = `CUSTOM-${Date.now()}`;

    addItem({
      code,
      baseCode: "CUSTOM",
      name: `Custom ${typeInfo?.label || "Sign"} Sign`,
      size: sizeInfo?.label || null,
      material: form.material,
      description: `${typeInfo?.label || "Custom"} sign — ${form.shape} — ${sizeInfo?.label || ""} — ${form.material}. Text: "${form.textContent}"`,
      price: 0,
      image: generateSignPreviewDataUri(
        form.signType,
        form.textContent,
        form.shape,
      ),
      customSign: {
        signType: form.signType,
        textContent: form.textContent,
        shape: form.shape,
        additionalNotes: form.additionalNotes,
      },
    }, quantity);

    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-persimmon-green transition">
          All Categories
        </Link>
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <Link
          href="/category/custom-signs"
          className="hover:text-persimmon-green transition"
        >
          Custom Signs
        </Link>
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-persimmon-navy font-medium">
          Request Custom Sign
        </span>
      </div>

      <h1 className="text-2xl font-bold text-persimmon-navy mb-2">
        Request a Custom Sign
      </h1>
      <p className="text-gray-400 text-sm mb-8">
        Tell us what you need and we&apos;ll produce it to your specification.
        Pricing will be confirmed after review.
      </p>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Form - 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sign Type & Shape */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">
              Sign Specification
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Sign Type *
                </label>
                <select
                  value={form.signType}
                  onChange={(e) => updateField("signType", e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(SIGN_TYPES).map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Shape *
                </label>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {SHAPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateField("shape", s.value)}
                      className={`flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 transition text-xs sm:text-sm font-medium ${
                        form.shape === s.value
                          ? "border-persimmon-green bg-persimmon-green/5 text-persimmon-green"
                          : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
                      }`}
                    >
                      {s.icon}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Sign Text *
                </label>
                <textarea
                  value={form.textContent}
                  onChange={(e) => updateField("textContent", e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Enter the text you want displayed on your sign..."
                />
              </div>
            </div>
          </div>

          {/* Size & Material */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">
              Size & Material
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Size *
                </label>
                <select
                  value={form.size}
                  onChange={(e) => updateField("size", e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(SIZE_DIMENSIONS).map(([key, d]) => (
                    <option key={key} value={key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Material *
                </label>
                <select
                  value={form.material}
                  onChange={(e) => updateField("material", e.target.value)}
                  className={inputClass}
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Quantity *
              </label>
              <div className="inline-flex items-center border border-gray-200 rounded-xl bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-persimmon-green transition text-lg font-medium"
                >
                  &minus;
                </button>
                <span className="w-12 text-center text-sm font-semibold text-persimmon-navy tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-persimmon-green transition text-lg font-medium"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">
              Additional Notes
            </h2>
            <textarea
              value={form.additionalNotes}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Any extra requirements, colour preferences, or design notes..."
            />
          </div>

        </div>

        {/* Preview - 2 cols on desktop, full width on mobile */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">
              Preview
            </h2>

            <div className="flex justify-center py-4 bg-gray-50 rounded-xl mb-5 max-h-[280px] sm:max-h-[360px] lg:max-h-none overflow-hidden">
              <SignPreview
                signType={form.signType}
                textContent={form.textContent}
                shape={form.shape}
                size={form.size}
              />
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span>
                <span className="font-medium text-gray-700">
                  {SIGN_TYPES[form.signType]?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Shape</span>
                <span className="font-medium text-gray-700 capitalize">
                  {form.shape}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Size</span>
                <span className="font-medium text-gray-700">
                  {SIZE_DIMENSIONS[form.size]?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Material</span>
                <span className="font-medium text-gray-700">
                  {form.material}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity</span>
                <span className="font-medium text-gray-700">
                  {quantity}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-400">Price</span>
                <span className="font-semibold text-amber-600">
                  Quote on request
                </span>
              </div>
            </div>

            {/* Add to basket */}
            <button
              type="button"
              onClick={handleAddToBasket}
              disabled={!form.textContent.trim() || added}
              className="w-full bg-persimmon-green text-white py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {added ? "✓ Added to Basket" : "Add to Basket — Quote on Request"}
            </button>

            {added && (
              <div className="mt-3 flex gap-2">
                <Link
                  href="/basket"
                  className="flex-1 text-center text-sm font-medium text-persimmon-green border border-persimmon-green rounded-xl py-2 hover:bg-persimmon-green/5 transition"
                >
                  View Basket
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    setQuantity(1);
                    setForm((prev) => ({ ...prev, textContent: "", additionalNotes: "" }));
                  }}
                  className="flex-1 text-center text-sm font-medium text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition"
                >
                  Add Another
                </button>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
              Preview is indicative only — the final sign will be professionally
              designed and produced to order.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
