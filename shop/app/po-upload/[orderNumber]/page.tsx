import { notFound } from "next/navigation";
import { generateRaisePoToken } from "@/lib/email";
import PoUploadForm from "./PoUploadForm";

export default async function PoUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t: token } = await searchParams;

  // Validate token server-side
  const expected = generateRaisePoToken(orderNumber);
  if (!token || token !== expected) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#002b49] rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#002b49]">Upload Purchase Order</h1>
          <p className="text-gray-500 text-sm mt-1">
            Order <strong>{orderNumber}</strong>
          </p>
        </div>

        <PoUploadForm orderNumber={orderNumber} token={token} />
      </div>
    </div>
  );
}
