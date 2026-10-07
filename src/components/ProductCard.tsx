import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { gbp, ghs } from "@/lib/money";
import { gbpToGhsMinor, type FxConfig } from "@/lib/pricing";
import ProductArt from "./ProductArt";

export default function ProductCard({ product, fx }: { product: Product; fx: FxConfig }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group box box-shadow flex h-full flex-col transition-transform hover:-translate-y-0.5"
    >
      <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="label">{product.shopName}</p>
        <h3 className="!text-lg !leading-tight group-hover:underline">{product.name}</h3>
        <div className="mt-auto pt-3">
          <p className="num display text-2xl">{ghs(gbpToGhsMinor(product.priceMinor, fx))}</p>
          <p className="label num">{gbp(product.priceMinor)} in the UK shop</p>
        </div>
      </div>
    </Link>
  );
}
