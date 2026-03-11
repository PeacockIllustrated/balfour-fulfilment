import Link from "next/link";
import { getCategories, searchProducts } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const query = params.search || "";
  const categories = getCategories();

  if (query) {
    const results = searchProducts(query);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Categories
          </Link>
          <h1 className="text-2xl font-bold text-persimmon-navy">
            Search results for &ldquo;{query}&rdquo;
          </h1>
          <p className="text-gray-400 text-sm mt-1">{results.length} products found</p>
        </div>
        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map(({ product }) => (
              <ProductCard key={product.baseCode} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No products found matching your search.</p>
            <p className="text-gray-400 text-sm mt-1">Try a different term or browse categories.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-persimmon-navy tracking-tight">Construction Signage</h1>
        <p className="text-gray-500 mt-2 text-base">Browse our full range of construction site signage. Select a category below.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.filter((c) => c.slug !== "for-admin-review").map((category) => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            className="group relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-persimmon-navy group-hover:text-persimmon-green transition-colors duration-200">
                {category.name}
              </h2>
              <span className="bg-persimmon-green/8 text-persimmon-green text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3">
                {category.productCount}
              </span>
            </div>
            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{category.description}</p>
            <div className="mt-4 text-persimmon-green text-sm font-medium flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-0 group-hover:translate-x-1">
              Browse products
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
