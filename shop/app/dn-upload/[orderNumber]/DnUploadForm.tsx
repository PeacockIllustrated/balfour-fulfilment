"use client";

import { useState, useRef } from "react";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 5 * 1024 * 1024;

export default function DnUploadForm({ orderNumber }: { orderNumber: string }) {
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
      const res = await fetch(`/api/orders/${orderNumber}/upload-dn`, { method: "POST", body: formData });
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
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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
