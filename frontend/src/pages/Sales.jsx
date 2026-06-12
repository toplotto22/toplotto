import React, { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/context";
import api from "@/lib/api";
import { GAMES, PLAY_TYPE_LABELS } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Trash2, Plus, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import TicketPrint from "@/components/TicketPrint";

export default function Sales() {
  const { t, lotteries, currency, formatMoney, user } = useApp();
  const [lotteryId, setLotteryId] = useState("");
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [game, setGame] = useState("bolet");
  const [playType, setPlayType] = useState("straight");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState([]);
  const [lastTicket, setLastTicket] = useState(null);
  const numberRef = useRef(null);
  const amountRef = useRef(null);

  const gameDef = GAMES.find((g) => g.value === game);

  useEffect(() => {
    if (lotteries.length && !lotteryId) setLotteryId(lotteries[0].id);
  }, [lotteries]);

  useEffect(() => {
    setPlayType(gameDef.playTypes[0]);
  }, [game]);

  const validNumber = (n) => /^\d+$/.test(n) && n.length === gameDef.digits;

  const addItem = () => {
    if (!validNumber(number)) {
      toast.error(`${t("number")} - ${gameDef.digits} chiffres`);
      numberRef.current?.focus();
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error(t("amount"));
      amountRef.current?.focus();
      return;
    }
    setCart([...cart, { game, play_type: playType, number, amount: amt }]);
    setNumber(""); setAmount("");
    numberRef.current?.focus();
  };

  const remove = (i) => setCart(cart.filter((_, idx) => idx !== i));

  const total = cart.reduce((s, it) => s + (it.play_type === "combo" ? it.amount * Math.max(1, factorial(it.number.length) / repeatFactor(it.number)) : it.amount), 0);

  function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
  function repeatFactor(num) {
    const counts = {};
    for (const c of num) counts[c] = (counts[c] || 0) + 1;
    return Object.values(counts).reduce((a, b) => a * factorial(b), 1);
  }

  const sell = async () => {
    if (!lotteryId || cart.length === 0) {
      toast.error(t("cart"));
      return;
    }
    try {
      const { data } = await api.post("/tickets", {
        lottery_id: lotteryId,
        draw_date: drawDate,
        currency,
        items: cart,
        customer_name: customer,
      });
      toast.success(`${t("success")} ${data.ticket_number}`);
      setLastTicket(data);
      setCart([]);
      setCustomer("");
    } catch (e) {
      toast.error(e.response?.data?.detail || t("error"));
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
    <div className="space-y-6" data-testid="sales-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">{t("sales")}</h1>
          <p className="text-zinc-500 text-sm mt-1">POS — {t("welcomeBack")} {user?.name}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-zinc-500">{t("currency")}</div>
          <div className="text-xl font-mono font-bold text-yellow-400">{currency}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <Card className="bg-[#121214] border-white/5 p-5 lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("lottery")}</Label>
              <Select value={lotteryId} onValueChange={setLotteryId}>
                <SelectTrigger data-testid="sales-lottery-select" className="bg-zinc-900 border-white/10 h-10 mt-2">
                  <SelectValue placeholder={t("selectLottery")} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {lotteries.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="focus:bg-yellow-400/10 focus:text-yellow-400">
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("drawDate")}</Label>
              <Input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                data-testid="sales-draw-date"
                className="bg-zinc-900 border-white/10 h-10 mt-2 font-mono"
              />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {GAMES.map((g) => (
                <Button
                  key={g.value}
                  data-testid={`game-${g.value}`}
                  onClick={() => setGame(g.value)}
                  variant="ghost"
                  className={`h-12 font-black tracking-tight border ${
                    game === g.value
                      ? "bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-500"
                      : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {g.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {gameDef.playTypes.map((p) => (
                <Button
                  key={p}
                  data-testid={`playtype-${p}`}
                  onClick={() => setPlayType(p)}
                  variant="ghost"
                  className={`h-9 text-xs font-bold border ${
                    playType === p
                      ? "bg-zinc-700 text-yellow-400 border-yellow-400/40"
                      : "bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {PLAY_TYPE_LABELS[p]}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("number")} ({gameDef.digits})</Label>
                <Input
                  ref={numberRef}
                  data-testid="sales-number-input"
                  inputMode="numeric"
                  maxLength={gameDef.digits}
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={handleEnter}
                  placeholder={"0".repeat(gameDef.digits)}
                  className="bg-zinc-900 border-white/10 h-12 mt-2 font-mono text-2xl tracking-widest text-center focus:border-yellow-400"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("amount")} ({currency})</Label>
                <Input
                  ref={amountRef}
                  data-testid="sales-amount-input"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="100"
                  className="bg-zinc-900 border-white/10 h-12 mt-2 font-mono text-2xl text-center focus:border-yellow-400"
                />
              </div>
              <div className="flex items-end">
                <Button
                  data-testid="sales-add-item"
                  onClick={addItem}
                  className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("addToCart")} <span className="ml-2 text-xs opacity-70">[Enter]</span>
                </Button>
              </div>
            </div>
          </div>

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
        <Card className="bg-[#121214] border-white/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("cart")}</h3>
            <ShoppingCart className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center text-zinc-600 py-8 text-sm">{t("empty")}</div>
            ) : cart.map((it, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-zinc-900/70 rounded-md group">
                <div>
                  <div className="font-mono font-bold text-lg text-yellow-400">{it.number}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {GAMES.find((g) => g.value === it.game)?.label} • {PLAY_TYPE_LABELS[it.play_type]}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{formatMoney(it.amount)}</span>
                  <button
                    data-testid={`cart-remove-${i}`}
                    onClick={() => remove(i)}
                    className="opacity-50 hover:opacity-100 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-3 space-y-1">
            <div className="flex justify-between text-zinc-400 text-xs uppercase tracking-wider">
              <span>{t("total")}</span>
              <span className="font-mono">{cart.length} item(s)</span>
            </div>
            <div className="flex justify-between text-2xl font-mono font-bold text-yellow-400">
              <span>{currency}</span>
              <span data-testid="cart-total">{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCart([])}
              data-testid="cart-clear"
              className="flex-1 bg-zinc-900 border border-white/10 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
            >
              {t("clearCart")}
            </Button>
          </div>
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
