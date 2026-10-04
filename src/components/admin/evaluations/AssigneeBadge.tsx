import { UserRound } from "lucide-react";
import { initials } from "./evaluationUi";

interface AssigneeBadgeProps {
  name: string | null | undefined;
  /** Destaca quando é o próprio usuário. */
  isMe?: boolean;
  size?: "sm" | "md";
}

/** Avatar com iniciais do responsável, ou "Sem responsável". */
export default function AssigneeBadge({ name, isMe = false, size = "sm" }: AssigneeBadgeProps) {
  const avatar = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#86868b]">
        <span className={`flex ${avatar} items-center justify-center rounded-full border border-dashed border-[#d2d2d7]`}>
          <UserRound className="h-3.5 w-3.5" />
        </span>
        Sem responsável
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f]">
      <span
        className={`flex ${avatar} items-center justify-center rounded-full font-bold ${
          isMe ? "bg-[#0071e3] text-white" : "bg-[#1d1d1f] text-white"
        }`}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {isMe ? `${name} (você)` : name}
    </span>
  );
}
