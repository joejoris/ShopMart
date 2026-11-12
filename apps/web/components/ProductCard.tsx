"use client";
import Link from "next/link";
import Image from "next/image";
import { Product, formatPrice } from "@/lib/api";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0];
  const onSale = product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents;
  return (
    <Link href={`/products/${product.slug}`} className="card group overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {image ? (
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No image</div>
        )}
        {onSale && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">Sale</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{product.category?.name}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold text-gray-900">{product.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">{formatPrice(product.priceCents)}</span>
          {onSale && <span className="text-sm text-gray-400 line-through">{formatPrice(product.compareAtPriceCents!)}</span>}
        </div>
      </div>
    </Link>
  );
}
