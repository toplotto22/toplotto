import React, { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, getPushStatus, enablePush, disablePush } from "@/lib/push";

export default function PushToggle() {
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  const refresh = async () => setStatus(await getPushStatus());

  useEffect(() => { refresh(); }, []);

  if (!isPushSupported() || status === "unsupported") return null;
  if (status === "loading") return null;

  const handle = async () => {
    setBusy(true);
    try {
      if (status === "subscribed") {
        await disablePush();
        toast.success("Notifikasyon yo dezaktive");
      } else {
        await enablePush();
        toast.success("Notifikasyon yo aktif ✓");
      }
      await refresh();
    } catch (e) {
      toast.error(e.message || "Erè");
    } finally { setBusy(false); }
  };

  const active = status === "subscribed";
  return (
    <button
      onClick={handle}
      disabled={busy || status === "denied"}
      data-testid="push-toggle"
      title={status === "denied" ? "Permission bloquée" : active ? "Désactiver notifications" : "Activer notifications"}
      className={`flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
        active
          ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
          : status === "denied"
            ? "bg-zinc-900 border-white/10 text-zinc-600 cursor-not-allowed"
            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-yellow-400 hover:border-yellow-400/30"
      }`}
    >
      {active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  );
}
