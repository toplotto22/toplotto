import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye } from "lucide-react";
import { GAMES, PLAY_TYPE_LABELS } from "@/lib/i18n";
import TicketPrint from "@/components/TicketPrint";

export default function Tickets() {
  const { t, formatMoney } = useApp();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null);

  const load = async () => {
    const { data } = await api.get("/tickets");
    setTickets(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = tickets.filter((t) =>
    !search ||
    t.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.machann_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openTicket = async (num) => {
    const { data } = await api.get(`/tickets/${num}`);
    setView(data);
  };

  return (
    <div className="space-y-6" data-testid="tickets-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-4xl font-black tracking-tighter">{t("tickets")}</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("quickSearch")}
            data-testid="tickets-search"
            className="bg-zinc-900 border-white/10 pl-10 w-72 h-10 font-mono"
          />
        </div>
      </div>

      <Card className="bg-[#121214] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold bg-[#1A1A1E] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4">{t("ticketNo")}</th>
                <th className="text-left py-3 px-4">{t("lottery")}</th>
                <th className="text-left py-3 px-4">{t("drawDate")}</th>
                <th className="text-left py-3 px-4">{t("machann")}</th>
                <th className="text-right py-3 px-4">{t("total")}</th>
                <th className="text-center py-3 px-4">{t("currency")}</th>
                <th className="text-center py-3 px-4">{t("status")}</th>
                <th className="text-center py-3 px-4">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-zinc-600">{t("noTickets")}</td></tr>
              )}
              {filtered.map((tk) => (
                <tr key={tk.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-yellow-400">{tk.ticket_number}</td>
                  <td className="py-3 px-4">{tk.lottery_name}</td>
                  <td className="py-3 px-4 font-mono">{tk.draw_date}</td>
                  <td className="py-3 px-4 text-zinc-400">{tk.machann_name}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">{formatMoney(tk.total, tk.currency)}</td>
                  <td className="py-3 px-4 text-center text-xs">{tk.currency}</td>
                  <td className="py-3 px-4 text-center">
                    {tk.paid ? (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">{t("paid")}</span>
                    ) : tk.status === "cancelled" ? (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-red-500/10 text-red-400 border border-red-500/20">{t("cancel")}</span>
                    ) : (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-zinc-800 text-zinc-400 border border-white/5">{t("pending")}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`ticket-view-${tk.ticket_number}`}
                      onClick={() => openTicket(tk.ticket_number)}
                      className="text-yellow-400 hover:bg-yellow-400/10 h-7"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {view && <TicketPrint ticket={view} onClose={() => { setView(null); load(); }} />}
    </div>
  );
}
