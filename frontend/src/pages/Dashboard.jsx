import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Wallet, Ticket as TicketIcon, Trophy, Banknote, ArrowUpRight } from "lucide-react";

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
  const { t, formatMoney } = useApp();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-black tracking-tighter">{t("dashboard")}</h1>
        <p className="text-zinc-500 text-sm mt-1">{new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

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
                <Pie data={stats.by_lottery} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name.split(" ")[0]} labelLine={false}>
                  {stats.by_lottery.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
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
                    {(r.pick3 || []).filter(Boolean).map((n, i) => (
                      <span key={i} className="font-mono text-sm bg-yellow-400/10 text-yellow-400 px-2 py-1 rounded border border-yellow-400/20">P3: {n}</span>
                    ))}
                    {(r.bolet || []).filter(Boolean).map((n, i) => (
                      <span key={i} className="font-mono text-sm bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">BL: {n}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
