import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - Persimmon Signage Portal",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-gray-50 min-h-screen">{children}</div>;
}
