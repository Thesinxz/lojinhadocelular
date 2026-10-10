import { useState } from "react";
import { KeyRound, LogOut, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import type { RouterOutputs } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import { ADMIN_ROLES, DELEGABLE_CAPABILITIES, STORE_UNITS } from "@contracts/permissions";
import type { AdminRole, Capability, StoreUnit } from "@contracts/permissions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AdminUserRow = RouterOutputs["admin"]["users"]["list"][number];

const inputClass =
  "h-11 w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#1d1d1f] focus:bg-white disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#6e6e73]";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-5 text-sm font-semibold text-white transition hover:bg-black active:scale-[0.98] disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-50";

function roleLabel(role: AdminRole) {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
}

function unitLabel(unit: StoreUnit | null) {
  return STORE_UNITS.find((u) => u.value === unit)?.label ?? "Todas";
}

function formatLastLogin(value: Date | string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface UserFormState {
  username: string;
  name: string;
  password: string;
  role: AdminRole;
  unit: StoreUnit | "";
  canEditPrices: boolean;
  extraCaps: Capability[];
}

const EMPTY_FORM: UserFormState = {
  username: "",
  name: "",
  password: "",
  role: "vendedor",
  unit: "",
  canEditPrices: false,
  extraCaps: [],
};

function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex min-h-11 items-start gap-3 rounded-xl border border-[#e5e5e7] bg-white p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#1d1d1f]"
      />
      <span>
        <span className="block text-sm font-semibold text-[#1d1d1f]">{label}</span>
        {hint && <span className="block text-xs text-[#86868b]">{hint}</span>}
      </span>
    </label>
  );
}

function UserDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminUserRow | null;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<UserFormState>(() =>
    editing
      ? {
          username: editing.username,
          name: editing.name,
          password: "",
          role: editing.role,
          unit: editing.unit ?? "",
          canEditPrices: editing.canEditPrices,
          extraCaps: editing.extraCaps ?? [],
        }
      : EMPTY_FORM,
  );

  const onDone = (message: string) => {
    toast.success(message);
    utils.admin.users.list.invalidate();
    onOpenChange(false);
  };

  const create = trpc.admin.users.create.useMutation({
    onSuccess: (u) => onDone(`Usuário ${u.name} criado.`),
    onError: (err) => toast.error(err.message),
  });
  const update = trpc.admin.users.update.useMutation({
    onSuccess: (u) => onDone(`Usuário ${u.name} atualizado.`),
    onError: (err) => toast.error(err.message),
  });

  const pending = create.isPending || update.isPending;
  const set = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Informe o nome.");
      return;
    }
    const unit = form.unit === "" ? null : form.unit;
    const canEditPrices = form.role === "vendedor" ? form.canEditPrices : false;
    const extraCaps = (form.role === "vendedor" ? form.extraCaps : []) as ("evaluations.assign" | "reports.team" | "products.manage")[];
    if (editing) {
      update.mutate({ id: editing.id, name, role: form.role, unit, canEditPrices, extraCaps });
      return;
    }
    const username = form.username.trim().toLowerCase();
    if (!username) {
      toast.error("Informe o usuário de acesso.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    create.mutate({ username, name, password: form.password, role: form.role, unit, canEditPrices, extraCaps });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-[#e5e5e7] bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription className="text-xs text-[#86868b]">
            {editing ? `@${editing.username}` : "Cada pessoa da equipe tem seu próprio acesso."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className={labelClass}>Nome</span>
            <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Maria Souza" />
          </label>
          {!editing && (
            <>
              <label className="block">
                <span className={labelClass}>Usuário de acesso</span>
                <input
                  className={inputClass}
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  placeholder="Ex.: maria"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Senha inicial</span>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </label>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Nível</span>
              <select className={inputClass} value={form.role} onChange={(e) => set("role", e.target.value as AdminRole)}>
                {ADMIN_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Unidade</span>
              <select className={inputClass} value={form.unit} onChange={(e) => set("unit", e.target.value as StoreUnit | "")}>
                <option value="">Todas</option>
                {STORE_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {form.role === "vendedor" ? (
            <div className="space-y-2">
              <CheckboxRow
                checked={form.canEditPrices}
                onChange={(v) => set("canEditPrices", v)}
                label="Pode editar preços"
                hint="Permite alterar o preço à vista dos produtos."
              />
              {DELEGABLE_CAPABILITIES.map((cap) => (
                <CheckboxRow
                  key={cap.value}
                  checked={form.extraCaps.includes(cap.value)}
                  onChange={(v) =>
                    set("extraCaps", v ? [...form.extraCaps, cap.value] : form.extraCaps.filter((c) => c !== cap.value))
                  }
                  label={cap.label}
                  hint={cap.hint}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-xs text-[#6e6e73]">O dono tem acesso completo ao painel.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryButton} onClick={() => onOpenChange(false)}>
              Cancelar
            </button>
            <button type="submit" className={primaryButton} disabled={pending}>
              {pending ? "Salvando..." : editing ? "Salvar" : "Criar usuário"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: AdminUserRow | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = trpc.admin.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(`Senha de ${target?.name} redefinida.`);
      setPassword("");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    reset.mutate({ id: target.id, password });
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl border-[#e5e5e7] bg-white sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Redefinir senha</DialogTitle>
          <DialogDescription className="text-xs text-[#86868b]">
            Nova senha para {target?.name}. Combine com a pessoa e peça para trocar em “Minha conta”.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={primaryButton} disabled={reset.isPending || !password}>
              {reset.isPending ? "Salvando..." : "Redefinir"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAdminSession();
  const utils = trpc.useUtils();
  const users = trpc.admin.users.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);

  const toggleActive = trpc.admin.users.update.useMutation({
    onSuccess: (u) => {
      toast.success(u.active ? `${u.name} foi reativado.` : `${u.name} foi desativado.`);
      utils.admin.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeSessions = trpc.admin.users.revokeSessions.useMutation({
    onSuccess: () => toast.success("Sessões encerradas. A pessoa precisa entrar de novo."),
    onError: (err) => toast.error(err.message),
  });

  function openDialog(target: AdminUserRow | null) {
    setEditing(target);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function renderActions(u: AdminUserRow) {
    const isSelf = u.id === me?.id;
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} onClick={() => openDialog(u)} title="Editar">
          <Pencil className="h-4 w-4" />
          <span className="lg:sr-only">Editar</span>
        </button>
        <button type="button" className={secondaryButton} onClick={() => setResetTarget(u)} title="Redefinir senha">
          <KeyRound className="h-4 w-4" />
          <span className="lg:sr-only">Senha</span>
        </button>
        {!isSelf && (
          <button
            type="button"
            className={secondaryButton}
            disabled={revokeSessions.isPending}
            onClick={() => {
              if (window.confirm(`Encerrar todas as sessões de ${u.name}? A pessoa precisará entrar novamente.`)) {
                revokeSessions.mutate({ id: u.id });
              }
            }}
            title="Encerrar sessões"
          >
            <LogOut className="h-4 w-4" />
            <span className="lg:sr-only">Encerrar sessões</span>
          </button>
        )}
        {!isSelf && (
          <button
            type="button"
            className={`${secondaryButton} ${u.active ? "hover:border-red-200 hover:bg-red-50 hover:text-red-600" : ""}`}
            disabled={toggleActive.isPending}
            onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
            title={u.active ? "Desativar" : "Reativar"}
          >
            {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            <span className="lg:sr-only">{u.active ? "Desativar" : "Reativar"}</span>
          </button>
        )}
      </div>
    );
  }

  const list = users.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#86868b]">Contas de acesso da equipe e o que cada uma pode fazer.</p>
        <button type="button" className={primaryButton} onClick={() => openDialog(null)}>
          <Plus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      {users.isLoading && <div className="h-40 animate-pulse rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]" />}

      {users.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">Não foi possível carregar os usuários.</p>
          <button type="button" className={`${secondaryButton} mt-3`} onClick={() => users.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {list.length > 0 && (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#e5e5e7] bg-white shadow-2xs lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e5e5e7] bg-[#fbfbfd] text-xs font-semibold text-[#86868b]">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Editar preços</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e7]">
                {list.map((u) => (
                  <tr key={u.id} className={u.active ? "" : "bg-[#fbfbfd] text-[#86868b]"}>
                    <td className="px-4 py-3 font-semibold text-[#1d1d1f]">
                      {u.name}
                      {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-[#86868b]">(você)</span>}
                    </td>
                    <td className="px-4 py-3">@{u.username}</td>
                    <td className="px-4 py-3">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">{unitLabel(u.unit)}</td>
                    <td className="px-4 py-3">{u.role === "dono" ? "Sim" : u.canEditPrices ? "Sim" : "Não"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          u.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {u.active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatLastLogin(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões (celular) */}
          <div className="space-y-3 lg:hidden">
            {list.map((u) => (
              <div
                key={u.id}
                className={`rounded-2xl border p-4 shadow-2xs ${
                  u.active ? "border-[#e5e5e7] bg-white" : "border-dashed border-neutral-300 bg-[#fbfbfd]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold text-[#1d1d1f]">
                      {u.name}
                      {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-[#86868b]">(você)</span>}
                    </p>
                    <p className="text-xs text-[#86868b]">@{u.username}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      u.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {u.active ? "Ativo" : "Desativado"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#86868b]">Nível</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{roleLabel(u.role)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#86868b]">Unidade</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{unitLabel(u.unit)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#86868b]">Editar preços</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{u.role === "dono" || u.canEditPrices ? "Sim" : "Não"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#86868b]">Último acesso</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{formatLastLogin(u.lastLoginAt)}</dd>
                  </div>
                </dl>
                <div className="mt-3">{renderActions(u)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <UserDialog key={dialogKey} open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}
