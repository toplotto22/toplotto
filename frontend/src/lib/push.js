// Web Push notification helpers
import api from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const getPushStatus = async () => {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "available";
    } catch (_e) {
      return "available";
    }
};

export const enablePush = async () => {
  if (!isPushSupported()) throw new Error("Push non supporté");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission refusée");
  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get("/push/vapid-public-key");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });
  await api.post("/push/subscribe", sub.toJSON());
  return true;
};

export const disablePush = async () => {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await api.delete(`/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`);
    } catch (_e) { /* ignore */ }
    await sub.unsubscribe();
  }
};

export const testPush = async () => {
  await api.post("/push/test");
};
