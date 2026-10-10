import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import { ADMIN_ROLES, STORE_UNITS } from "@contracts/permissions";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 text-[15px] text-[#1d1d1f] outline-none transition focus:border-[#1d1d1f] focus:bg-white";

export default function AccountPage() {
  const { user, logout } = useAdminSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = trpc.admin.changeOwnPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message || "Não foi possível alterar a senha."),
  });

  const endSessions = trpc.admin.endMySessions.useMutation({
    onSuccess: () => {
      toast.success("Você saiu de todos os dispositivos.");
      logout();
    },
    onError: (err) => toast.error(err.message || "Não foi possível encerrar as sessões."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  }

  const roleLabel = ADMIN_ROLES.find((r) => r.value === user?.role)?.label ?? "";
  const unitLabel = STORE_UNITS.find((u) => u.value === user?.unit)?.label ?? "Todas as unidades";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-2xs sm:p-6">
        <p className="font-display text-lg font-bold text-[#1d1d1f]">{user?.name}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-[#86868b]">Usuário</dt>
            <dd className="font-medium text-[#1d1d1f]">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#86868b]">Nível</dt>
            <dd className="font-medium text-[#1d1d1f]">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#86868b]">Unidade</dt>
            <dd className="font-medium text-[#1d1d1f]">{unitLabel}</dd>
          </div>
          {user?.role === "vendedor" && (
            <div>
              <dt className="text-xs font-semibold text-[#86868b]">Editar preços</dt>
              <dd className="font-medium text-[#1d1d1f]">{user.canEditPrices ? "Sim" : "Não"}</dd>
            </div>
          )}
        </dl>
      </section>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#1d1d1f]" />
          <h2 className="font-display text-base font-bold text-[#1d1d1f]">Alterar minha senha</h2>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Confirmar nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1d1d1f] font-display text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {changePassword.isPending ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>

      <button
        type="button"
        disabled={endSessions.isPending}
        onClick={() => {
          if (window.confirm("Sair deste e de todos os outros dispositivos onde você entrou no painel?")) {
            endSessions.mutate();
          }
        }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e7] bg-white text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" /> Sair de todos os dispositivos
      </button>

      <button
        type="button"
        onClick={logout}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e5e5e7] bg-white text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 lg:hidden"
      >
        <LogOut className="h-4 w-4" /> Sair do painel
      </button>
    </div>
  );
}
