import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetUserStoreForTesting, updateUser } from "./services/userStore";
import {
  isValidPushEndpoint,
  listSubscriptions,
  resetPushSubscriptionsForTesting,
  saveSubscription,
  sendPushToEvaluationStaff,
  type PushSender,
} from "./services/pushNotifications";

const payload = { title: "Nova avaliação", body: "Maria quer avaliar um iPhone 13.", url: "/admin/avaliacoes/7", tag: "evaluation-7" };
const keys = { p256dh: "p256dh-chave-de-teste", auth: "auth-chave-de-teste" };

async function seller(username: string, unit: "jardim" | "gll" | null) {
  return createUser({ username, name: username, password: "senha-forte-123", role: "vendedor", unit, canEditPrices: false });
}

beforeEach(() => {
  resetUserStoreForTesting();
  resetPushSubscriptionsForTesting();
});

describe("notificação push para atendentes", () => {
  it("só aceita endpoints https de serviços push", () => {
    expect(isValidPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isValidPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isValidPushEndpoint("https://localhost/x")).toBe(false);
    expect(isValidPushEndpoint("não é url")).toBe(false);
  });

  it("guarda uma inscrição por navegador e troca o dono se o mesmo navegador entrar com outro usuário", async () => {
    const a = await seller("ana", null);
    const b = await seller("bia", null);
    await saveSubscription(a.id, { endpoint: "https://push.example.com/1", ...keys });
    await saveSubscription(b.id, { endpoint: "https://push.example.com/1", ...keys });
    const all = await listSubscriptions();
    expect(all).toHaveLength(1);
    expect(all[0].userId).toBe(b.id);
  });

  it("envia para quem atende a loja da avaliação e ignora as outras lojas", async () => {
    const jardim = await seller("jardim", "jardim");
    const guia = await seller("guia", "gll");
    const todas = await seller("todas", null);
    for (const [i, u] of [jardim, guia, todas].entries()) {
      await saveSubscription(u.id, { endpoint: `https://push.example.com/${i}`, ...keys });
    }
    const sender = vi.fn<PushSender>().mockResolvedValue({});
    const delivered = await sendPushToEvaluationStaff({ unit: "jardim" }, payload, sender);
    const endpoints = sender.mock.calls.map(([sub]) => sub.endpoint).sort();
    expect(delivered).toBe(2);
    expect(endpoints).toEqual(["https://push.example.com/0", "https://push.example.com/2"]);
    expect(JSON.parse(sender.mock.calls[0][1])).toMatchObject({ url: "/admin/avaliacoes/7" });
  });

  it("não envia para usuário inativo", async () => {
    const user = await seller("inativo", null);
    await saveSubscription(user.id, { endpoint: "https://push.example.com/9", ...keys });
    const owner = await createUser({ username: "dono", name: "Dono", password: "senha-forte-123", role: "dono", unit: null, canEditPrices: true });
    await updateUser(owner, user.id, { active: false });
    const sender = vi.fn<PushSender>().mockResolvedValue({});
    expect(await sendPushToEvaluationStaff({ unit: "jardim" }, payload, sender)).toBe(0);
    expect(sender).not.toHaveBeenCalled();
  });

  it("remove a inscrição quando o navegador a cancelou (410) e segue enviando às demais", async () => {
    const user = await seller("ana", null);
    await saveSubscription(user.id, { endpoint: "https://push.example.com/velha", ...keys });
    await saveSubscription(user.id, { endpoint: "https://push.example.com/boa", ...keys });
    const sender = vi.fn<PushSender>(async (sub) => {
      if (sub.endpoint.endsWith("velha")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return {};
    });
    expect(await sendPushToEvaluationStaff({ unit: null }, payload, sender)).toBe(1);
    expect((await listSubscriptions()).map((s) => s.endpoint)).toEqual(["https://push.example.com/boa"]);
  });

  it("não faz nada (e não quebra) sem chaves VAPID configuradas", async () => {
    const user = await seller("ana", null);
    await saveSubscription(user.id, { endpoint: "https://push.example.com/1", ...keys });
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await sendPushToEvaluationStaff({ unit: null }, payload)).toBe(0);
  });
});
