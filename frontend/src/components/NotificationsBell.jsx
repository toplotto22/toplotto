import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Bell, Check, Trophy, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ICON = { result: Newspaper, winning: Trophy };

export default function NotificationsBell() {
  const { t, unreadCount, refreshNotifCount } = useApp();
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } catch (e) { /* offline */ }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const markRead = async (n) => {
    if (!n.read) {
      try { await api.post(`/notifications/${n.id}/read`); }
      catch (e) {}
    }
    refreshNotifCount();
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await api.post("/notifications/read-all");
    refreshNotifCount();
    load();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="notif-bell"
          className="relative w-9 h-9 rounded-md bg-zinc-900 border border-white/10 hover:bg-zinc-800 flex items-center justify-center transition-colors"
        >
          <Bell className="w-4 h-4 text-zinc-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white w-80 sm:w-96 max-h-[80vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between p-3 border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
          <span className="text-sm font-bold uppercase tracking-wider">{t("notifications")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="notif-mark-all"
              onClick={markAll}
              className="h-7 text-xs text-yellow-400 hover:bg-yellow-400/10"
            >
              <Check className="w-3 h-3 mr-1" /> {t("markAllRead")}
            </Button>
          )}
        </div>
        {notifs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">{t("noNotifications")}</div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifs.map((n) => {
              const Icon = ICON[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  data-testid={`notif-${n.id}`}
                  onClick={() => markRead(n)}
                  className={`w-full text-left p-3 hover:bg-white/[0.03] transition-colors flex gap-3 ${
                    !n.read ? "bg-yellow-400/[0.03]" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center ${
                    n.type === "winning" ? "bg-green-500/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold flex items-center gap-2">
                      {n.title}
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">{n.body}</div>
                    <div className="text-[10px] text-zinc-600 mt-1 font-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
