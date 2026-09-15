import { afterEach, describe, expect, it, vi } from "vitest";
import {
  notifyEvaluationCreated,
  type EvaluationNotificationInput,
} from "./services/evaluationNotification";

const evaluation: EvaluationNotificationInput = {
  id: 42,
  name: "Cliente Teste",
  whatsapp: "(67) 99208-6012",
  model: "iPhone 14",
  storage: "128GB",
  targetModel: "iPhone 16",
  photosCount: 2,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Notificação de novas avaliações", () => {
  it("não tenta enviar quando nenhuma integração está configurada", async () => {
    vi.stubEnv("EVALUATION_NOTIFICATION_WEBHOOK_URL", "");
    vi.stubEnv("WHATSAPP_CLOUD_API_TOKEN", "");
    vi.stubEnv("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "");
    vi.stubEnv("WHATSAPP_NOTIFICATION_TO", "");
    vi.stubEnv("WHATSAPP_NOTIFICATION_TEMPLATE", "");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyEvaluationCreated(evaluation)).resolves.toEqual({
      status: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia o evento pelo webhook configurado", async () => {
    vi.stubEnv("EVALUATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/evaluation");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyEvaluationCreated(evaluation)).resolves.toEqual({ status: "sent" });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe("https://hooks.example.test/evaluation");
    expect(JSON.parse(String(init.body))).toMatchObject({
      event: "evaluation.created",
      evaluation: { id: 42, model: "iPhone 14", photosCount: 2 },
    });
  });

  it("envia template pela WhatsApp Cloud API com os dados essenciais", async () => {
    vi.stubEnv("WHATSAPP_CLOUD_API_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "123456789");
    vi.stubEnv("WHATSAPP_NOTIFICATION_TO", "+55 (67) 99999-0000");
    vi.stubEnv("WHATSAPP_NOTIFICATION_TEMPLATE", "nova_avaliacao");
    vi.stubEnv("WHATSAPP_CLOUD_API_VERSION", "v22.0");

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(notifyEvaluationCreated(evaluation)).resolves.toEqual({ status: "sent" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v22.0/123456789/messages");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      messaging_product: "whatsapp",
      to: "5567999990000",
      type: "template",
      template: { name: "nova_avaliacao", language: { code: "pt_BR" } },
    });
  });
});
