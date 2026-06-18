import React, { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/context";
import api from "@/lib/api";
import { detectGame, GAME_LABELS } from "@/lib/i18n";
import { queueTicket, isOnline } from "@/lib/offline";
import { todayHaiti } from "@/lib/time";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Plus, Printer, ShoppingCart, Heart, Layers, Zap } from "lucide-react";
import { toast } from "sonner";
import TicketPrint from "@/components/TicketPrint";

const AUTO_DOUBLES = ["00", "11", "22", "33", "44", "55", "66", "77", "88", "99"];

export default function Sales() {
  const { t, lotteries, currency, formatMoney, user, settings } = useApp();
  const [lotteryIds, setLotteryIds] = useState([]);
  const [drawDate, setDrawDate] = useState(todayHaiti());
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState([]);
  const [lastTicket, setLastTicket] = useState(null);
  const [openMariage, setOpenMariage] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [openAutoDoubles, setOpenAutoDoubles] = useState(false);
  const [mNum1, setMNum1] = useState("");
  const [mNum2, setMNum2] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [doublesAmount, setDoublesAmount] = useState("");
  const numberRef = useRef(null);
  const amountRef = useRef(null);

  useEffect(() => {
    if (lotteries.length && lotteryIds.length === 0) setLotteryIds([lotteries[0].id]);
  }, [lotteries, lotteryIds.length]);

  const toggleLottery = (id) => {
    setLotteryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const lotteryId = lotteryIds[0] || "";  // for legacy drawInfo computation

  const detected = detectGame(number.length);

  // Detect when sales close for currently selected lottery
  const selectedLottery = lotteries.find((l) => l.id === lotteryId);
  const drawInfo = React.useMemo(() => {
    if (!selectedLottery?.local_time || !selectedLottery?.timezone) return null;
    try {
      const [hh, mm] = selectedLottery.local_time.split(":").map(Number);
      const now = new Date();
      const offsetHours = selectedLottery.timezone === "America/Chicago" ? 5 : 4;
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      let drawUTC = new Date(todayUTC.getTime() + (hh + offsetHours) * 3600000 + mm * 60000);
      if (drawUTC <= now) drawUTC = new Date(drawUTC.getTime() + 86400000);
      const closeAt = new Date(drawUTC.getTime() - (selectedLottery.close_offset_minutes || 5) * 60000);
      const isOpen = now < closeAt;
      const diffMs = closeAt - now;
      const diffMin = Math.max(0, Math.floor(diffMs / 60000));
      const diffHr = Math.floor(diffMin / 60);
      const countdown = isOpen
        ? (diffHr > 0 ? `${diffHr}h ${diffMin % 60}m` : `${diffMin}m`)
        : null;
      const drawLocal = `${selectedLottery.local_time} ${selectedLottery.timezone.split("/").pop().replace("_", " ")}`;
      return { drawLabel: drawLocal, isOpen, countdown };
    } catch { return null; }
  }, [selectedLottery, drawDate]);

  const addItem = () => {
    if (!detected) {
      toast.error(t("typeNumber"));
      numberRef.current?.focus();
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error(t("amount"));
      amountRef.current?.focus();
      return;
    }
    setCart([...cart, { game: detected, number, amount: amt }]);
    setNumber(""); setAmount("");
    numberRef.current?.focus();
  };

  const updateCartAmount = (idx, val) => {
    const next = [...cart];
    next[idx] = { ...next[idx], amount: parseFloat(val) || 0 };
    setCart(next);
  };

  const remove = (i) => setCart(cart.filter((_, idx) => idx !== i));

  const addMariage = () => {
    if (mNum1.length !== 2 || mNum2.length !== 2) {
      toast.error(t("mariage") + ": 2 chiffres");
      return;
    }
    const amt = parseFloat(mAmount);
    if (!amt || amt <= 0) {
      toast.error(t("amount"));
      return;
    }
    setCart([...cart, { game: "mariage", number: `${mNum1}-${mNum2}`, amount: amt }]);
    setMNum1(""); setMNum2(""); setMAmount("");
    setOpenMariage(false);
    toast.success(t("success"));
  };

  const addAutoDoubles = () => {
    const amt = parseFloat(doublesAmount);
    if (!amt || amt <= 0) {
      toast.error(t("amount"));
      return;
    }
    const newItems = AUTO_DOUBLES.map((n) => ({ game: "bolet", number: n, amount: amt }));
    setCart([...cart, ...newItems]);
    setDoublesAmount("");
    setOpenAutoDoubles(false);
    toast.success(`10 doubles ajoutés (${currency} ${(amt * 10).toFixed(2)})`);
  };

  const addBulk = () => {
    const amt = parseFloat(bulkAmount);
    if (!amt || amt <= 0) {
      toast.error(t("amount"));
      return;
    }
    const nums = bulkNumbers.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const newItems = [];
    for (const n of nums) {
      if (!/^\d+$/.test(n)) continue;
      const game = detectGame(n.length);
      if (!game) continue;
      newItems.push({ game, number: n, amount: amt });
    }
    if (newItems.length === 0) {
      toast.error(t("typeNumber"));
      return;
    }
    setCart([...cart, ...newItems]);
    setBulkNumbers(""); setBulkAmount("");
    setOpenBulk(false);
    toast.success(`${newItems.length} ${t("numbers")}`);
  };

  const total = cart.reduce((s, it) => s + (it.amount || 0), 0) * Math.max(1, lotteryIds.length);
  const paidMariageTotal = cart.filter((it) => it.game === "mariage").reduce((s, it) => s + (it.amount || 0), 0);
  const gratisThreshold = settings?.gratis?.threshold_brl || 20;
  const gratisCount = settings?.gratis?.count || 2;
  const gratisUsed = cart.filter((it) => it.game === "mariage_gratis").length;
  const gratisAvailable = paidMariageTotal >= gratisThreshold && (settings?.gratis?.enabled ?? true);
  const gratisRemaining = gratisAvailable ? Math.max(0, gratisCount - gratisUsed) : 0;

  const [gratisN1, setGratisN1] = useState("");
  const [gratisN2, setGratisN2] = useState("");
  const [openGratis, setOpenGratis] = useState(false);

  const addGratis = () => {
    if (gratisN1.length !== 2 || gratisN2.length !== 2) {
      toast.error("Maryaj Gratis: 2 chiffres");
      return;
    }
    if (gratisRemaining <= 0) {
      toast.error("Pa gen plis gratis disponib");
      return;
    }
    setCart([...cart, { game: "mariage_gratis", number: `${gratisN1}-${gratisN2}`, amount: 0 }]);
    setGratisN1(""); setGratisN2("");
    if (gratisRemaining - 1 <= 0) setOpenGratis(false);
    toast.success("🎁 Maryaj Gratis ajoute");
  };

  const sell = async () => {
    if (lotteryIds.length === 0 || cart.length === 0) {
      toast.error(t("cart") + ": " + t("empty"));
      return;
    }
    const payload = {
      lottery_ids: lotteryIds, draw_date: drawDate,
      currency, items: cart, customer_name: customer,
    };
    if (!isOnline()) {
      const n = queueTicket(payload);
      toast.warning(`${t("offline")} — ${n} ${t("pendingSync")}`);
      const lotNames = lotteryIds.map((lid) => lotteries.find((l) => l.id === lid)?.name).filter(Boolean);
      const fakeTicket = {
        ticket_number: `LOCAL-${Date.now().toString().slice(-6)}`,
        ...payload,
        lottery_name: lotNames[0] || "?",
        lottery_names: lotNames,
        total: cart.reduce((s, it) => s + (it.amount || 0), 0) * lotteryIds.length,
        machann_name: user?.name,
        created_at: new Date().toISOString(),
        status: "active",
        items: cart,
      };
      setLastTicket(fakeTicket);
      setCart([]); setCustomer("");
      return;
    }
    try {
      const { data } = await api.post("/tickets", payload);
      toast.success(`${t("success")} ${data.ticket_number}`);
      setLastTicket(data);
      setCart([]); setCustomer("");
    } catch (e) {
      if (e.message === "Network Error" || !e.response) {
        const n = queueTicket(payload);
        toast.warning(`${t("offline")} — ${n} ${t("pendingSync")}`);
        setCart([]); setCustomer("");
      } else {
        toast.error(e.response?.data?.detail || t("error"));
      }
    }
  };

  const handleEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (number && !amount) amountRef.current?.focus();
      else if (number && amount) addItem();
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="sales-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("sales")}</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1">{t("quickSale")} — {user?.name}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t("currency")}</div>
          <div className="text-xl font-mono font-bold text-yellow-400">R$ BRL</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>{t("lottery")}</span>
                {lotteryIds.length > 1 && (
                  <span className="text-yellow-400 font-mono">★ {lotteryIds.length} loteri</span>
                )}
              </Label>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-white/10 bg-zinc-900 divide-y divide-white/5" data-testid="sales-lottery-multi">
                {lotteries.map((l) => {
                  const checked = lotteryIds.includes(l.id);
                  return (
                    <label key={l.id}
                      data-testid={`lottery-opt-${l.id}`}
                      className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.03] ${checked ? "bg-yellow-400/10" : ""}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={() => toggleLottery(l.id)}
                          className="w-4 h-4 accent-yellow-400" />
                        <span className={`text-sm ${checked ? "text-yellow-400 font-bold" : "text-zinc-300"}`}>{l.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">{l.local_time}</span>
                    </label>
                  );
                })}
              </div>
              {drawInfo && (
                <div className={`mt-2 text-xs px-2 py-1.5 rounded font-bold flex items-center justify-between gap-2 ${
                  drawInfo.isOpen
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`} data-testid="draw-status">
                  <span className="uppercase tracking-wider">{drawInfo.isOpen ? `${t("nextDraw")}` : t("salesClosed")}</span>
                  <span className="font-mono">{drawInfo.drawLabel}{drawInfo.countdown ? ` • ${drawInfo.countdown}` : ""}</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("drawDate")}</Label>
              <Input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)}
                data-testid="sales-draw-date"
                className="bg-zinc-900 border-white/10 h-11 mt-2 font-mono" />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">
                {t("number")} — {t("typeNumber")}
              </Label>
              {detected && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                  {t("autoDetected")}: {GAME_LABELS[detected]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <Input
                ref={numberRef}
                data-testid="sales-number-input"
                inputMode="numeric"
                autoFocus
                maxLength={5}
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                onKeyDown={handleEnter}
                placeholder="—"
                className="sm:col-span-5 bg-zinc-900 border-white/10 h-14 sm:h-16 font-mono text-3xl sm:text-4xl tracking-[0.3em] text-center focus:border-yellow-400"
              />
              <Input
                ref={amountRef}
                data-testid="sales-amount-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={handleEnter}
                placeholder={`Mise (${currency})`}
                className="sm:col-span-4 bg-zinc-900 border-white/10 h-14 sm:h-16 font-mono text-2xl text-center focus:border-yellow-400"
              />
              <Button
                data-testid="sales-add-item"
                onClick={addItem}
                disabled={!detected || !amount}
                className="sm:col-span-3 h-14 sm:h-16 bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold disabled:opacity-40"
              >
                <Plus className="w-5 h-5 mr-1" /> {t("add")}
              </Button>
            </div>
          </div>

          {/* Special options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Dialog open={openAutoDoubles} onOpenChange={setOpenAutoDoubles}>
              <DialogTrigger asChild>
                <Button
                  data-testid="open-auto-doubles"
                  variant="outline"
                  className="h-12 bg-yellow-400/5 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 font-bold"
                >
                  <Zap className="w-4 h-4 mr-2" /> {t("pairsAuto")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#121214] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-yellow-400 flex items-center gap-2">
                    <Zap className="w-5 h-5" /> {t("autoDoubles")}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-zinc-500 -mt-2">
                  Ajoute 10 doubles d'un coup avec un prix commun
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {AUTO_DOUBLES.map((n) => (
                    <div key={n} className="bg-zinc-900 border border-yellow-400/20 rounded-md py-2 text-center font-mono font-bold text-yellow-400 text-lg">
                      {n}
                    </div>
                  ))}
                </div>
                <Input
                  data-testid="auto-doubles-amount"
                  inputMode="decimal"
                  value={doublesAmount}
                  onChange={(e) => setDoublesAmount(e.target.value)}
                  placeholder={`${t("commonAmount")} (${currency})`}
                  className="bg-zinc-900 border-white/10 h-12 font-mono text-xl"
                />
                <div className="text-xs text-zinc-500 text-center">
                  {doublesAmount && (
                    <>Total: <b className="text-yellow-400">{currency} {(parseFloat(doublesAmount || 0) * 10).toFixed(2)}</b></>
                  )}
                </div>
                <Button
                  data-testid="auto-doubles-add"
                  onClick={addAutoDoubles}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t("bulkAdd")} (10)
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={openMariage} onOpenChange={setOpenMariage}>
              <DialogTrigger asChild>
                <Button
                  data-testid="open-mariage"
                  variant="outline"
                  className="h-12 bg-pink-500/5 border-pink-500/30 text-pink-400 hover:bg-pink-500/10 font-bold"
                >
                  <Heart className="w-4 h-4 mr-2" /> {t("mariage")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#121214] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-pink-400 flex items-center gap-2">
                    <Heart className="w-5 h-5" /> {t("mariage")}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-zinc-500 -mt-2">{t("mariageHelp")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    data-testid="mariage-n1"
                    inputMode="numeric"
                    maxLength={2}
                    value={mNum1}
                    onChange={(e) => setMNum1(e.target.value.replace(/\D/g, ""))}
                    placeholder="00"
                    className="bg-zinc-900 border-white/10 h-14 font-mono text-3xl text-center"
                  />
                  <Input
                    data-testid="mariage-n2"
                    inputMode="numeric"
                    maxLength={2}
                    value={mNum2}
                    onChange={(e) => setMNum2(e.target.value.replace(/\D/g, ""))}
                    placeholder="00"
                    className="bg-zinc-900 border-white/10 h-14 font-mono text-3xl text-center"
                  />
                </div>
                <Input
                  data-testid="mariage-amount"
                  inputMode="decimal"
                  value={mAmount}
                  onChange={(e) => setMAmount(e.target.value)}
                  placeholder={`${t("amount")} (${currency})`}
                  className="bg-zinc-900 border-white/10 h-12 font-mono text-xl"
                />
                <Button
                  data-testid="mariage-add"
                  onClick={addMariage}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t("add")}
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={openBulk} onOpenChange={setOpenBulk}>
              <DialogTrigger asChild>
                <Button
                  data-testid="open-bulk"
                  variant="outline"
                  className="h-12 bg-blue-500/5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 font-bold"
                >
                  <Layers className="w-4 h-4 mr-2" /> {t("bulkPaste")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#121214] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-blue-400 flex items-center gap-2">
                    <Layers className="w-5 h-5" /> {t("pairsAuto")}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-zinc-500 -mt-2">{t("pairsAutoEnter")}</p>
                <Textarea
                  data-testid="bulk-numbers"
                  value={bulkNumbers}
                  onChange={(e) => setBulkNumbers(e.target.value)}
                  placeholder="12 34 56 88 99..."
                  className="bg-zinc-900 border-white/10 font-mono text-lg min-h-[120px] tracking-wider"
                />
                <Input
                  data-testid="bulk-amount"
                  inputMode="decimal"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  placeholder={`${t("commonAmount")} (${currency})`}
                  className="bg-zinc-900 border-white/10 h-12 font-mono text-xl"
                />
                <Button
                  data-testid="bulk-add"
                  onClick={addBulk}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t("bulkAdd")}
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* MARYAJ GRATIS unlock banner */}
          {gratisAvailable && (
            <Dialog open={openGratis} onOpenChange={setOpenGratis}>
              <DialogTrigger asChild>
                <button
                  data-testid="open-gratis"
                  className="w-full bg-gradient-to-r from-pink-500/10 via-orange-500/10 to-yellow-400/10 border border-orange-500/40 rounded-md p-3 flex items-center justify-between hover:bg-orange-500/15 transition-colors"
                >
                  <div className="text-left">
                    <div className="text-sm font-black text-orange-400">🎁 MARYAJ GRATIS DEBLOKE</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {gratisRemaining}/{gratisCount} disponible(s) — Pri fiks R$ {(settings?.gratis?.payout_brl || 500).toFixed(0)} si genyen
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-orange-400" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#121214] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-orange-400 flex items-center gap-2">🎁 Maryaj Gratis</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-zinc-500 -mt-2">
                  Bonus — 2 chiffres × 2. Si toulède soti dans 3 boul, peyman R$ {(settings?.gratis?.payout_brl || 500).toFixed(2)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    data-testid="gratis-n1"
                    inputMode="numeric" maxLength={2}
                    value={gratisN1}
                    onChange={(e) => setGratisN1(e.target.value.replace(/\D/g, ""))}
                    placeholder="00"
                    className="bg-zinc-900 border-orange-500/30 h-14 font-mono text-3xl text-center"
                  />
                  <Input
                    data-testid="gratis-n2"
                    inputMode="numeric" maxLength={2}
                    value={gratisN2}
                    onChange={(e) => setGratisN2(e.target.value.replace(/\D/g, ""))}
                    placeholder="00"
                    className="bg-zinc-900 border-orange-500/30 h-14 font-mono text-3xl text-center"
                  />
                </div>
                <Button
                  data-testid="gratis-add"
                  onClick={addGratis}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> Ajoute Gratis ({gratisRemaining} disponib)
                </Button>
              </DialogContent>
            </Dialog>
          )}

          <div className="border-t border-white/5 pt-4">
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("customer")} ({t("optional")})</Label>
            <Input
              data-testid="sales-customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="bg-zinc-900 border-white/10 h-10 mt-2"
            />
          </div>
        </Card>

        {/* Cart */}
        <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("cart")}</h3>
            <ShoppingCart className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t("perItemEdit")}</div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center text-zinc-600 py-8 text-sm">{t("empty")}</div>
            ) : cart.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 bg-zinc-900/70 rounded-md">
                <div className="min-w-0 flex-1">
                  <div className={`font-mono font-bold text-lg ${it.game === "mariage" ? "text-pink-400" : "text-yellow-400"} truncate`}>
                    {it.number}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {GAME_LABELS[it.game]}
                  </div>
                </div>
                <Input
                  data-testid={`cart-amount-${i}`}
                  value={it.amount}
                  onChange={(e) => updateCartAmount(i, e.target.value)}
                  inputMode="decimal"
                  className="w-20 bg-zinc-800 border-white/10 h-9 font-mono text-sm text-right px-2"
                />
                <button
                  data-testid={`cart-remove-${i}`}
                  onClick={() => remove(i)}
                  className="opacity-50 hover:opacity-100 hover:text-red-400 transition shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-3 space-y-1">
            <div className="flex justify-between text-zinc-400 text-xs uppercase tracking-wider">
              <span>{t("total")}</span>
              <span className="font-mono">{cart.length}</span>
            </div>
            <div className="flex justify-between text-xl sm:text-2xl font-mono font-bold text-yellow-400">
              <span>R$</span>
              <span data-testid="cart-total">{total.toFixed(2)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCart([])}
            data-testid="cart-clear"
            className="w-full bg-zinc-900 border border-white/10 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
          >
            {t("clearCart")}
          </Button>
          <Button
            disabled={cart.length === 0}
            onClick={sell}
            data-testid="cart-sell"
            className="w-full h-12 bg-green-500 hover:bg-green-600 text-black font-black"
          >
            <Printer className="w-4 h-4 mr-2" /> {t("saveTicket")}
          </Button>
        </Card>
      </div>

      {lastTicket && (
        <TicketPrint ticket={lastTicket} onClose={() => setLastTicket(null)} />
      )}
    </div>
  );
}
