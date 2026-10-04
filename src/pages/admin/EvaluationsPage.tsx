import { useNavigate } from "react-router";
import AdminEvaluations from "@/components/admin/AdminEvaluations";
import { useAdminSession } from "@/lib/adminSession";

/** Provisório: reaproveita a tela atual até a nova versão de avaliações (Etapa 3). */
export default function EvaluationsPage() {
  const navigate = useNavigate();
  const { can } = useAdminSession();
  return (
    <AdminEvaluations
      onOpenConfig={can("settings.manage") ? () => navigate("/admin/configuracoes") : undefined}
    />
  );
}
