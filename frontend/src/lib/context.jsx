import React, { createContext, useContext, useState, useEffect } from "react";
import api from "./api";
import { dict } from "./i18n";

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tl_user") || "null"); }
    catch { return null; }
  });
  const [lang, setLang] = useState(() => localStorage.getItem("tl_lang") || "fr");
  const [currency, setCurrency] = useState(() => localStorage.getItem("tl_currency") || "HTG");
  const [settings, setSettings] = useState(null);
  const [lotteries, setLotteries] = useState([]);

  const t = (key) => dict[lang]?.[key] || dict.fr[key] || key;

  useEffect(() => { localStorage.setItem("tl_lang", lang); }, [lang]);
  useEffect(() => { localStorage.setItem("tl_currency", currency); }, [currency]);

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
    } catch (e) {
      // ignore
    }
  };

  const refreshLotteries = async () => {
    try {
      const { data } = await api.get("/lotteries");
      setLotteries(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      refreshSettings();
      refreshLotteries();
    }
  }, [user]);

  const formatMoney = (amt, sourceCurrency) => {
    const src = sourceCurrency || currency;
    const dst = currency;
    const rate = settings?.exchange_rate_brl_to_htg || 25;
    let v = Number(amt) || 0;
    // Real conversion if source differs from display
    if (src !== dst) {
      if (src === "BRL" && dst === "HTG") v = v * rate;
      else if (src === "HTG" && dst === "BRL") v = v / rate;
    }
    const symbol = dst === "HTG" ? "G" : "R$";
    return `${symbol} ${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppContext.Provider value={{
      user, login, logout, t, lang, setLang, currency, setCurrency,
      settings, refreshSettings, lotteries, refreshLotteries, formatMoney,
    }}>
      {children}
    </AppContext.Provider>
  );
};
