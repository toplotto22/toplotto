import React, { createContext, useContext, useState, useEffect } from "react";
import api from "./api";
import { dict } from "./i18n";
import { initSync, syncPending } from "./offline";
import { toast } from "sonner";

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tl_user") || "null"); }
    catch { return null; }
  });
  const [lang, setLang] = useState(() => localStorage.getItem("tl_lang") || "fr");
  const [settings, setSettings] = useState(null);
  const [lotteries, setLotteries] = useState([]);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Currency is BRL only
  const currency = "BRL";
  const t = (key) => dict[lang]?.[key] || dict.fr[key] || key;

  useEffect(() => { localStorage.setItem("tl_lang", lang); }, [lang]);

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("tl_token", data.token);
    localStorage.setItem("tl_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("tl_token");
    localStorage.removeItem("tl_user");
    setUser(null);
  };

  const refreshSettings = async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
    } catch (e) { /* offline */ }
  };

  const refreshLotteries = async () => {
    try {
      const { data } = await api.get("/lotteries");
      setLotteries(data);
    } catch (e) { /* offline */ }
  };

  const refreshNotifCount = async () => {
    try {
      const { data } = await api.get("/notifications/count");
      setUnreadCount(data.unread || 0);
    } catch (e) { /* offline */ }
  };

  useEffect(() => {
    if (user) {
      refreshSettings();
      refreshLotteries();
      refreshNotifCount();
      initSync((r) => {
        if (r.synced > 0) toast.success(`${r.synced} ${t("syncedTickets")}`);
      });
      const interval = setInterval(refreshNotifCount, 30000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line
  }, [user]);

  // Manual sync trigger
  const triggerSync = async () => {
    const r = await syncPending();
    if (r.synced > 0) toast.success(`${r.synced} ${t("syncedTickets")}`);
    else if (r.failed > 0) toast.error(`${r.failed} ${t("failedSync")}`);
    else toast.info(t("nothingToSync"));
    return r;
  };

  // BRL only
  const formatMoney = (amt) => {
    const v = Number(amt) || 0;
    return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppContext.Provider value={{
      user, login, logout, t, lang, setLang, currency,
      settings, refreshSettings, lotteries, refreshLotteries, formatMoney,
      online, unreadCount, refreshNotifCount, triggerSync,
    }}>
      {children}
    </AppContext.Provider>
  );
};
