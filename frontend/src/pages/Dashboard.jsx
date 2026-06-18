import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Wallet, Ticket as TicketIcon, Trophy, Banknote, ArrowUpRight, Crown, AlertCircle } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, sub, color = "text-yellow-400", testId }) => (
  <Card
    data-testid={testId}
    className="bg-[#121214] border-white/5 p-5 card-hover relative overflow-hidden"
  >
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-bold">{label}</div>
        <div className={`text-3xl font-mono font-bold mt-2 ${color}`}>{value}</div>
        {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
      </div>
      <Icon className={`w-5 h-5 ${color} opacity-60`} />
    </div>
  </Card>
);

const PIE_COLORS = ["#FACC15", "#22C55E", "#3B82F6", "#EF4444", "#A855F7", "#F97316", "#06B6D4", "#EC4899"];

export default function Dashboard() {
  const { t, formatMoney, user } = useApp();
  const [stats, setStats] = useState(null);
  const [topMachann, setTopMachann] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    if (["super_admin", "directeur", "superviseur", "admin"].includes(user?.role)) {
      api.get("/dashboard/top-machann").then((r) => setTopMachann(r.data)).catch(() => {});
    }
  }, [user]);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const isOwner = ["super_admin", "directeur", "admin"].includes(user?.role);
  const netProfit = stats.net_profit ?? 0;
  const profitPositive = netProfit >= 0;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("dashboard")}</h1>
        <p className="text-zinc-500 text-sm mt-1">{new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* HERO PROFIT NET CARD — owner-only */}
      {isOwner && (
        <Card data-testid="net-profit-card"
          className={`relative overflow-hidden border-2 p-5 sm:p-7 ${
            profitPositive
              ? "bg-gradient-to-br from-emerald-950 via-[#0A1A33] to-emerald-900/30 border-emerald-500/30"
              : "bg-gradient-to-br from-red-950 via-[#0A1A33] to-red-900/30 border-red-500/30"
          }`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/5 rounded-full -translate-y-20 translate-x-20 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-yellow-400 font-black">★ PROFIT NET PWOPRIYETÈ JODI A</div>
                <div className="text-xs text-zinc-400 mt-1">Ventes − Gains à payer − Commission machanns</div>
              </div>
              {profitPositive
                ? <ArrowUpRight className="w-7 h-7 text-emerald-400" />
                : <AlertCircle className="w-7 h-7 text-red-400" />}
            </div>
            <div className={`mt-4 font-mono font-black tracking-tighter ${profitPositive ? "text-emerald-300" : "text-red-300"}`}
              style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1 }}>
              {profitPositive ? "+" : ""}{formatMoney(netProfit)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Ventes</div>
                <div className="text-lg font-mono font-bold text-yellow-400 mt-0.5">{formatMoney(stats.sales_total)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Gains à payer</div>
                <div className="text-lg font-mono font-bold text-orange-400 mt-0.5">−{formatMoney(stats.payouts_owed || 0)}</div>
                {stats.tickets_unpaid_winning > 0 && (
                  <div className="text-[9px] text-orange-400/70">{stats.tickets_unpaid_winning} tikè à payer</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Gains payés</div>
                <div className="text-lg font-mono font-bold text-red-400 mt-0.5">−{formatMoney(stats.payments_total)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Commissions</div>
                <div className="text-lg font-mono font-bold text-purple-400 mt-0.5">−{formatMoney(stats.commission_total || 0)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard testId="stat-sales" icon={TrendingUp} label={t("salesToday")} value={formatMoney(stats.sales_total)} color="text-yellow-400" />
        <StatCard testId="stat-payments" icon={Banknote} label={t("paymentsToday")} value={formatMoney(stats.payments_total)} color="text-red-400" />
        <StatCard testId="stat-profit" icon={ArrowUpRight} label={t("profitToday")} value={formatMoney(stats.profit)} color="text-green-400" />
        <StatCard testId="stat-tickets-sold" icon={TicketIcon} label={t("ticketsSold")} value={stats.tickets_sold} color="text-white" />
        <StatCard testId="stat-tickets-winning" icon={Trophy} label={t("winningTickets")} value={stats.tickets_winning} color="text-yellow-400" />
        <StatCard testId="stat-balance" icon={Wallet} label={t("balance")} value={formatMoney(stats.balance)} color="text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#121214] border-white/5 p-5 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("salesTrend")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.trend}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#71717A" fontSize={11} />
              <YAxis stroke="#71717A" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                labelStyle={{ color: "#FACC15" }}
              />
              <Line type="monotone" dataKey="sales" stroke="#FACC15" strokeWidth={2.5} dot={{ fill: "#FACC15", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-[#121214] border-white/5 p-5">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("byLottery")}</h3>
          {stats.by_lottery.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm py-12">{t("empty")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.by_lottery} dataKey="value"
                  cx="40%" cy="50%" outerRadius={70}
                  label={(e) => {
                    // Compact: "FL Midi" -> "FL-M", "Florida Soir" -> "FL-S"
                    const parts = e.name.split(" ");
                    const stateMap = { Florida: "FL", Georgia: "GA", "New": "NY", Texas: "TX" };
                    const st = stateMap[parts[0]] || parts[0].slice(0, 2).toUpperCase();
                    const sess = e.name.includes("Midi") ? "M" : "S";
                    return `${st}-${sess}`;
                  }}
                  labelLine={false}
                  fontSize={10}
                >
                  {stats.by_lottery.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconSize={8} wrapperStyle={{ fontSize: 10, paddingLeft: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#121214] border-white/5 p-5">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("recentTickets")}</h3>
          {stats.recent_tickets.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm py-8">{t("noTickets")}</div>
          ) : (
            <div className="space-y-2">
              {stats.recent_tickets.map((tk) => (
                <div key={tk.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-md hover:bg-zinc-900 transition-colors">
                  <div>
                    <div className="font-mono text-sm font-bold text-yellow-400">{tk.ticket_number}</div>
                    <div className="text-xs text-zinc-500">{tk.lottery_name} • {tk.machann_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">{formatMoney(tk.total, tk.currency)}</div>
                    <div className="text-[10px] text-zinc-500">{tk.currency}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-[#121214] border-white/5 p-5">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("recentResults")}</h3>
          {stats.recent_results.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm py-8">{t("noResults")}</div>
          ) : (
            <div className="space-y-2">
              {stats.recent_results.map((r) => (
                <div key={r.id} className="p-3 bg-zinc-900/50 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-zinc-400 uppercase tracking-wider font-bold">{r.draw_date}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {r.pick3 ? (
                      <span className="font-mono text-sm bg-yellow-400/10 text-yellow-400 px-2 py-1 rounded border border-yellow-400/20">P3: {r.pick3}</span>
                    ) : null}
                    {r.pick4 ? (
                      <span className="font-mono text-sm bg-yellow-400/10 text-yellow-400 px-2 py-1 rounded border border-yellow-400/20">P4: {r.pick4}</span>
                    ) : null}
                    {(Array.isArray(r.bolet) ? r.bolet : []).filter(Boolean).map((n, i) => (
                      <span key={i} className="font-mono text-sm bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">BL: {n}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {topMachann && topMachann.ranking?.length > 0 && (
        <Card className="bg-[#121214] border-white/5 p-5" data-testid="top-machann-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" /> Top Machann du Mois — {topMachann.month}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/10">
                <tr>
                  <th className="text-left py-2 w-12">#</th>
                  <th className="text-left py-2">{t("machann")}</th>
                  <th className="text-right py-2">{t("ticketsSold")}</th>
                  <th className="text-right py-2">{t("salesToday")}</th>
                  <th className="text-right py-2 hidden sm:table-cell">Commission %</th>
                  <th className="text-right py-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {topMachann.ranking.map((m, i) => (
                  <tr key={m.machann_id} className={`border-b border-white/5 ${i < 3 ? "bg-yellow-400/[0.03]" : ""}`}>
                    <td className="py-2.5 font-mono font-bold">
                      {i === 0 ? <span className="text-yellow-400">🥇</span> :
                       i === 1 ? <span className="text-zinc-300">🥈</span> :
                       i === 2 ? <span className="text-orange-400">🥉</span> :
                       <span className="text-zinc-500">#{i + 1}</span>}
                    </td>
                    <td className="py-2.5 font-bold">{m.machann_name}</td>
                    <td className="py-2.5 text-right font-mono">{m.tickets}</td>
                    <td className="py-2.5 text-right font-mono">{formatMoney(m.sales)}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-400 hidden sm:table-cell">{m.commission_percent.toFixed(1)}%</td>
                    <td className="py-2.5 text-right font-mono font-bold text-green-400">{formatMoney(m.commission_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
