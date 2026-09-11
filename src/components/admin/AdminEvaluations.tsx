import { useState, useMemo } from "react";
import {
  Smartphone,
  MessageCircle,
  Clock,
  Trash2,
  Search,
  Battery,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { detectIphoneModel, getIphoneModelColorImage } from "@/lib/iphoneCatalog";
import { safeStorage } from "@/lib/storage";
import { SETTING_KEYS } from "@contracts/types";
import {
  evaluateDevice,
  formatBRL,
  getGradeBadgeConfig,
  generateAdminWhatsAppResponse,
  parseValuationConfig,
} from "@/lib/valuationEngine";

type EvaluationStatus = "pendente" | "atendimento" | "concluido" | "recusado";

interface LocalEvaluation {
  id?: number;
  name: string;
  whatsapp: string;
  model: string;
  storage?: string;
  color?: string;
  purchaseLocation?: string;
  targetModel?: string;
  faceId?: string;
  screenOriginal?: string;
  batteryOriginal?: string;
  camerasOk?: string;
  audioOk?: string;
  chargingPortOk?: string;
  openedBefore?: string;
  hasBox?: string;
  visualCondition?: string;
  condition: string;
  battery: string;
  notes?: string;
  photosCount?: number;
  status?: EvaluationStatus;
  createdAt?: string | Date;
}

const STATUS_CONFIG: Record<
  EvaluationStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  pendente: {
    label: "Pendente",
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    border: "border-amber-500/20",
  },
  atendimento: {
    label: "Em Atendimento",
    bg: "bg-blue-500/10",
    text: "text-blue-700",
    border: "border-blue-500/20",
  },
  concluido: {
    label: "Concluído",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    border: "border-emerald-500/20",
  },
  recusado: {
    label: "Recusado",
    bg: "bg-neutral-500/10",
    text: "text-neutral-600",
    border: "border-neutral-500/20",
  },
};

function formatDate(val?: string | Date | null): string {
  if (!val) return "Recentemente";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "Recentemente";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "Recentemente";
  }
}

interface AdminEvaluationsProps {
  onOpenConfig?: () => void;
}

export default function AdminEvaluations({ onOpenConfig }: AdminEvaluationsProps = {}) {
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const settingsQuery = trpc.admin.getSettings.useQuery();
  const valuationConfig = useMemo(
    () => parseValuationConfig(settingsQuery.data?.[SETTING_KEYS.valuationConfig]),
    [settingsQuery.data]
  );

  const query = trpc.admin.evaluations.useQuery(undefined, {
    retry: 1,
  });

  const updateStatus = trpc.admin.updateEvaluationStatus.useMutation({
    onSuccess: () => utils.admin.evaluations.invalidate(),
  });

  const deleteMutation = trpc.admin.deleteEvaluation.useMutation({
    onSuccess: () => utils.admin.evaluations.invalidate(),
  });

  // Mescla banco com backup local caso nao haja conexao com MySQL
  const evaluationsList: LocalEvaluation[] = useMemo(() => {
    const dbList = (query.data ?? []) as LocalEvaluation[];
    if (dbList.length > 0) return dbList;

    try {
      const local = JSON.parse(
        safeStorage.getItem("lojinha_evaluations_history") || "[]"
      ) as LocalEvaluation[];
      return local.map((item, idx) => ({
        ...item,
        id: item.id || 9999 - idx,
        status: item.status || "pendente",
        createdAt: item.createdAt || new Date(),
      }));
    } catch {
      return [];
    }
  }, [query.data]);

  const counts = useMemo(() => {
    return {
      todos: evaluationsList.length,
      pendente: evaluationsList.filter((e) => (e.status || "pendente") === "pendente").length,
      atendimento: evaluationsList.filter((e) => e.status === "atendimento").length,
      concluido: evaluationsList.filter((e) => e.status === "concluido").length,
      recusado: evaluationsList.filter((e) => e.status === "recusado").length,
    };
  }, [evaluationsList]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return evaluationsList.filter((item) => {
      const currentStatus = item.status || "pendente";
      if (filterStatus !== "todos" && currentStatus !== filterStatus) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.whatsapp.includes(q) ||
        item.model.toLowerCase().includes(q) ||
        (item.color && item.color.toLowerCase().includes(q)) ||
        (item.storage && item.storage.toLowerCase().includes(q))
      );
    });
  }, [evaluationsList, filterStatus, search]);

  function handleStatusChange(id: number | undefined, nextStatus: EvaluationStatus) {
    if (!id) return;
    updateStatus.mutate({ id, status: nextStatus });
  }

  function handleDelete(id: number | undefined) {
    if (!id) return;
    if (window.confirm("Deseja realmente remover esta avaliação?")) {
      deleteMutation.mutate({ id });
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Banner de Status do Motor de Avaliação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 p-4 rounded-2xl border border-blue-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0071e3] text-white shadow-xs shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-[#1d1d1f] flex items-center gap-2">
              Motor de Avaliação Inteligente
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                Ativo
              </span>
            </h2>
            <p className="text-xs text-[#6e6e73]">
              Multiplicador: <strong>{Math.round((valuationConfig.globalMultiplier ?? 1) * 100)}%</strong> • Bônus Lojinha: <strong>+{valuationConfig.loyaltyBonusPercent}%</strong> • Caixa original: <strong>+{formatBRL(valuationConfig.boxBonusReais)}</strong>
            </p>
          </div>
        </div>
        {onOpenConfig && (
          <button
            onClick={onOpenConfig}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-neutral-50 px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] border border-[#e5e5e7] shadow-2xs transition active:scale-[0.98] cursor-pointer shrink-0"
          >
            ⚙️ Configurar Regras
          </button>
        )}
      </div>

      {/* Contadores e Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#86868b]">
            <span>Total Recebidas</span>
            <Smartphone className="h-4 w-4 text-[#1d1d1f]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[#1d1d1f]">
            {counts.todos}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
            <span>Pendentes</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-amber-700">
            {counts.pendente}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
            <span>Em Atendimento</span>
            <MessageCircle className="h-4 w-4 text-[#0071e3]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[#0071e3]">
            {counts.atendimento}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>Concluídas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-700">
            {counts.concluido}
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#f5f5f7] p-1 border border-[#e5e5e7]">
          <button
            onClick={() => setFilterStatus("todos")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "todos"
                ? "bg-white text-[#1d1d1f] shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Todas ({counts.todos})
          </button>
          <button
            onClick={() => setFilterStatus("pendente")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "pendente"
                ? "bg-white text-amber-700 shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Pendentes ({counts.pendente})
          </button>
          <button
            onClick={() => setFilterStatus("atendimento")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "atendimento"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Em Atendimento ({counts.atendimento})
          </button>
          <button
            onClick={() => setFilterStatus("concluido")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "concluido"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Concluídas ({counts.concluido})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, fone ou modelo..."
            className="h-10 w-full rounded-xl border border-[#e5e5e7] bg-white pl-9 pr-3 text-xs text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15 transition"
          />
        </div>
      </div>

      {/* Lista de Avaliações */}
      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#e5e5e7] bg-white p-12 text-center shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-[#86868b]">
            <Smartphone className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-[#1d1d1f]">
            Nenhuma avaliação encontrada
          </h3>
          <p className="mt-1 text-xs text-[#86868b]">
            Quando os clientes preencherem a página de avaliação (/avaliacao), as propostas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((item) => {
            const detected = detectIphoneModel(item.model);
            const thumbUrl = getIphoneModelColorImage(detected, item.color);
            const statusStyle =
              STATUS_CONFIG[(item.status as EvaluationStatus) || "pendente"];

            const batteryNum = item.battery
              ? parseInt(item.battery.replace(/\D/g, ""), 10)
              : undefined;
            const valuation = evaluateDevice(
              {
                model: item.model,
                storage: item.storage,
                color: item.color,
                purchaseLocation: item.purchaseLocation,
                batteryPercent: isNaN(batteryNum as number) ? undefined : batteryNum,
                targetModel: item.targetModel,
                visualCondition: item.visualCondition || item.condition,
                faceId: item.faceId,
                screenOriginal: item.screenOriginal,
                batteryOriginal: item.batteryOriginal,
                camerasOk: item.camerasOk,
                audioOk: item.audioOk,
                chargingPortOk: item.chargingPortOk,
                openedBefore: item.openedBefore,
                hasBox: item.hasBox,
                notes: item.notes,
              },
              valuationConfig
            );
            const gradeConfig = getGradeBadgeConfig(valuation.grade);
            const whatsAppLink = generateAdminWhatsAppResponse(
              item.name,
              item.whatsapp,
              valuation,
              item,
              valuationConfig.loyaltyBonusPercent ?? 5
            );

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-[#e5e5e7] bg-white p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Informações do Cliente e do Aparelho */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Foto / Miniatura do Aparelho */}
                    <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-xl bg-[#fbfbfd] p-1.5 border border-[#e5e5e7]">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.model}
                          className="h-full w-full object-contain drop-shadow-xs"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Smartphone className="h-8 w-8 text-[#86868b]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base sm:text-lg font-bold text-[#1d1d1f]">
                          {item.name}
                        </h3>
                        <span className="text-xs font-semibold text-[#86868b]">
                          {item.whatsapp}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          {statusStyle.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gradeConfig.badgeBg} ${gradeConfig.badgeText} ${gradeConfig.badgeBorder}`}
                          title={`Pontuação técnica de conservação: ${valuation.score}/100`}
                        >
                          <span>{gradeConfig.iconText}</span>
                          <span>{gradeConfig.label}</span>
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-[#1d1d1f]">
                          {item.model}
                        </span>
                        {item.storage && (
                          <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium text-[#1d1d1f]">
                            {item.storage}
                          </span>
                        )}
                        {item.color && (
                          <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium text-[#1d1d1f]">
                            Cor: {item.color}
                          </span>
                        )}
                        {item.targetModel && (
                          <span className="rounded-md bg-purple-50 border border-purple-200/60 px-2 py-0.5 font-semibold text-purple-800">
                            🎯 Quer trocar por: {item.targetModel}
                          </span>
                        )}
                        {item.purchaseLocation && (
                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                            🏬 Comprou em: {item.purchaseLocation}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6e6e73]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-2 py-0.5">
                          <Battery className="h-3.5 w-3.5 text-emerald-600" />
                          Bateria: <b>{item.battery}</b>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-2 py-0.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#0071e3]" />
                          Estado: <b>{item.visualCondition || item.condition}</b>
                        </span>
                        {item.photosCount !== undefined && item.photosCount > 0 && (
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                            📸 {item.photosCount} fotos anexadas
                          </span>
                        )}
                        <span className="text-[11px] text-[#86868b]">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      {/* Mini diagnóstico técnico */}
                      {(item.faceId || item.screenOriginal || item.batteryOriginal || item.camerasOk) && (
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                          {item.faceId && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Face ID: {item.faceId}
                            </span>
                          )}
                          {item.screenOriginal && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Tela: {item.screenOriginal}
                            </span>
                          )}
                          {item.batteryOriginal && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Bateria orig.: {item.batteryOriginal}
                            </span>
                          )}
                          {item.camerasOk && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Câmeras: {item.camerasOk}
                            </span>
                          )}
                          {item.audioOk && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Áudio: {item.audioOk}
                            </span>
                          )}
                          {item.chargingPortOk && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Conector: {item.chargingPortOk}
                            </span>
                          )}
                          {item.openedBefore && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Já aberto: {item.openedBefore}
                            </span>
                          )}
                          {item.hasBox && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                              Caixa: {item.hasBox}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Box de Resultado da Pré-Avaliação */}
                      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/8 to-emerald-500/3 p-3.5 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                              💰 Estimativa de Pré-Avaliação da Loja
                            </span>
                            <div className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-emerald-950">
                              {formatBRL(valuation.minEstimatedValue)} a {formatBRL(valuation.maxEstimatedValue)}
                            </div>
                            <p className="text-[11px] text-emerald-800/80 mt-0.5">
                              {valuation.disclaimer}
                            </p>
                          </div>

                          {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
                            <div className="rounded-xl border border-purple-200/80 bg-purple-50/80 p-2.5 sm:p-3 sm:text-right">
                              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-800 block">
                                🎯 Volta Estimada ({valuation.targetModelName})
                              </span>
                              <div className="mt-0.5 font-display text-lg sm:text-xl font-bold text-purple-950">
                                {formatBRL(valuation.minTradeDelta)} a {formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
                              </div>
                            </div>
                          )}
                        </div>

                        {valuation.highlights.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-emerald-500/15 pt-2 text-[11px]">
                            {valuation.highlights.map((hl, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-md bg-white/90 px-2 py-0.5 font-medium text-emerald-950 border border-emerald-500/20 shadow-2xs"
                              >
                                {hl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <p className="mt-2 rounded-lg bg-[#f9f9fa] border border-[#f0f0f2] p-2 text-xs text-neutral-600 italic">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas: WhatsApp + Status + Excluir */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2.5 border-t border-[#e5e5e7] sm:border-t-0 pt-3 sm:pt-0">
                    <a
                      href={whatsAppLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition active:scale-[0.98]"
                    >
                      <MessageCircle className="h-4 w-4" /> Responder no WhatsApp
                    </a>

                    <div className="flex items-center gap-2">
                      <select
                        value={item.status || "pendente"}
                        onChange={(e) =>
                          handleStatusChange(
                            item.id,
                            e.target.value as EvaluationStatus
                          )
                        }
                        className="h-8 rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-2 text-xs font-semibold text-[#1d1d1f] outline-none hover:bg-white focus:border-[#0071e3] transition cursor-pointer"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="atendimento">Em Atendimento</option>
                        <option value="concluido">Concluído</option>
                        <option value="recusado">Recusado</option>
                      </select>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5e7] text-[#86868b] hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                        title="Remover avaliação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
