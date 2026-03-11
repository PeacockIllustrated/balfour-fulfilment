import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-persimmon-green/10 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-persimmon-green"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <p className="text-6xl font-bold text-persimmon-navy mb-2">404</p>
        <h1 className="text-xl font-semibold text-persimmon-navy mb-3">
          Page not found
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Head back to the catalogue to find what you need.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-persimmon-green text-white px-6 py-2.5 rounded-xl font-medium hover:bg-persimmon-green-dark transition active:scale-[0.98]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Browse Signage
          </Link>
          <Link
            href="/custom-sign"
            className="inline-flex items-center gap-2 text-persimmon-green border border-persimmon-green px-6 py-2.5 rounded-xl font-medium hover:bg-persimmon-green/5 transition"
          >
            Request Custom Sign
          </Link>
        </div>

        <p className="text-[11px] text-gray-300 mt-12">
          Balfour Beatty Signage Portal
        </p>
      </div>
    </div>
  );
}
