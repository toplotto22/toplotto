import React, { useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ScanLine, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import TicketPrint from "@/components/TicketPrint";
import { GAMES, PLAY_TYPE_LABELS } from "@/lib/i18n";

export default function Verify() {
  const { t, formatMoney, user } = useApp();
  const [search, setSearch] = useState("");
  const [ticket, setTicket] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  const verify = async (e) => {
    e?.preventDefault();
    if (!search.trim()) return;
    try {
      const { data } = await api.get(`/tickets/${search.trim().toUpperCase()}`);
      setTicket(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
      setTicket(null);
    }
  };

  const pay = async () => {
    try {
      const { data } = await api.post(`/tickets/${ticket.ticket_number}/pay`);
      toast.success(`${t("payoutSuccess")} - ${formatMoney(data.amount, ticket.currency)}`);
      verify();
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
    }
  };

  const canPay = ["super_admin", "admin", "machann"].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="verify-page">
      <h1 className="text-4xl font-black tracking-tighter">{t("verify")}</h1>

      <Card className="bg-[#121214] border-white/5 p-5">
        <form onSubmit={verify} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchTicket") + " (TL...)"}
              data-testid="verify-input"
              className="bg-zinc-900 border-white/10 pl-10 h-12 font-mono text-lg uppercase"
            />
          </div>
          <Button data-testid="verify-submit" type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 glow-gold">
            <Search className="w-4 h-4 mr-2" /> {t("verify")}
          </Button>
        </form>
      </Card>

      {ticket && (
        <Card className="bg-[#121214] border-white/5 p-6 space-y-5 slide-up" data-testid="verify-result">
          <div className="flex items-start justify-between border-b border-white/5 pb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">{t("ticketNo")}</div>
              <div className="text-3xl font-mono font-bold text-yellow-400 mt-1">{ticket.ticket_number}</div>
              <div className="text-sm text-zinc-400 mt-2">{ticket.lottery_name} • {ticket.draw_date}</div>
            </div>
            <div className="text-right">
              {ticket.has_result ? (
                ticket.payout_amount > 0 ? (
                  <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 font-bold">
                      <Trophy className="w-4 h-4" /> {t("winning")}
                    </div>
                    <div className="text-2xl font-mono font-bold text-green-400 mt-1">{formatMoney(ticket.payout_amount, ticket.currency)}</div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-bold flex items-center gap-2">
                    <X className="w-4 h-4" /> No win
                  </div>
                )
              ) : (
                <div className="px-4 py-2 bg-zinc-800 border border-white/5 rounded-lg text-zinc-400 text-sm">{t("noResults")}</div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold">
                <tr>
                  <th className="text-left py-2">{t("game")}</th>
                  <th className="text-left py-2">{t("playType")}</th>
                  <th className="text-center py-2">{t("number")}</th>
                  <th className="text-right py-2">{t("amount")}</th>
                  <th className="text-right py-2">{t("payout")}</th>
                </tr>
              </thead>
              <tbody>
                {ticket.items.map((it, i) => (
                  <tr key={i} className={`border-t border-white/5 ${it.winning ? "bg-green-500/5" : ""}`}>
                    <td className="py-2.5 font-bold">{GAMES.find((g) => g.value === it.game)?.label}</td>
                    <td className="py-2.5 text-zinc-400">{PLAY_TYPE_LABELS[it.play_type]}</td>
                    <td className="py-2.5 text-center font-mono font-bold text-yellow-400 tracking-widest">{it.number}</td>
                    <td className="py-2.5 text-right font-mono">{formatMoney(it.amount, ticket.currency)}</td>
                    <td className={`py-2.5 text-right font-mono font-bold ${it.payout ? "text-green-400" : "text-zinc-600"}`}>
                      {it.payout ? formatMoney(it.payout, ticket.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 pt-3 border-t border-white/5">
            <Button
              onClick={() => setShowPrint(true)}
              variant="outline"
              data-testid="verify-reprint"
              className="bg-zinc-900 border-white/10 hover:bg-zinc-800"
            >
              {t("printTicket")}
            </Button>
            {ticket.payout_amount > 0 && !ticket.paid && canPay && (
              <Button
                onClick={pay}
                data-testid="verify-pay"
                className="bg-green-500 hover:bg-green-600 text-black font-bold flex-1"
              >
                <Trophy className="w-4 h-4 mr-2" /> {t("payTicket")} {formatMoney(ticket.payout_amount, ticket.currency)}
              </Button>
            )}
            {ticket.paid && (
              <div className="flex-1 px-4 py-2 bg-zinc-800 rounded-md text-center text-green-400 font-bold uppercase tracking-wider text-sm">
                {t("paid")}
              </div>
            )}
          </div>
        </Card>
      )}

      {showPrint && ticket && <TicketPrint ticket={ticket} onClose={() => setShowPrint(false)} />}
    </div>
  );
}
