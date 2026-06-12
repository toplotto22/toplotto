import React, { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function Reports() {
  const { t, formatMoney } = useApp();
  const [groupBy, setGroupBy] = useState("day");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState([]);

  const load = async () => {
    const params = new URLSearchParams();
    params.set("group_by", groupBy);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const { data } = await api.get("/reports/sales?" + params.toString());
    setRows(data);
  };

  useEffect(() => { load(); }, [groupBy]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const token = localStorage.getItem("tl_token");
    const res = await fetch(`${API}/reports/export?` + params.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <h1 className="text-4xl font-black tracking-tighter">{t("reports")}</h1>

      <Card className="bg-[#121214] border-white/5 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("groupBy")}</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger data-testid="report-groupby" className="bg-zinc-900 border-white/10 h-10 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="day" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("day")}</SelectItem>
                <SelectItem value="lottery" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("lottery")}</SelectItem>
                <SelectItem value="machann" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("machann")}</SelectItem>
                <SelectItem value="agency" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("agency")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("dateFrom")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="report-from" className="bg-zinc-900 border-white/10 h-10 mt-2 font-mono" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("dateTo")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="report-to" className="bg-zinc-900 border-white/10 h-10 mt-2 font-mono" />
          </div>
          <div className="flex items-end">
            <Button data-testid="report-apply" onClick={load} className="w-full h-10 bg-yellow-400 hover:bg-yellow-500 text-black font-bold">{t("apply")}</Button>
          </div>
          <div className="flex items-end">
            <Button data-testid="report-export" onClick={exportCsv} variant="outline" className="w-full h-10 bg-zinc-900 border-white/10 hover:bg-zinc-800">
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-[#121214] border-white/5 p-5">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("reportSales")}</h3>
        {rows.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">{t("empty")}</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="key" stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} />
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Bar dataKey="sales" fill="#FACC15" />
                <Bar dataKey="payouts" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
            <table className="w-full text-sm mt-6">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/10">
                <tr>
                  <th className="text-left py-2">{t("groupBy")}</th>
                  <th className="text-right py-2">{t("tickets")}</th>
                  <th className="text-right py-2">{t("salesToday")}</th>
                  <th className="text-right py-2">{t("paymentsToday")}</th>
                  <th className="text-right py-2">{t("profit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 font-bold">{r.key}</td>
                    <td className="py-2 text-right font-mono">{r.tickets}</td>
                    <td className="py-2 text-right font-mono">{formatMoney(r.sales)}</td>
                    <td className="py-2 text-right font-mono text-red-400">{formatMoney(r.payouts)}</td>
                    <td className="py-2 text-right font-mono font-bold text-green-400">{formatMoney(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
