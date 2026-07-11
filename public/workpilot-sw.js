self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "WorkPilot360", {
    body: payload.body || "Neue Benachrichtigung",
    icon: "/workpilot360-app-icon.png",
    badge: "/workpilot360-app-icon.png",
    tag: payload.notificationId || undefined,
    data: { url: payload.url || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) return existingClient.navigate(targetUrl).then(() => existingClient.focus());
      return self.clients.openWindow(targetUrl);
    })
  );
});
