/** Offline ticket queue using localStorage + auto-sync */
import api from "./api";

const QUEUE_KEY = "tl_pending_tickets";

export const getQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch { return []; }
};

export const setQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

export const queueTicket = (payload) => {
  const q = getQueue();
  q.push({
    ...payload,
    _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    _created_at: new Date().toISOString(),
  });
  setQueue(q);
  return q.length;
};

export const isOnline = () => typeof navigator !== "undefined" ? navigator.onLine : true;

let _syncing = false;
export const syncPending = async () => {
  if (_syncing) return { synced: 0, failed: 0 };
  _syncing = true;
  const q = getQueue();
  if (q.length === 0) {
    _syncing = false;
    return { synced: 0, failed: 0 };
  }
  let synced = 0;
  const remaining = [];
  for (const t of q) {
    try {
      const { _id, _created_at, ...payload } = t;
      await api.post("/tickets", payload);
      synced++;
    } catch (e) {
      remaining.push(t);
    }
  }
  setQueue(remaining);
  _syncing = false;
  return { synced, failed: remaining.length };
};

export const initSync = (onSync) => {
  if (typeof window === "undefined") return;
  window.addEventListener("online", async () => {
    const res = await syncPending();
    if (onSync) onSync(res);
  });
  // try every 60s in case events miss
  setInterval(async () => {
    if (isOnline() && getQueue().length > 0) {
      const res = await syncPending();
      if (onSync && res.synced > 0) onSync(res);
    }
  }, 60000);
};
