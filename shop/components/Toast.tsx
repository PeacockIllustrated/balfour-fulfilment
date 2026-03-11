"use client";

import { useBasket } from "./BasketContext";

export default function Toast() {
  const { toast } = useBasket();

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
      style={{ animation: "toast-in 0.3s ease-out" }}
    >
      <div className="bg-persimmon-navy text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto">
        <div className="w-6 h-6 bg-persimmon-green rounded-full flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm font-medium">{toast}</span>
      </div>
    </div>
  );
}
