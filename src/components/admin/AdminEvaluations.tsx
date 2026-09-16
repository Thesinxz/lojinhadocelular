import { useState, useMemo, useEffect, useCallback } from "react";
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
  Camera,
  Eye,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Upload,
  Plus,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { detectIphoneModel, getIphoneModelColorImage } from "@/lib/iphoneCatalog";
import { safeStorage } from "@/lib/storage";
import { compressImage, fileToDataUrl } from "@/lib/imageCompressor";
import { SETTING_KEYS, type EvaluationPhotoItem } from "@contracts/types";
import {
  evaluateDevice,
  formatBRL,
  getGradeBadgeConfig,
  generateAdminWhatsAppResponse,
  parseValuationConfig,
} from "@/lib/valuationEngine";

type EvaluationStatus = "pendente" | "atendimento" | "concluido" | "recusado";
type EvaluationNotificationStatus = "not_configured" | "sent" | "failed";

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
  photos?: string | EvaluationPhotoItem[] | null;
  status?: EvaluationStatus;
  notificationStatus?: EvaluationNotificationStatus;
  notificationError?: string | null;
  notifiedAt?: string | Date | null;
  createdAt?: string | Date;
}

function parseEvaluationPhotos(photos: unknown): EvaluationPhotoItem[] {
  if (!photos) return [];
  if (Array.isArray(photos)) return photos as EvaluationPhotoItem[];
  if (typeof photos === "string") {
    try {
      const parsed = JSON.parse(photos);
      if (Array.isArray(parsed)) return parsed as EvaluationPhotoItem[];
    } catch {
      return [];
    }
  }
  return [];
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
  const [searchInput, setSearchInput] = useState("");
  const [evaluationPage, setEvaluationPage] = useState(1);
  const utils = trpc.useUtils();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const settingsQuery = trpc.admin.getSettings.useQuery();
  const valuationConfig = useMemo(
    () => parseValuationConfig(settingsQuery.data?.[SETTING_KEYS.valuationConfig]),
    [settingsQuery.data]
  );

  const query = trpc.admin.evaluationsPage.useQuery(
    {
      page: evaluationPage,
      pageSize: 20,
      status: filterStatus === "todos" ? undefined : (filterStatus as EvaluationStatus),
      search,
    },
    {
    retry: 1,
    staleTime: 1000 * 30,
    },
  );
  const summaryQuery = trpc.admin.evaluationSummary.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const [statusOverrides, setStatusOverrides] = useState<Record<string, EvaluationStatus>>({});

  const updateStatus = trpc.admin.updateEvaluationStatus.useMutation({
    onSuccess: () => {
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
    },
    onError: (error, variables) => {
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[String(variables.id)];
        return next;
      });
      alert(`Não foi possível salvar o status: ${error.message}`);
    },
  });

  const deleteMutation = trpc.admin.deleteEvaluation.useMutation({
    onSuccess: () => {
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
    },
  });

  const [uploadingEvaluationId, setUploadingEvaluationId] = useState<number | null>(null);

  const addPhotosMutation = trpc.admin.addEvaluationPhotos.useMutation({
    onSuccess: () => {
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
      setUploadingEvaluationId(null);
    },
    onError: (err) => {
      alert("Erro ao salvar fotos: " + err.message);
      setUploadingEvaluationId(null);
    },
  });

  const migratePhotosMutation = trpc.admin.migrateEvaluationPhotosToS3.useMutation({
    onSuccess: (result) => {
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
      alert(`${result.migrated} foto(s) armazenada(s) no R2/S3.`);
    },
    onError: (err) => {
      alert("Não foi possível migrar as fotos para o R2/S3: " + err.message);
    },
  });

  const retryNotificationMutation = trpc.admin.retryEvaluationNotification.useMutation({
    onSuccess: (result) => {
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
      if (!result.ok && result.status === "not_configured") {
        alert("A notificação automática ainda não está configurada no servidor.");
      } else if (!result.ok) {
        alert(`Não foi possível notificar a equipe: ${result.error || "erro desconhecido"}`);
      }
    },
    onError: (error) => alert(`Erro ao tentar notificar a equipe: ${error.message}`),
  });

  const handleUploadPhotos = async (
    evaluationId: number | undefined,
    files: FileList | null,
    existingPhotos: EvaluationPhotoItem[] = []
  ) => {
    if (!evaluationId || !files || files.length === 0) return;
    setUploadingEvaluationId(evaluationId);

    try {
      const newPhotos: EvaluationPhotoItem[] = [];
      const fileArr = Array.from(files);

      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i];
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78,
          mimeType: "image/webp",
        });

        const dataUrl = compressed.dataUrl || (await fileToDataUrl(compressed.file));
        newPhotos.push({
          key: `foto_${Date.now()}_${i + 1}`,
          label: `Foto ${existingPhotos.length + i + 1}`,
          url: dataUrl,
          storage: "inline",
          name: file.name,
          size: compressed.compressedSize,
        });
      }

      await addPhotosMutation.mutateAsync({
        id: evaluationId,
        photos: [...existingPhotos, ...newPhotos],
      });
    } catch (err: any) {
      alert("Falha ao processar imagens: " + (err?.message || err));
      setUploadingEvaluationId(null);
    }
  };

  const handleDeletePhoto = async (
    evaluationId: number,
    photoIndex: number,
    currentPhotos: EvaluationPhotoItem[]
  ) => {
    if (!confirm("Tem certeza que deseja remover esta foto?")) return;
    const updated = currentPhotos.filter((_, idx) => idx !== photoIndex);
    await addPhotosMutation.mutateAsync({
      id: evaluationId,
      photos: updated,
    });
    if (activeLightbox && activeLightbox.evaluationId === evaluationId) {
      if (updated.length === 0) {
        setActiveLightbox(null);
      } else {
        setActiveLightbox((prev) =>
          prev
            ? {
                ...prev,
                photos: updated,
                currentIndex: Math.min(prev.currentIndex, updated.length - 1),
              }
            : null
        );
      }
    }
  };

  // Estado do Modal Lightbox para visualização e zoom de fotos reais
  const [activeLightbox, setActiveLightbox] = useState<{
    evaluationId?: number;
    photos: EvaluationPhotoItem[];
    currentIndex: number;
    modelName: string;
    clientName: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handlePrevPhoto = useCallback(() => {
    setActiveLightbox((prev) => {
      if (!prev || prev.photos.length === 0) return null;
      const nextIdx = (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length;
      return { ...prev, currentIndex: nextIdx };
    });
    setZoomLevel(1);
  }, []);

  const handleNextPhoto = useCallback(() => {
    setActiveLightbox((prev) => {
      if (!prev || prev.photos.length === 0) return null;
      const nextIdx = (prev.currentIndex + 1) % prev.photos.length;
      return { ...prev, currentIndex: nextIdx };
    });
    setZoomLevel(1);
  }, []);

  // Atalhos de teclado no lightbox (ESC para fechar, setas para navegar)
  useEffect(() => {
    if (!activeLightbox) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveLightbox(null);
      } else if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLightbox, handlePrevPhoto, handleNextPhoto]);

  // Mescla banco com backup local para máxima resiliência
  const evaluationsList: LocalEvaluation[] = useMemo(() => {
    const dbList = (query.data?.items ?? []) as LocalEvaluation[];
    let localList: LocalEvaluation[] = [];
    try {
      localList = JSON.parse(
        safeStorage.getItem("lojinha_evaluations_history") || "[]"
      ) as LocalEvaluation[];
    } catch {}

    const formattedLocal = localList.map((item, idx) => ({
      ...item,
      id: item.id || 9999 - idx,
      status: item.status || "pendente",
      createdAt: item.createdAt || new Date(),
    }));

    const applyStatusOverrides = (list: LocalEvaluation[]) =>
      list.map((item) => ({
        ...item,
        status: statusOverrides[String(item.id)] ?? item.status ?? "pendente",
      }));

    if (dbList.length === 0) return applyStatusOverrides(formattedLocal);

    // Se dbList tem dados, preserva itens do banco e mescla eventuais propostas locais pendentes
    const knownSignatures = new Set(
      dbList.map((d) => `${d.name?.toLowerCase().trim()}_${d.whatsapp?.replace(/\D/g, "")}`)
    );
    const extraLocal = formattedLocal.filter(
      (l) => !knownSignatures.has(`${l.name?.toLowerCase().trim()}_${l.whatsapp?.replace(/\D/g, "")}`)
    );

    return applyStatusOverrides([...dbList, ...extraLocal]);
  }, [query.data?.items, statusOverrides]);

  const counts = {
    todos: summaryQuery.data?.total ?? evaluationsList.length,
    pendente: summaryQuery.data?.pending ?? evaluationsList.filter((e) => (e.status || "pendente") === "pendente").length,
    atendimento: summaryQuery.data?.atendimento ?? evaluationsList.filter((e) => e.status === "atendimento").length,
    concluido: summaryQuery.data?.concluido ?? evaluationsList.filter((e) => e.status === "concluido").length,
    recusado: summaryQuery.data?.recusado ?? evaluationsList.filter((e) => e.status === "recusado").length,
  };

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

  function handleStatusChange(item: LocalEvaluation, nextStatus: EvaluationStatus) {
    if (!item.id) return;

    setStatusOverrides((current) => ({
      ...current,
      [String(item.id)]: nextStatus,
    }));

    // Mantém o backup local sincronizado quando a avaliação ainda não existe no banco.
    try {
      const history = JSON.parse(
        safeStorage.getItem("lojinha_evaluations_history") || "[]",
      ) as LocalEvaluation[];
      const updatedHistory = history.map((entry, index) => {
        const entryId = entry.id || 9999 - index;
        return entryId === item.id
          ? { ...entry, status: nextStatus }
          : entry;
      });
      safeStorage.setItem(
        "lojinha_evaluations_history",
        JSON.stringify(updatedHistory),
      );
    } catch {
      // A alteração no servidor continua sendo tentada mesmo se o storage local estiver indisponível.
    }

    const existsInDatabase = (query.data?.items ?? []).some(
      (evaluation) => evaluation.id === item.id,
    );
    if (existsInDatabase) {
      updateStatus.mutate({ id: item.id, status: nextStatus });
    }
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
            onClick={() => {
              setFilterStatus("todos");
              setEvaluationPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "todos"
                ? "bg-white text-[#1d1d1f] shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Todas ({counts.todos})
          </button>
          <button
            onClick={() => {
              setFilterStatus("pendente");
              setEvaluationPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "pendente"
                ? "bg-white text-amber-700 shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Pendentes ({counts.pendente})
          </button>
          <button
            onClick={() => {
              setFilterStatus("atendimento");
              setEvaluationPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === "atendimento"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            Em Atendimento ({counts.atendimento})
          </button>
          <button
            onClick={() => {
              setFilterStatus("concluido");
              setEvaluationPage(1);
            }}
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
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setEvaluationPage(1);
            }}
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

            const photos = parseEvaluationPhotos(item.photos);
            const effectivePhotosCount = photos.length || item.photosCount || 0;
            const hasInlinePhotos = photos.some(
              photo => photo.storage !== "s3" && !photo.url.startsWith("s3://"),
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
                        {item.notificationStatus === "sent" && (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Aviso enviado
                          </span>
                        )}
                        {item.notificationStatus === "failed" && (
                          <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                            Aviso pendente
                          </span>
                        )}
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
                        {effectivePhotosCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                            <Camera className="h-3.5 w-3.5" />
                            {effectivePhotosCount} fotos {photos.length > 0 ? "anexadas" : "no site"}
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

                      {/* Galeria de Fotos Reais do Aparelho */}
                      {photos.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-neutral-200/80 bg-[#fbfbfd] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f]">
                              <Camera className="h-3.5 w-3.5 text-[#0071e3]" />
                              Fotos do Aparelho ({photos.length})
                            </span>
                            <div className="flex items-center gap-2">
                              {hasInlinePhotos && (
                                <button
                                  type="button"
                                  onClick={() => migratePhotosMutation.mutate({ id: item.id as number })}
                                  disabled={migratePhotosMutation.isPending}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                                >
                                  {migratePhotosMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Upload className="h-3 w-3" />
                                  )}
                                  <span>Salvar no R2</span>
                                </button>
                              )}
                              <label
                                className={`inline-flex items-center gap-1 text-[11px] font-medium text-[#0071e3] hover:text-[#0077ed] cursor-pointer transition ${
                                  uploadingEvaluationId === item.id ? "opacity-50 pointer-events-none" : ""
                                }`}
                              >
                                {uploadingEvaluationId === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                <span>Adicionar mais</span>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingEvaluationId === item.id}
                                  onChange={(e) => {
                                    handleUploadPhotos(item.id, e.target.files, photos);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <span className="text-[11px] text-[#86868b] hidden sm:inline">
                                • Clique para ampliar
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {photos.map((photo, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => {
                                  setActiveLightbox({
                                    evaluationId: item.id,
                                    photos,
                                    currentIndex: pIdx,
                                    modelName: `${item.model} ${item.storage || ""}`.trim(),
                                    clientName: item.name,
                                  });
                                  setZoomLevel(1);
                                }}
                                className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#e5e5e7] bg-white shadow-2xs hover:border-[#0071e3] transition-all hover:shadow-md cursor-pointer text-left"
                                title={`Clique para ampliar: ${photo.label || `Foto ${pIdx + 1}`}`}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.label || `Foto ${pIdx + 1}`}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] opacity-0 group-hover:opacity-100 transition-all shadow-sm scale-90 group-hover:scale-100">
                                    <Eye className="h-4 w-4" />
                                  </div>
                                </div>
                                <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs text-center shadow-xs">
                                  {photo.label || `Foto ${pIdx + 1}`}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : effectivePhotosCount > 0 ? (
                        <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 text-xs text-blue-950">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-[#0071e3] shrink-0">
                              <Camera className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-blue-900">
                                📸 <b>{effectivePhotosCount} fotos</b> foram anexadas pelo cliente no site Troca Fácil.
                              </p>
                              <p className="text-[11px] text-blue-800/80">
                                Você pode anexar as fotos aqui para salvar no sistema e visualizar na galeria com zoom.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <label
                              className={`inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition cursor-pointer ${
                                uploadingEvaluationId === item.id ? "opacity-50 pointer-events-none" : ""
                              }`}
                            >
                              {uploadingEvaluationId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              <span>{uploadingEvaluationId === item.id ? "Enviando..." : "Anexar Fotos"}</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingEvaluationId === item.id}
                                onChange={(e) => {
                                  handleUploadPhotos(item.id, e.target.files, []);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <a
                              href={whatsAppLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <label
                            className={`inline-flex items-center gap-1.5 text-xs text-[#86868b] hover:text-[#0071e3] cursor-pointer transition ${
                              uploadingEvaluationId === item.id ? "opacity-50 pointer-events-none" : ""
                            }`}
                          >
                            {uploadingEvaluationId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            <span>{uploadingEvaluationId === item.id ? "Enviando fotos..." : "Anexar fotos do aparelho"}</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingEvaluationId === item.id}
                              onChange={(e) => {
                                handleUploadPhotos(item.id, e.target.files, []);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      )}

                      {/* Box de Resultado da Pré-Avaliação */}
                      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/8 to-emerald-500/3 p-3.5 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                💰 Estimativa Interna da Loja
                              </span>
                              {valuationConfig.hidePricesToClient !== false && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                  🔒 Oculto do cliente no site/WhatsApp
                                </span>
                              )}
                            </div>
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
                      {item.id && item.notificationStatus === "failed" && (
                        <button
                          type="button"
                          onClick={() => retryNotificationMutation.mutate({ id: item.id as number })}
                          disabled={retryNotificationMutation.isPending}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          title={item.notificationError || "Tentar enviar o aviso novamente"}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${retryNotificationMutation.isPending ? "animate-spin" : ""}`} />
                          Notificar
                        </button>
                      )}

                      <select
                        value={item.status || "pendente"}
                        onChange={(e) =>
                          handleStatusChange(
                            item,
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

      {!query.isLoading && (query.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-between rounded-xl border border-[#e5e5e7] bg-white px-3 py-2 text-xs text-[#6e6e73]">
          <span>
            Página {evaluationPage} de {Math.max(1, Math.ceil((query.data?.total ?? 0) / 20))}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEvaluationPage(page => Math.max(1, page - 1))}
              disabled={evaluationPage === 1 || query.isFetching}
              className="rounded-lg border border-[#e5e5e7] px-3 py-1.5 font-semibold text-[#1d1d1f] disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setEvaluationPage(page => page + 1)}
              disabled={!query.data?.hasMore || query.isFetching}
              className="rounded-lg border border-[#e5e5e7] px-3 py-1.5 font-semibold text-[#1d1d1f] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal Lightbox para Inspeção e Zoom das Fotos Reais do Aparelho */}
      {activeLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-fadeIn backdrop-blur-md select-none"
        >
          {/* Barra Superior do Visualizador */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 bg-black/40">
            <div className="flex flex-col min-w-0 pr-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-neutral-300 truncate">
                  {activeLightbox.clientName}
                </span>
                <span className="text-neutral-500">•</span>
                <span className="font-medium text-emerald-400 truncate">
                  {activeLightbox.modelName}
                </span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-white truncate">
                {activeLightbox.photos[activeLightbox.currentIndex]?.label || `Foto ${activeLightbox.currentIndex + 1}`}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  ({activeLightbox.currentIndex + 1} de {activeLightbox.photos.length})
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Controle de Zoom */}
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
                title="Ampliar / Reduzir detalhes"
              >
                {zoomLevel > 1 ? (
                  <>
                    <ZoomOut className="h-3.5 w-3.5" />
                    <span>{zoomLevel.toFixed(1)}x</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5" />
                    <span>Zoom</span>
                  </>
                )}
              </button>

              {/* Abrir original em nova aba */}
              {activeLightbox.photos[activeLightbox.currentIndex]?.url && (
                <a
                  href={activeLightbox.photos[activeLightbox.currentIndex]?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
                  title="Abrir foto em alta definição em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nova Aba</span>
                </a>
              )}

              {/* Excluir foto atual */}
              {activeLightbox.evaluationId !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeLightbox.evaluationId !== undefined) {
                      handleDeletePhoto(
                        activeLightbox.evaluationId,
                        activeLightbox.currentIndex,
                        activeLightbox.photos
                      );
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 transition cursor-pointer"
                  title="Excluir esta foto da avaliação"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              )}

              {/* Fechar */}
              <button
                type="button"
                onClick={() => setActiveLightbox(null)}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-red-500/30 hover:border-red-500/50 hover:text-red-200 transition cursor-pointer"
                title="Fechar visualizador (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Área Principal de Exibição da Foto com Navegação */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden p-3 sm:p-6">
            {activeLightbox.photos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/85 hover:scale-105 transition cursor-pointer backdrop-blur-xs shadow-lg"
                title="Foto anterior (Seta esquerda)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <div
              className="relative max-h-full max-w-full overflow-auto flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={activeLightbox.photos[activeLightbox.currentIndex]?.url}
                alt={activeLightbox.photos[activeLightbox.currentIndex]?.label}
                className="max-h-[68vh] sm:max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>

            {activeLightbox.photos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/85 hover:scale-105 transition cursor-pointer backdrop-blur-xs shadow-lg"
                title="Próxima foto (Seta direita)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Faixa de Miniaturas no Rodapé */}
          {activeLightbox.photos.length > 1 && (
            <div className="flex items-center justify-center gap-2.5 border-t border-white/10 bg-black/50 px-4 py-3 overflow-x-auto">
              {activeLightbox.photos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null));
                    setZoomLevel(1);
                  }}
                  className={`group relative h-12 w-14 sm:h-14 sm:w-16 shrink-0 overflow-hidden rounded-lg border-2 transition cursor-pointer ${
                    idx === activeLightbox.currentIndex
                      ? "border-[#0071e3] ring-2 ring-[#0071e3]/50 scale-105"
                      : "border-white/20 opacity-50 hover:opacity-100"
                  }`}
                  title={p.label || `Foto ${idx + 1}`}
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 truncate bg-black/75 px-0.5 text-[8px] font-medium text-white text-center">
                    {p.label.replace("Foto da ", "").replace("Foto do ", "").slice(0, 10)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
