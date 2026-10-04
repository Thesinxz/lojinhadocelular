import type { ComponentType, ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Caixa padrão das seções do dashboard. */
export function DashboardSection({ title, description, icon: Icon, action, children, className = "" }: DashboardSectionProps) {
  return (
    <section className={`rounded-2xl border border-[#e5e5e7] bg-white shadow-2xs ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-[#f0f0f2] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#86868b]" />}
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-[#1d1d1f]">{title}</h3>
            {description && <p className="mt-0.5 text-[11px] text-[#86868b]">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </section>
  );
}
