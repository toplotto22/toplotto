import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, Trophy, DollarSign, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import TicketPrint from "@/components/TicketPrint";

const PERIODS = [
  { id: "today", label: "Jodi a", labelFr: "Aujourd'hui" },
  { id: "week", label: "Semèn", labelFr: "Cette semaine" },
  { id: "month", label: "Mwa a", labelFr: "Ce mois" },
  { id: "all", label: "Tout", labelFr: "Tout" },
];

export default function Payments() {
  const { t, formatMoney, user, language } = useApp();
  const isFr = language === "fr";
  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const [tab, setTab] = useState("topay");
  const [period, setPeriod] = useState("today");
  const [paidHistory, setPaidHistory] = useState([]);
  const [winningTickets, setWinningTickets] = useState([]);
  const [view, setView] = useState(null);
  const [searchNum, setSearchNum] = useState("");

  const loadPaid = async (p = period) => {
    const url = p === "all" ? "/payments" : `/payments?period=${p}`;
    const { data } = await api.get(url);
    setPaidHistory(data);
  };

  const loadWinning = async () => {
    // All winning tickets (paid + unpaid). We filter on client side.
    const { data } = await api.get("/tickets?status=won&limit=500");
    setWinningTickets(data);
  };

  useEffect(() => { loadPaid(); loadWinning(); }, []);
  useEffect(() => { loadPaid(period); }, [period]);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Port-au-Prince" });
  const startOfWeek = (() => {
    const d = new Date();
    const day = d.getDay() || 7; if (day !== 1) d.setHours(-24 * (day - 1));
    return d.toLocaleDateString("sv-SE", { timeZone: "America/Port-au-Prince" });
  })();
  const startOfMonth = today.slice(0, 7) + "-01";

  const filteredWinning = useMemo(() => {
    let list = winningTickets;
    if (period === "today") list = list.filter((t) => t.draw_date === today);
    else if (period === "week") list = list.filter((t) => t.draw_date >= startOfWeek);
    else if (period === "month") list = list.filter((t) => t.draw_date >= startOfMonth);
    if (searchNum) list = list.filter((t) => t.ticket_number?.toLowerCase().includes(searchNum.toLowerCase()));
    return list;
  }, [winningTickets, period, today, startOfWeek, startOfMonth, searchNum]);

  const unpaid = filteredWinning.filter((t) => !t.paid);
  const paid = filteredWinning.filter((t) => t.paid);

  const totalUnpaid = unpaid.reduce((s, t) => s + (t.payout_amount || 0), 0);
  const totalPaidPeriod = paid.reduce((s, t) => s + (t.payout_amount || 0), 0);
  const totalSalesPeriod = filteredWinning.reduce((s, t) => s + (t.total || 0), 0);

  const markPaid = async (num) => {
    try {
      await api.post(`/tickets/${num}/pay`);
      toast.success("Peyman fèt ✓");
      loadPaid(); loadWinning();
    } catch (err) { toast.error(err.response?.data?.detail || "Erè"); }
  };

  const openTicket = async (num) => {
    try {
      const { data } = await api.get(`/tickets/${num}`);
      setView(data);
    } catch (err) { toast.error("Erè"); }
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="payments-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("payments")}</h1>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-yellow-400" />
          <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                data-testid={`period-${p.id}`}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  period === p.id ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {isFr ? p.labelFr : p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-orange-500/10 border-orange-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-orange-300 font-bold">À PAYER</div>
              <div className="text-2xl font-mono font-black text-orange-400 mt-1">{formatMoney(totalUnpaid)}</div>
              <div className="text-xs text-orange-300/70 mt-0.5">{unpaid.length} tikè</div>
            </div>
            <AlertCircle className="w-6 h-6 text-orange-400" />
          </div>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-green-300 font-bold">PAYÉS</div>
              <div className="text-2xl font-mono font-black text-green-400 mt-1">{formatMoney(totalPaidPeriod)}</div>
              <div className="text-xs text-green-300/70 mt-0.5">{paid.length} tikè</div>
            </div>
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-yellow-300 font-bold">TOTAL GAGNANTS</div>
              <div className="text-2xl font-mono font-black text-yellow-400 mt-1">{filteredWinning.length}</div>
              <div className="text-xs text-yellow-300/70 mt-0.5">tickets</div>
            </div>
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">VENTES (gagnants)</div>
              <div className="text-2xl font-mono font-black text-blue-400 mt-1">{formatMoney(totalSalesPeriod)}</div>
            </div>
            <Banknote className="w-6 h-6 text-blue-400" />
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#121214] border border-white/5">
          <TabsTrigger value="topay" data-testid="tab-topay" className="data-[state=active]:bg-orange-500 data-[state=active]:text-black">
            À payer ({unpaid.length})
          </TabsTrigger>
          <TabsTrigger value="paid" data-testid="tab-paid" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
            Payés ({paid.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            Historique
          </TabsTrigger>
        </TabsList>

        <div className="my-3">
          <Input
            placeholder="🔎 N° tikè..."
            value={searchNum}
            onChange={(e) => setSearchNum(e.target.value)}
            className="bg-zinc-900 border-white/10 h-9 font-mono text-sm max-w-sm"
            data-testid="payments-search"
          />
        </div>

        <TabsContent value="topay">
          <WinningTicketsList list={unpaid} formatMoney={formatMoney} openTicket={openTicket}
            markPaid={isAdmin ? markPaid : null} emptyMsg="Pa gen tikè pou peye nan peryòd sa" />
        </TabsContent>

        <TabsContent value="paid">
          <WinningTicketsList list={paid} formatMoney={formatMoney} openTicket={openTicket}
            markPaid={null} emptyMsg="Pa gen tikè peye nan peryòd sa" showPaidBadge />
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-[#121214] border-white/5 p-3 sm:p-5">
            <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-3">Historique des paiements</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[500px]">
                <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold bg-[#1A1A1E] border-b border-white/5">
                  <tr>
                    <th className="text-left py-3 px-3">{t("ticketNo")}</th>
                    <th className="text-left py-3 px-3">Payé le</th>
                    <th className="text-right py-3 px-3">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paidHistory.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-8 text-zinc-600">{t("empty")}</td></tr>
                  )}
                  {paidHistory.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      onClick={() => openTicket(p.ticket_number)}>
                      <td className="py-3 px-3 font-mono font-bold text-yellow-400">{p.ticket_number}</td>
                      <td className="py-3 px-3 font-mono text-xs text-zinc-400">
                        {new Date(p.paid_at).toLocaleString("fr-FR", { timeZone: "America/Port-au-Prince" })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-green-400">{formatMoney(p.amount, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {view && <TicketPrint ticket={view} onClose={() => { setView(null); loadWinning(); }} />}
    </div>
  );
}

function WinningTicketsList({ list, formatMoney, openTicket, markPaid, emptyMsg, showPaidBadge }) {
  if (list.length === 0) {
    return <Card className="bg-[#121214] border-white/5 p-8 text-center text-zinc-500">{emptyMsg}</Card>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {list.map((tk) => (
        <Card key={tk.id} className={`bg-[#121214] border p-4 hover:border-yellow-400/30 transition-colors ${showPaidBadge ? "border-green-500/20" : "border-orange-500/20"}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <button onClick={() => openTicket(tk.ticket_number)}
                className="font-mono font-bold text-yellow-400 hover:underline text-sm">{tk.ticket_number}</button>
              <div className="text-xs text-zinc-400 mt-0.5">
                {tk.lottery_names?.length > 1 ? `Multi (${tk.lottery_names.length})` : tk.lottery_name} • {tk.draw_date}
              </div>
              {tk.customer_name && <div className="text-[10px] text-zinc-500">👤 {tk.customer_name}</div>}
            </div>
            {showPaidBadge ? (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-black uppercase rounded">✓ PEYE</span>
            ) : (
              <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase rounded animate-pulse">À PAYER</span>
            )}
          </div>

          <div className="space-y-1.5 mb-3">
            {tk.items?.filter((it) => it.winning).map((it, i) => (
              <div key={i} className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏆</span>
                  <div>
                    <div className="font-mono font-bold text-green-400 text-sm">{it.number}</div>
                    <div className="text-[9px] uppercase text-zinc-500">{it.game}</div>
                  </div>
                </div>
                <div className="font-mono font-black text-green-400 text-base">+{formatMoney(it.payout || 0)}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Total à recevoir</div>
              <div className="font-mono font-black text-yellow-400 text-xl">{formatMoney(tk.payout_amount)}</div>
            </div>
            {markPaid && (
              <Button onClick={() => markPaid(tk.ticket_number)}
                data-testid={`pay-btn-${tk.ticket_number}`}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                <DollarSign className="w-4 h-4 mr-1" /> Marquer Payé
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
