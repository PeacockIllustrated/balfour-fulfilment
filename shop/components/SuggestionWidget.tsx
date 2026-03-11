"use client";

import { useState } from "react";

export default function SuggestionWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() && message.trim().length >= 5 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setName("");
        setMessage("");
      }, 2000);
    } catch {
      setError("Failed to submit. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {/* Expanded form */}
      {open && (
        <div
          className="mb-3 bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 overflow-hidden"
          style={{ animation: "slide-up 0.2s ease-out" }}
        >
          {submitted ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-persimmon-green/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-persimmon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-persimmon-navy">Thanks for your suggestion!</p>
              <p className="text-sm text-gray-400 mt-1">We&apos;ll review it shortly.</p>
            </div>
          ) : (
            <>
              <div className="bg-persimmon-navy px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-persimmon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-white text-sm font-semibold">Suggest a Feature</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/60 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full mt-1 px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Your Suggestion
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What would make the portal better?"
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border border-gray-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green transition"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
                    canSubmit
                      ? "bg-persimmon-green text-white hover:bg-persimmon-green-dark"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {submitting ? "Sending..." : "Submit Suggestion"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-all ${
          open
            ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
            : "bg-persimmon-navy text-white hover:bg-persimmon-navy-light"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {open ? "Close" : "Suggest a Feature"}
      </button>
    </div>
  );
}
