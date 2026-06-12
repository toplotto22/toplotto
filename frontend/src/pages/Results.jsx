import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export default function Results() {
  const { t, lotteries, user } = useApp();
  const [lotteryId, setLotteryId] = useState("");
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [pick3, setPick3] = useState(["", "", ""]);
  const [pick4, setPick4] = useState(["", "", ""]);
  const [pick5, setPick5] = useState(["", "", ""]);
  const [bolet, setBolet] = useState(["", "", ""]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (lotteries.length && !lotteryId) setLotteryId(lotteries[0].id);
  }, [lotteries]);

  const loadHistory = async () => {
    const { data } = await api.get("/results");
    setHistory(data);
  };
  useEffect(() => { loadHistory(); }, []);

  const canEdit = ["super_admin", "admin", "directeur"].includes(user?.role);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/results", {
        lottery_id: lotteryId, draw_date: drawDate,
        pick3, pick4, pick5, bolet,
      });
      toast.success(t("success"));
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
    }
  };

  const Row = ({ label, values, setValues, digits, color }) => (
    <div>
      <Label className="text-xs uppercase tracking-wider text-zinc-400 font-bold">{label} ({digits} {t("number")}s)</Label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {values.map((v, i) => (
          <Input
            key={i}
            value={v}
            maxLength={digits}
            data-testid={`result-${label.toLowerCase()}-${i}`}
            onChange={(e) => {
              const v2 = e.target.value.replace(/\D/g, "");
              const next = [...values]; next[i] = v2; setValues(next);
            }}
            placeholder={`#${i + 1}`}
            disabled={!canEdit}
            className={`bg-zinc-900 border-white/10 h-12 font-mono text-2xl tracking-widest text-center focus:border-yellow-400 ${color}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="results-page">
      <h1 className="text-4xl font-black tracking-tighter">{t("results")}</h1>

      {canEdit && (
        <Card className="bg-[#121214] border-white/5 p-5">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("lottery")}</Label>
                <Select value={lotteryId} onValueChange={setLotteryId}>
                  <SelectTrigger data-testid="results-lottery" className="bg-zinc-900 border-white/10 h-10 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white">
                    {lotteries.map((l) => <SelectItem key={l.id} value={l.id} className="focus:bg-yellow-400/10 focus:text-yellow-400">{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("drawDate")}</Label>
                <Input type="date" data-testid="results-date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} className="bg-zinc-900 border-white/10 h-10 mt-2 font-mono" />
              </div>
            </div>

            <Row label="BÒLÈT" values={bolet} setValues={setBolet} digits={2} color="text-green-400" />
            <Row label="PICK3" values={pick3} setValues={setPick3} digits={3} color="text-yellow-400" />
            <Row label="PICK4" values={pick4} setValues={setPick4} digits={4} color="text-blue-400" />
            <Row label="PICK5" values={pick5} setValues={setPick5} digits={5} color="text-red-400" />

            <Button data-testid="results-submit" type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold">
              <Trophy className="w-4 h-4 mr-2" /> {t("save")}
            </Button>
          </form>
        </Card>
      )}

      <Card className="bg-[#121214] border-white/5 p-5">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4">{t("results")}</h3>
        <div className="space-y-3">
          {history.length === 0 && <div className="text-zinc-600 text-sm text-center py-8">{t("noResults")}</div>}
          {history.map((r) => {
            const lottery = lotteries.find((l) => l.id === r.lottery_id);
            return (
              <div key={r.id} className="p-4 bg-zinc-900/50 rounded-md border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold">{lottery?.name || "?"}</div>
                  <div className="font-mono text-sm text-zinc-400">{r.draw_date}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    ["BÒLÈT", r.bolet, "text-green-400 bg-green-500/5 border-green-500/20"],
                    ["P3", r.pick3, "text-yellow-400 bg-yellow-400/5 border-yellow-400/20"],
                    ["P4", r.pick4, "text-blue-400 bg-blue-400/5 border-blue-400/20"],
                    ["P5", r.pick5, "text-red-400 bg-red-500/5 border-red-500/20"],
                  ].map(([lbl, vals, cls]) => (
                    <div key={lbl} className={`p-2 rounded border ${cls}`}>
                      <div className="text-[10px] uppercase tracking-wider font-bold mb-1">{lbl}</div>
                      <div className="font-mono space-y-0.5">
                        {(vals || []).filter(Boolean).map((v, i) => <div key={i}>#{i + 1}: <b>{v}</b></div>)}
                        {!(vals || []).filter(Boolean).length && <span className="opacity-30">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
