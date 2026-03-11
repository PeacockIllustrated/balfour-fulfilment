"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/BasketContext";
import Link from "next/link";

export default function CheckoutPage() {
  const { items, totalPrice, clearBasket } = useBasket();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contactName: "",
    email: "",
    phone: "",
    siteName: "",
    siteAddress: "",
    poNumber: "",
    notes: "",
  });

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-persimmon-navy mb-2">Nothing to checkout</h1>
        <p className="text-gray-400 mb-8">Add some items to your basket first.</p>
        <Link href="/" className="inline-block bg-persimmon-green text-white px-8 py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition">
          Browse Products
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((item) => ({
            code: item.code,
            baseCode: item.baseCode,
            name: item.name,
            size: item.size,
            material: item.material,
            description: item.description,
            price: item.price,
            quantity: item.quantity,
            ...(item.customSign ? { customSign: item.customSign } : {}),
            ...(item.customFieldValues ? { customFieldValues: item.customFieldValues } : {}),
          })),
          subtotal: totalPrice,
          vat: totalPrice * 0.2,
          total: totalPrice * 1.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        clearBasket();
        router.push(`/order-confirmation?order=${data.orderNumber}`);
      } else {
        alert("Failed to submit order. Please try again.");
      }
    } catch {
      alert("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/basket" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to basket
      </Link>
      <h1 className="text-2xl font-bold text-persimmon-navy mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Contact Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Contact Name *</label>
                <input required type="text" value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Phone *</label>
                <input required type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">PO Number</label>
                <input type="text" value={form.poNumber} onChange={(e) => updateField("poNumber", e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Site Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Site Name *</label>
                <input required type="text" value={form.siteName} onChange={(e) => updateField("siteName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Site Address *</label>
                <textarea required value={form.siteAddress} onChange={(e) => updateField("siteAddress", e.target.value)} rows={2} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Special Instructions</label>
                <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} className={inputClass} placeholder="Any special requirements or notes..." />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
            <h2 className="text-base font-semibold text-persimmon-navy mb-4">Order Summary</h2>

            <div className="space-y-2.5 mb-4 max-h-60 overflow-y-auto">
              {items.map((item) => (
                <div key={item.code} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 truncate mr-2">
                      {item.customSign ? "Custom Sign" : item.code} x{item.quantity}
                    </span>
                    {item.customSign ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
                      <span className="font-medium text-gray-700 shrink-0">
                        {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.customFieldValues && item.customFieldValues.length > 0 && (
                    <div className="ml-1 mt-0.5">
                      {item.customFieldValues.map((f) => (
                        <p key={f.key} className="text-[11px] text-persimmon-green truncate">
                          {f.label}: <span className="text-gray-400">{f.value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>{"\u00A3"}{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>VAT (20%)</span>
                <span>{"\u00A3"}{(totalPrice * 0.2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-persimmon-navy pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{"\u00A3"}{(totalPrice * 1.2).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 bg-persimmon-green text-white py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {submitting ? "Submitting Order..." : "Submit Order"}
            </button>

            <p className="text-[11px] text-gray-400 mt-3 text-center leading-relaxed">
              All prices exclude VAT. You will receive a confirmation email.
            </p>
            {items.some((i) => i.customSign) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Custom sign items will be quoted separately after review.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
