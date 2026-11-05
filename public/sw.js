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

  // O push precisa gerar uma notificação do sistema também quando o painel está aberto.
  // O alerta dentro do painel é separado e não substitui a notificação do Chrome/desktop.
  event.waitUntil(self.registration.showNotification(title, options));
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
