import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

type Tone = "neutral" | "amber" | "red" | "emerald" | "blue";

const TONES: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: "bg-[#f5f5f7] text-[#1d1d1f]", value: "text-[#1d1d1f]" },
  amber: { icon: "bg-amber-100 text-amber-700", value: "text-amber-700" },
  red: { icon: "bg-red-100 text-red-600", value: "text-red-600" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  blue: { icon: "bg-blue-100 text-blue-700", value: "text-[#1d1d1f]" },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  to?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", to }: StatCardProps) {
  const colors = TONES[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        {to && (
          <ChevronRight className="h-4 w-4 text-[#c7c7cc] transition group-hover:translate-x-0.5 group-hover:text-[#1d1d1f]" />
        )}
      </div>
      <p className={`mt-3 font-display text-2xl font-bold tracking-tight tabular-nums sm:text-[28px] ${colors.value}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-[#1d1d1f]">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-[#86868b]">{hint}</p>}
    </>
  );

  const className =
    "group block rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs transition sm:p-5";
  if (to) {
    return (
      <Link to={to} className={`${className} hover:border-neutral-400 hover:shadow-xs active:scale-[0.99]`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4 sm:p-5">
      <div className="h-9 w-9 animate-pulse rounded-xl bg-[#f5f5f7]" />
      <div className="mt-3 h-7 w-16 animate-pulse rounded-lg bg-[#f5f5f7]" />
      <div className="mt-2 h-3 w-24 animate-pulse rounded bg-[#f5f5f7]" />
    </div>
  );
}
