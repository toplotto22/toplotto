import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ScanLine, Trophy, X, Printer, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import TicketPrint from "@/components/TicketPrint";
import { GAME_LABELS } from "@/lib/i18n";

export default function Verify() {
  const { t, formatMoney, user } = useApp();
  const [search, setSearch] = useState("");
  const [ticket, setTicket] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  const verifyByNumber = async (num) => {
    if (!num?.trim()) return;
    try {
      const cleaned = num.trim().toUpperCase();
      // If QR contains a URL, extract last segment as ticket number
      const finalNum = cleaned.includes("/") ? cleaned.split("/").pop() : cleaned;
      const { data } = await api.get(`/tickets/${finalNum}`);
      setTicket(data);
      setSearch(finalNum);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
      setTicket(null);
    }
  };

  const verify = (e) => { e?.preventDefault(); verifyByNumber(search); };

  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // Wait for DOM
      await new Promise((r) => setTimeout(r, 80));
      scannerRef.current = new Html5Qrcode("qr-reader");
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await stopScanner();
          verifyByNumber(decodedText);
        },
        () => {},
      );
    } catch (err) {
      toast.error("Pa ka aksè ak kamera a: " + err.message);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (_e) {
      /* ignore stop errors */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  const pay = async () => {
    try {
      const { data } = await api.post(`/tickets/${ticket.ticket_number}/pay`);
      toast.success(`${t("payoutSuccess")} - ${formatMoney(data.amount, ticket.currency)}`);
      const { data: refresh } = await api.get(`/tickets/${ticket.ticket_number}`);
      setTicket(refresh);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
    }
  };

  const canPay = ["super_admin", "admin", "machann"].includes(user?.role);

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="verify-page">
      <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("verify")}</h1>

      <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-3">
        <form onSubmit={verify} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchTicket") + " (TL...)"}
              data-testid="verify-input"
              className="bg-zinc-900 border-white/10 pl-10 h-12 font-mono text-base uppercase"
            />
          </div>
          <Button data-testid="verify-submit" type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 glow-gold">
            <Search className="w-4 h-4 mr-2" /> {t("verify")}
          </Button>
          {!scanning ? (
            <Button type="button" onClick={startScanner} data-testid="verify-scan"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold">
              <Camera className="w-4 h-4 mr-2" /> Eskane QR
            </Button>
          ) : (
            <Button type="button" onClick={stopScanner} data-testid="verify-stop-scan"
              className="bg-red-500 hover:bg-red-600 text-white font-bold">
              <CameraOff className="w-4 h-4 mr-2" /> Sispann
            </Button>
          )}
        </form>
        {scanning && (
          <div className="rounded-lg overflow-hidden border-2 border-yellow-400/30 bg-black">
            <div id="qr-reader" className="w-full max-w-md mx-auto" />
            <div className="text-center text-xs text-zinc-400 py-2">Pwente kamera a sou QR code la</div>
          </div>
        )}
      </Card>

      {ticket && (
        <Card className="bg-[#121214] border-white/5 p-4 sm:p-6 space-y-5 slide-up" data-testid="verify-result">
          <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t("ticketNo")}</div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-yellow-400 mt-1">{ticket.ticket_number}</div>
              <div className="text-sm text-zinc-400 mt-2">{ticket.lottery_name} • {ticket.draw_date}</div>
            </div>
            <div>
              {ticket.has_result ? (
                ticket.payout_amount > 0 ? (
                  <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                      <Trophy className="w-4 h-4" /> {t("winning")}
                    </div>
                    <div className="text-xl sm:text-2xl font-mono font-bold text-green-400 mt-1">
                      {formatMoney(ticket.payout_amount, ticket.currency)}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-bold flex items-center gap-2 text-sm">
                    <X className="w-4 h-4" /> {t("notMatched")}
                  </div>
                )
              ) : (
                <div className="px-4 py-2 bg-zinc-800 border border-white/5 rounded-lg text-zinc-400 text-sm">{t("noResults")}</div>
              )}
            </div>
          </div>

          {/* Display drawn numbers */}
          {ticket.has_result && ticket.result && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-md p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {ticket.result.bolet?.filter(Boolean).length > 0 && (
                <div className="col-span-2 sm:col-span-2">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1 font-bold">BÒLÈT</div>
                  <div className="flex gap-1 flex-wrap">
                    {(ticket.result.bolet || []).map((b, i) => b && (
                      <span key={i} className={`font-mono px-2 py-1 rounded border ${
                        ["bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
                         "bg-green-500/10 text-green-400 border-green-500/30",
                         "bg-blue-500/10 text-blue-400 border-blue-500/30"][i]
                      }`}>
                        {["1ye", "2yèm", "3yèm"][i]}: <b>{b}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ticket.result.pick3 && (
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 mb-1 font-bold">PICK 3</div>
                  <div className="font-mono text-base font-bold">{ticket.result.pick3}</div>
                </div>
              )}
              {ticket.result.pick4 && (
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 mb-1 font-bold">PICK 4</div>
                  <div className="font-mono text-base font-bold">{ticket.result.pick4}</div>
                </div>
              )}
              {ticket.result.pick5 && (
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 mb-1 font-bold">PICK 5</div>
                  <div className="font-mono text-base font-bold">{ticket.result.pick5}</div>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold">
                <tr>
                  <th className="text-left py-2">{t("game")}</th>
                  <th className="text-center py-2">{t("number")}</th>
                  <th className="text-right py-2">{t("amount")}</th>
                  <th className="text-right py-2">{t("payout")}</th>
                </tr>
              </thead>
              <tbody>
                {ticket.items.map((it, i) => (
                  <tr key={i} className={`border-t border-white/5 ${it.winning ? "bg-green-500/5" : ""}`}>
                    <td className="py-2.5 font-bold">{GAME_LABELS[it.game]}</td>
                    <td className="py-2.5 text-center">
                      <span className={`font-mono font-bold tracking-widest ${
                        it.winning ? "text-green-400" : "text-yellow-400"
                      }`}>{it.number}</span>
                      {it.winning && it.game === "bolet" && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-green-400">
                          ★ {["", "1ye", "2yèm", "3yèm"][it.win_position]}
                        </span>
                      )}
                      {it.winning && it.game === "mariage" && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-pink-400">★ {t("matched")}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono">{formatMoney(it.amount, ticket.currency)}</td>
                    <td className={`py-2.5 text-right font-mono font-bold ${it.payout ? "text-green-400" : "text-zinc-600"}`}>
                      {it.payout ? formatMoney(it.payout, ticket.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-white/5">
            <Button
              onClick={() => setShowPrint(true)}
              variant="outline"
              data-testid="verify-reprint"
              className="bg-zinc-900 border-white/10 hover:bg-zinc-800"
            >
              <Printer className="w-4 h-4 mr-2" /> {t("printTicket")}
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
              <div className="flex-1 px-4 py-2 bg-green-500/10 rounded-md text-center text-green-400 font-bold uppercase tracking-wider text-sm border border-green-500/20">
                ✓ {t("paid")}
              </div>
            )}
          </div>
        </Card>
      )}

      {showPrint && ticket && <TicketPrint ticket={ticket} onClose={() => setShowPrint(false)} />}
    </div>
  );
}
