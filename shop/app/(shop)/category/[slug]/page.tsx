import Link from "next/link";
import { getCategoryBySlug, getCategories } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Categories
        </Link>
        <h1 className="text-2xl font-bold text-persimmon-navy">{category.name}</h1>
        <p className="text-gray-400 mt-1 text-sm">{category.description}</p>
        <p className="text-xs text-gray-300 mt-1">{category.products.length} products</p>
      </div>

      {slug === "custom-signs" && (
        <Link
          href="/custom-sign"
          className="block bg-gradient-to-r from-persimmon-navy to-persimmon-navy-light rounded-2xl p-6 mb-6 text-white hover:shadow-lg transition group"
        >
          <h3 className="text-lg font-bold">Need a completely custom sign?</h3>
          <p className="text-sm text-white/70 mt-1">Design your own sign with our custom sign builder and get a quote.</p>
          <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-persimmon-green-light group-hover:gap-2 transition-all">
            Start designing
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {category.products.map((product) => (
          <ProductCard key={product.baseCode} product={product} />
        ))}
      </div>
    </div>
  );
}
