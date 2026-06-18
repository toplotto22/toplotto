import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { todayHaiti } from "@/lib/time";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, Save, Download } from "lucide-react";

const STATE_COLORS = {
  FL: "border-orange-500/30 bg-orange-500/5",
  GA: "border-red-500/30 bg-red-500/5",
  NY: "border-blue-500/30 bg-blue-500/5",
  TX: "border-yellow-500/30 bg-yellow-500/5",
};
const STATE_TEXT = {
  FL: "text-orange-400",
  GA: "text-red-400",
  NY: "text-blue-400",
  TX: "text-yellow-400",
};

export default function Results() {
  const { t, lotteries, user, lang } = useApp();
  const [date, setDate] = useState(todayHaiti());
  const [draws, setDraws] = useState({}); // lottery_id -> {pick3, pick4, pick5, bolet[3]}
  const canEdit = ["super_admin", "admin", "directeur"].includes(user?.role);

  const load = async () => {
    if (!lotteries.length) return;
    const { data } = await api.get(`/results?draw_date=${date}`);
    const map = {};
    for (const l of lotteries) {
      const r = data.find((x) => x.lottery_id === l.id);
      map[l.id] = {
        pick3: r?.pick3 || "",
        pick4: r?.pick4 || "",
        pick5: r?.pick5 || "",
        bolet: r?.bolet?.length === 3 ? r.bolet : ["", "", ""],
      };
    }
    setDraws(map);
  };

  useEffect(() => { load(); }, [date, lotteries.length]);

  const setField = (lid, field, val, idx = null) => {
    setDraws((prev) => {
      const next = { ...prev };
      const cur = { ...(next[lid] || { pick3: "", pick4: "", pick5: "", bolet: ["", "", ""] }) };
      if (field === "bolet") {
        const arr = [...cur.bolet];
        arr[idx] = val;
        cur.bolet = arr;
      } else {
        cur[field] = val;
      }
      next[lid] = cur;
      return next;
    });
  };

  const saveAll = async () => {
    try {
      const tasks = lotteries.map(async (l) => {
        const d = draws[l.id];
        if (!d) return;
        // skip if all empty
        if (!d.pick3 && !d.pick4 && !d.pick5 && !d.bolet.some(Boolean)) return;
        await api.post("/results", {
          lottery_id: l.id, draw_date: date,
          pick3: d.pick3, pick4: d.pick4, pick5: d.pick5, bolet: d.bolet,
        });
      });
      await Promise.all(tasks);
      toast.success(t("success"));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
    }
  };

  const groupedByState = ["FL", "GA", "NY", "TX"];
  const lotteryByStateSession = (state, session) =>
    lotteries.find((l) => l.state === state && l.session === session);

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="results-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("results")}</h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-1 font-mono">
            {date} — <span className="text-yellow-400 font-bold">{t("eightDraws")}</span>
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("date")}</Label>
            <Input type="date" data-testid="results-date" value={date} onChange={(e) => setDate(e.target.value)}
              className="bg-zinc-900 border-white/10 h-10 mt-1 font-mono" />
          </div>
          {canEdit && (
            <Button data-testid="results-import-api" onClick={async () => {
              try {
                const { data } = await api.post(`/results/import?date=${date}`);
                toast.success(`${data.imported || 0} résultat(s) importé(s)`);
                if (data.errors?.length) {
                  toast.error(`${data.errors.length} erreur(s) — vérifiez le token API`);
                }
                load();
              } catch (err) {
                toast.error(err.response?.data?.detail || "Token API manquant — configurez LOTTERY_API_TOKEN");
              }
            }} className="h-10 bg-zinc-800 hover:bg-zinc-700 border border-yellow-400/30 text-yellow-400 font-bold">
              <Download className="w-4 h-4 mr-2" /> Importer API
            </Button>
          )}
          {canEdit && (
            <Button data-testid="results-save-all" onClick={saveAll}
              className="h-10 bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold">
              <Save className="w-4 h-4 mr-2" /> {t("save")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groupedByState.map((state) => (
          ["midday", "evening"].map((session) => {
            const lot = lotteryByStateSession(state, session);
            if (!lot) return null;
            const d = draws[lot.id] || { pick3: "", pick4: "", pick5: "", bolet: ["", "", ""] };
            return (
              <Card key={lot.id} className={`p-3 sm:p-4 border ${STATE_COLORS[state]}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-black tracking-tight ${STATE_TEXT[state]}`}>{state}</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold px-2 py-0.5 rounded bg-zinc-800">
                      {session === "midday" ? t("sessionMidday") : t("sessionEvening")}
                    </span>
                  </div>
                  <Trophy className="w-4 h-4 text-zinc-600" />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{t("pickThree")}</Label>
                    <Input
                      data-testid={`result-${state}-${session}-p3`}
                      maxLength={3} disabled={!canEdit}
                      value={d.pick3}
                      onChange={(e) => setField(lot.id, "pick3", e.target.value.replace(/\D/g, ""))}
                      placeholder="000"
                      className="bg-zinc-900 border-white/10 h-11 mt-1 font-mono text-xl tracking-widest text-center focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{t("pickFour")}</Label>
                    <Input
                      data-testid={`result-${state}-${session}-p4`}
                      maxLength={4} disabled={!canEdit}
                      value={d.pick4}
                      onChange={(e) => setField(lot.id, "pick4", e.target.value.replace(/\D/g, ""))}
                      placeholder="0000"
                      className="bg-zinc-900 border-white/10 h-11 mt-1 font-mono text-xl tracking-widest text-center focus:border-yellow-400"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    BÒLÈT (3 boul)
                  </Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={i}
                        data-testid={`result-${state}-${session}-boul-${i}`}
                        maxLength={2} disabled={!canEdit}
                        value={d.bolet[i] || ""}
                        onChange={(e) => setField(lot.id, "bolet", e.target.value.replace(/\D/g, ""), i)}
                        placeholder={["1ye", "2yèm", "3yèm"][i]}
                        className={`bg-zinc-900 border-white/10 h-10 font-mono text-lg tracking-widest text-center focus:border-yellow-400 ${
                          ["text-yellow-400", "text-green-400", "text-blue-400"][i]
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            );
          })
        ))}
      </div>
    </div>
  );
}
