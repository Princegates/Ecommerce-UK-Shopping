import PhotoImg from "./PhotoImg";

/** A shop's logo in a small square, or its first letter on the shop's colour when it has no logo (or the logo will not load). */
export default function ShopLogo({
  shop, className = "h-14 w-14", round = false,
}: { shop: { name: string; accent: string; logoUrl: string }; className?: string; round?: boolean }) {
  const shape = round ? "rounded-full" : "rounded-lg";
  const letter = (
    <span className={`grid ${className} shrink-0 place-items-center ${shape} font-bold text-white`} style={{ background: shop.accent }} aria-hidden="true">
      {shop.name.slice(0, 1)}
    </span>
  );
  if (!shop.logoUrl) return letter;
  return (
    <span className={`grid ${className} shrink-0 place-items-center overflow-hidden ${shape} border border-line bg-white p-1`}>
      <PhotoImg src={shop.logoUrl} alt={`${shop.name} logo`} className="max-h-full max-w-full object-contain" fallback={<span className="font-bold" style={{ color: shop.accent }}>{shop.name.slice(0, 1)}</span>} />
    </span>
  );
}
