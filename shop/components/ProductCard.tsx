import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/catalog";

export default function ProductCard({ product }: { product: Product }) {
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const hasMultipleVariants = product.variants.length > 1;

  return (
    <Link
      href={`/product/${encodeURIComponent(product.baseCode)}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100/50 relative overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-200">
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {hasMultipleVariants && (
          <span className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-sm text-gray-600 text-[11px] font-medium px-2 py-0.5 rounded-full shadow-sm">
            {product.variants.length} sizes
          </span>
        )}
      </div>

      <div className="p-3.5">
        <p className="text-[11px] text-persimmon-green font-semibold tracking-wide uppercase mb-1">{product.baseCode}</p>
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2.5 group-hover:text-persimmon-navy transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between">
          <span className="text-persimmon-navy font-bold text-base">
            {hasMultipleVariants && <span className="text-xs font-normal text-gray-400 mr-0.5">from </span>}
            {"\u00A3"}{minPrice.toFixed(2)}
          </span>
          <span className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5">
            View
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
