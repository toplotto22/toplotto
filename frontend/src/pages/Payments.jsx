import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Banknote } from "lucide-react";

export default function Payments() {
  const { t, formatMoney } = useApp();
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get("/payments").then((r) => setPayments(r.data));
  }, []);

  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6" data-testid="payments-page">
      <h1 className="text-4xl font-black tracking-tighter">{t("payments")}</h1>

      <Card className="bg-[#121214] border-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold">{t("paymentsToday")}</h3>
          <div className="flex items-center gap-2 text-green-400 font-mono font-bold text-xl">
            <Banknote className="w-4 h-4" /> {formatMoney(total)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold bg-[#1A1A1E] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4">{t("ticketNo")}</th>
                <th className="text-left py-3 px-4">{t("date")}</th>
                <th className="text-right py-3 px-4">{t("amount")}</th>
                <th className="text-center py-3 px-4">{t("currency")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-zinc-600">{t("empty")}</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono font-bold text-yellow-400">{p.ticket_number}</td>
                  <td className="py-3 px-4 font-mono text-zinc-400">{new Date(p.paid_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-green-400">{formatMoney(p.amount, p.currency)}</td>
                  <td className="py-3 px-4 text-center text-xs">{p.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
