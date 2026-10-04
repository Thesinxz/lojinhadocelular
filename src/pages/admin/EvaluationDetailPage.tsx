import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Battery,
  Hand,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { STORE_UNITS } from "@contracts/permissions";
import { SETTING_KEYS, type EvaluationPhotoItem, type EvaluationStatus } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import { detectIphoneModel, getIphoneModelColorImage } from "@/lib/iphoneCatalog";
import { compressImage, fileToDataUrl } from "@/lib/imageCompressor";
import { buildWhatsappLink } from "@/lib/whatsappTemplates";
import {
  evaluateDevice,
  formatBRL as formatReais,
  generateAdminWhatsAppResponse,
  getGradeBadgeConfig,
  parseValuationConfig,
} from "@/lib/valuationEngine";
import AssigneeBadge from "@/components/admin/evaluations/AssigneeBadge";
import EvaluationPhotos from "@/components/admin/evaluations/EvaluationPhotos";
import NegotiationCard from "@/components/admin/evaluations/NegotiationCard";
import NotesTimeline, { EvaluationAuditList } from "@/components/admin/evaluations/NotesTimeline";
import WhatsappTemplatesCard from "@/components/admin/evaluations/WhatsappTemplatesCard";
import {
  formatDateTime,
  hasInlinePhotos,
  STATUS_CONFIG,
  timeAgo,
  type EvaluationRow,
} from "@/components/admin/evaluations/evaluationUi";

function Answer({ label, value }: { label: string; value: ReactNode }) {
  if (value === "" || value === null || value === undefined) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-[#86868b]">{label}</dt>
      <dd className="text-right font-medium text-[#1d1d1f]">{value}</dd>
    </div>
  );
}

function ValuationBox({ item, configJson }: { item: EvaluationRow; configJson: string | undefined }) {
  const config = useMemo(() => parseValuationConfig(configJson), [configJson]);
  const valuation = useMemo(() => {
    const batteryNum = item.battery ? parseInt(item.battery.replace(/\D/g, ""), 10) : NaN;
    return evaluateDevice(
      {
        model: item.model,
        storage: item.storage ?? undefined,
        color: item.color ?? undefined,
        purchaseLocation: item.purchaseLocation ?? undefined,
        batteryPercent: Number.isNaN(batteryNum) ? undefined : batteryNum,
        targetModel: item.targetModel ?? undefined,
        visualCondition: item.visualCondition || item.condition || undefined,
        faceId: item.faceId ?? undefined,
        screenOriginal: item.screenOriginal ?? undefined,
        batteryOriginal: item.batteryOriginal ?? undefined,
        camerasOk: item.camerasOk ?? undefined,
        audioOk: item.audioOk ?? undefined,
        chargingPortOk: item.chargingPortOk ?? undefined,
        openedBefore: item.openedBefore ?? undefined,
        hasBox: item.hasBox ?? undefined,
        notes: item.notes ?? undefined,
      },
      config,
    );
  }, [item, config]);
  const grade = getGradeBadgeConfig(valuation.grade);
  const estimateLink = generateAdminWhatsAppResponse(
    item.name,
    item.whatsapp,
    valuation,
    { model: item.model, storage: item.storage ?? undefined, color: item.color ?? undefined },
    config.loyaltyBonusPercent ?? 5,
  );

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Estimativa interna</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${grade.badgeBg} ${grade.badgeText} ${grade.badgeBorder}`}
        >
          {grade.iconText} {grade.label}
        </span>
      </div>
      <p className="mt-1 font-display text-xl font-bold text-emerald-950">
        {formatReais(valuation.minEstimatedValue)} a {formatReais(valuation.maxEstimatedValue)}
      </p>
      {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
        <p className="mt-0.5 text-xs text-purple-900">
          Volta estimada ({valuation.targetModelName}): {formatReais(valuation.minTradeDelta)} a{" "}
          {formatReais(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
        </p>
      )}
      <a
        href={estimateLink}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Enviar estimativa no WhatsApp
      </a>
    </div>
  );
}

export default function EvaluationDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const navigate = useNavigate();
  const { user, can } = useAdminSession();
  const utils = trpc.useUtils();
  const canAssign = can("evaluations.assign");

  const detailQuery = trpc.admin.evaluationDetail.useQuery({ id }, { enabled: validId, retry: 1 });
  const configQuery = trpc.admin.evaluationConfig.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const shopSettingsQuery = trpc.shop.settings.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const usersQuery = trpc.admin.users.list.useQuery(undefined, { enabled: canAssign, staleTime: 1000 * 60 });

  function refresh() {
    utils.admin.evaluationDetail.invalidate({ id });
    utils.admin.evaluationsPage.invalidate();
    utils.admin.evaluationSummary.invalidate();
  }
  const onError = (error: { message: string }) => toast.error(error.message);

  const claim = trpc.admin.evaluationClaim.useMutation({ onSuccess: refresh, onError });
  const assign = trpc.admin.evaluationAssign.useMutation({
    onSuccess: () => {
      toast.success("Responsável atualizado.");
      refresh();
    },
    onError,
  });
  const setStatus = trpc.admin.evaluationSetStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado.");
      refresh();
    },
    onError,
  });
  const setValues = trpc.admin.evaluationSetValues.useMutation({
    onSuccess: () => {
      toast.success("Valores salvos.");
      refresh();
    },
    onError,
  });
  const setUnit = trpc.admin.evaluationSetUnit.useMutation({ onSuccess: refresh, onError });
  const addNote = trpc.admin.evaluationAddNote.useMutation({ onSuccess: refresh, onError });
  const addPhotos = trpc.admin.addEvaluationPhotos.useMutation({ onSuccess: refresh, onError });
  const migratePhotos = trpc.admin.migrateEvaluationPhotosToS3.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.migrated} foto(s) armazenada(s) no R2/S3.`);
      refresh();
    },
    onError: (error) => toast.error(`Não foi possível migrar as fotos: ${error.message}`),
  });
  const retryNotification = trpc.admin.retryEvaluationNotification.useMutation({
    onSuccess: (result) => {
      refresh();
      if (result.ok) toast.success("Equipe notificada.");
      else if (result.status === "not_configured") toast.warning("A notificação automática não está configurada no servidor.");
      else toast.error(`Não foi possível notificar a equipe: ${result.error || "erro desconhecido"}`);
    },
    onError,
  });
  const deleteEvaluation = trpc.admin.deleteEvaluation.useMutation({
    onSuccess: () => {
      toast.success("Avaliação removida.");
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
      navigate("/admin/avaliacoes", { replace: true });
    },
    onError,
  });

  const [uploading, setUploading] = useState(false);

  const evaluation = detailQuery.data?.evaluation;
  const photos: EvaluationPhotoItem[] = evaluation?.photos ?? [];

  async function handleUpload(files: FileList) {
    if (!evaluation) return;
    setUploading(true);
    try {
      const newPhotos: EvaluationPhotoItem[] = [];
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78,
          mimeType: "image/webp",
        });
        const dataUrl = compressed.dataUrl || (await fileToDataUrl(compressed.file));
        newPhotos.push({
          key: `foto_${Date.now()}_${i + 1}`,
          label: `Foto ${photos.length + i + 1}`,
          url: dataUrl,
          storage: "inline",
          name: file.name,
          size: compressed.compressedSize,
        });
      }
      await addPhotos.mutateAsync({ id: evaluation.id, photos: [...photos, ...newPhotos] });
      toast.success(`${newPhotos.length} foto(s) adicionada(s).`);
    } catch (err) {
      toast.error(`Falha ao processar imagens: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(index: number) {
    if (!evaluation || !window.confirm("Remover esta foto?")) return;
    await addPhotos.mutateAsync({ id: evaluation.id, photos: photos.filter((_, idx) => idx !== index) });
  }

  if (!validId) {
    return <NotFound />;
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]" />
      </div>
    );
  }

  if (detailQuery.error?.data?.code === "NOT_FOUND" || (!detailQuery.isError && !evaluation)) {
    return <NotFound />;
  }

  if (detailQuery.isError || !evaluation) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Não foi possível carregar a avaliação.{" "}
        <button type="button" onClick={() => detailQuery.refetch()} className="font-semibold underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  const status = STATUS_CONFIG[evaluation.status] ?? STATUS_CONFIG.pendente;
  const isMine = evaluation.assignedUserId === user?.id;
  const thumbUrl = getIphoneModelColorImage(detectIphoneModel(evaluation.model), evaluation.color ?? undefined);
  const config = configQuery.data;
  const modelName = [evaluation.model, evaluation.storage].filter(Boolean).join(" ");
  const activeUsers = (usersQuery.data ?? []).filter((u) => u.active);

  return (
    <div className="space-y-4 pb-4">
      <Link
        to="/admin/avaliacoes"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#0071e3] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Avaliações
      </Link>

      {/* Cabeçalho */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-[#1d1d1f]">{evaluation.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text} ${status.border}`}
              >
                {status.label}
              </span>
              {evaluation.isLate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  <AlertTriangle className="h-3 w-3" /> Atrasada
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#86868b]">
              #{evaluation.id} · enviada {timeAgo(evaluation.createdAt)} ({formatDateTime(evaluation.createdAt)})
            </p>
          </div>
          <a
            href={buildWhatsappLink(evaluation.whatsapp, "")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#20ba59]"
          >
            <MessageCircle className="h-4 w-4" />
            {evaluation.whatsapp}
          </a>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="evaluation-unit" className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#6e6e73]">
              <MapPin className="h-3.5 w-3.5" /> Unidade
            </label>
            <select
              id="evaluation-unit"
              value={evaluation.unit}
              disabled={setUnit.isPending}
              onChange={(e) => setUnit.mutate({ id: evaluation.id, unit: e.target.value as "jardim" | "gll" | "" })}
              className="h-11 w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] disabled:opacity-60"
            >
              <option value="">Sem unidade</option>
              {STORE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-[#6e6e73]">Responsável</p>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-1.5">
              <AssigneeBadge name={evaluation.assignedUserName} isMe={isMine} size="md" />
              {!evaluation.assignedUserId && (
                <button
                  type="button"
                  onClick={() => claim.mutate({ id: evaluation.id })}
                  disabled={claim.isPending}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#0071e3] px-3 text-xs font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
                >
                  {claim.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
                  Pegar
                </button>
              )}
            </div>
            {canAssign && (
              <>
                <label htmlFor="evaluation-assign" className="sr-only">
                  Reatribuir
                </label>
                <select
                  id="evaluation-assign"
                  value={evaluation.assignedUserId ?? ""}
                  disabled={assign.isPending || usersQuery.isLoading}
                  onChange={(e) =>
                    assign.mutate({ id: evaluation.id, userId: e.target.value ? Number(e.target.value) : null })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#e5e5e7] bg-white px-3 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3] disabled:opacity-60"
                >
                  <option value="">Reatribuir: sem responsável</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      Reatribuir para {u.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* Aparelho */}
          <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-1">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Smartphone className="h-8 w-8 text-[#86868b]" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-[#1d1d1f]">Aparelho</h2>
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {[evaluation.model, evaluation.storage, evaluation.color].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#6e6e73]">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-2 py-0.5">
                    <Battery className="h-3.5 w-3.5 text-emerald-600" /> {evaluation.battery || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-2 py-0.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0071e3]" /> {evaluation.visualCondition || evaluation.condition}
                  </span>
                </div>
              </div>
            </div>

            <dl className="mt-3 divide-y divide-[#f0f0f2]">
              <Answer label="Quer trocar por" value={evaluation.targetModel || "Apenas vender"} />
              <Answer label="Onde comprou" value={evaluation.purchaseLocation} />
              <Answer label="Face ID" value={evaluation.faceId} />
              <Answer label="Tela original" value={evaluation.screenOriginal} />
              <Answer label="Bateria original" value={evaluation.batteryOriginal} />
              <Answer label="Câmeras" value={evaluation.camerasOk} />
              <Answer label="Áudio" value={evaluation.audioOk} />
              <Answer label="Conector de carga" value={evaluation.chargingPortOk} />
              <Answer label="Já foi aberto" value={evaluation.openedBefore} />
              <Answer label="Tem caixa" value={evaluation.hasBox} />
            </dl>
            {evaluation.notes && (
              <p className="mt-2 rounded-lg border border-[#f0f0f2] bg-[#f9f9fa] p-2 text-xs italic text-neutral-600">
                &ldquo;{evaluation.notes}&rdquo;
              </p>
            )}

            <div className="mt-3">
              <EvaluationPhotos
                photos={photos}
                photosCount={evaluation.photosCount}
                clientName={evaluation.name}
                modelName={modelName}
                uploading={uploading || addPhotos.isPending}
                migrating={migratePhotos.isPending}
                canMigrate={hasInlinePhotos(photos)}
                onUpload={handleUpload}
                onDelete={handleDeletePhoto}
                onMigrate={() => migratePhotos.mutate({ id: evaluation.id })}
              />
            </div>

            <div className="mt-3">
              <ValuationBox item={evaluation} configJson={shopSettingsQuery.data?.[SETTING_KEYS.valuationConfig]} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <NegotiationCard
            status={evaluation.status}
            offeredValue={evaluation.offeredValue}
            closedValue={evaluation.closedValue}
            refusalReason={evaluation.refusalReason ?? ""}
            savingValues={setValues.isPending}
            savingStatus={setStatus.isPending}
            onSaveValues={(values) => setValues.mutate({ id: evaluation.id, ...values })}
            onSetStatus={(input: { status: EvaluationStatus; refusalReason?: string; closedValue?: number | null }) =>
              setStatus.mutate({ id: evaluation.id, ...input })
            }
          />

          {config && (
            <WhatsappTemplatesCard
              templates={config.templates}
              clientPhone={evaluation.whatsapp}
              evaluation={evaluation}
              sellerName={user?.name ?? ""}
              addresses={{ jardim: config.stores.jardim.address, gll: config.stores.gll.address }}
            />
          )}

          <NotesTimeline
            notes={detailQuery.data?.notes ?? []}
            adding={addNote.isPending}
            onAdd={async (body) => {
              try {
                await addNote.mutateAsync({ id: evaluation.id, body });
                return true;
              } catch {
                return false;
              }
            }}
          />

          <EvaluationAuditList entries={detailQuery.data?.audit ?? []} />
        </div>
      </div>

      {/* Ações secundárias */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs">
        <div className="text-xs text-[#86868b]">
          Aviso para a equipe:{" "}
          <strong className="text-[#1d1d1f]">
            {evaluation.notificationStatus === "sent"
              ? "enviado"
              : evaluation.notificationStatus === "failed"
                ? "falhou"
                : "não configurado"}
          </strong>
          {evaluation.notificationError && <span className="block text-red-600">{evaluation.notificationError}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {evaluation.notificationStatus === "failed" && (
            <button
              type="button"
              onClick={() => retryNotification.mutate({ id: evaluation.id })}
              disabled={retryNotification.isPending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retryNotification.isPending ? "animate-spin" : ""}`} />
              Notificar novamente
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Deseja realmente remover esta avaliação? Esta ação não pode ser desfeita.")) {
                deleteEvaluation.mutate({ id: evaluation.id });
              }
            }}
            disabled={deleteEvaluation.isPending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] px-3 text-xs font-semibold text-[#86868b] hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir avaliação
          </button>
        </div>
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-2xl border border-[#e5e5e7] bg-white p-10 text-center shadow-2xs">
      <p className="font-display text-base font-semibold text-[#1d1d1f]">Avaliação não encontrada</p>
      <Link
        to="/admin/avaliacoes"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#0071e3] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a lista
      </Link>
    </div>
  );
}
