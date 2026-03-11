"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order") || "N/A";

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-persimmon-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-persimmon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-persimmon-navy mb-2">Order Submitted</h1>
      <p className="text-gray-400 mb-8">
        Thank you for your order. Our team will review it and be in touch shortly.
      </p>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Order Reference</p>
        <p className="text-2xl font-bold text-persimmon-navy tracking-wide">{orderNumber}</p>
      </div>

      <p className="text-sm text-gray-400 mb-8">
        A confirmation email has been sent with your order details.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/orders"
          className="inline-block bg-persimmon-green text-white px-8 py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition"
        >
          View Your Orders
        </Link>
        <Link
          href="/"
          className="inline-block bg-white text-gray-500 border border-gray-200 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Loading...</div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
