import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { trpc, type ProductWithVariants } from "@/providers/trpc";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";
import { selectRelatedProducts } from "@/lib/productDetail";
import { useShopSettings } from "@/lib/shop";
import ProductCard from "@/components/ProductCard";

export type RelatedProductsProps = {
  currentProduct: ProductWithVariants;
  isDemo?: boolean;
};

/** Lista até 4 aparelhos relacionados disponíveis usando preferencialmente o cache já aquecido da vitrine. */
export default function RelatedProducts({
  currentProduct,
  isDemo = false,
}: RelatedProductsProps) {
  const s = useShopSettings();
  const catalogQuery = trpc.shop.products.useQuery(undefined, {
    enabled: !isDemo,
    staleTime: 1000 * 60,
  });

  const sourceList = isDemo
    ? (DEMO_PRODUCTS as unknown as ProductWithVariants[])
    : (catalogQuery.data ?? []);

  const related = selectRelatedProducts(sourceList, currentProduct, 4);
  if (related.length === 0) return null;

  return (
    <section
      aria-labelledby="related-products-heading"
      className="mt-14 border-t border-neutral-200/80 pt-10"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2
            id="related-products-heading"
            className="font-display text-lg sm:text-2xl font-extrabold text-neutral-950"
          >
            Quem viu também gostou
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Outras opções disponíveis à pronta entrega nas lojas
          </p>
        </div>
        <Link
          to="/#vitrine"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition"
        >
          <span>Ver vitrine</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
        {related.map((item) => (
          <div
            key={item.id}
            className="w-[62vw] max-w-[250px] shrink-0 snap-start sm:w-[42vw] md:w-auto md:max-w-none"
          >
            <ProductCard
              product={item}
              installmentsMax={s.installmentsMax}
              fees={s.fees}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
