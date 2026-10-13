/*
 * Service worker do painel: recebe notificações push (nova avaliação) mesmo com o painel fechado.
 * Não guarda nada em cache nem intercepta requisições.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }
  const title = data.title || "Lojinha do Celular";
  const options = {
    body: data.body || "",
    icon: "/images/logo-icon.png",
    badge: "/images/logo-icon.png",
    tag: data.tag || "lojinha-aviso",
    renotify: true,
    data: { url: data.url || "/admin/avaliacoes" },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Painel aberto e à vista: o próprio painel já avisa (alerta na tela e som); evita duplicar.
      if (windows.some((w) => w.visibilityState === "visible")) return undefined;
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/avaliacoes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
