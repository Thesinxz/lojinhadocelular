export default function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white p-3 sm:p-4 shadow-[0_2px_14px_rgba(0,0,0,0.04)]"
    >
      <div className="aspect-[4/5] sm:aspect-square w-full animate-pulse rounded-2xl bg-neutral-100" />
      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-12 animate-pulse rounded bg-neutral-100" />
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
          </div>
        </div>
        <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-neutral-100" />
        <div className="mt-1.5 h-4 w-3/5 animate-pulse rounded bg-neutral-100" />
        <div className="mt-auto pt-4">
          <div className="h-6 w-28 animate-pulse rounded bg-neutral-100" />
          <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-neutral-100" />
          <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-neutral-100" />
          <div className="mt-3 flex items-center gap-1.5">
            <div className="h-10 flex-1 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
