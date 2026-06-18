import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Bluetooth, Usb, Wifi, Loader2, FileDown, Share2 } from "lucide-react";
import { useApp } from "@/lib/context";
import { GAME_LABELS } from "@/lib/i18n";
import { API } from "@/lib/api";
import {
  printBluetooth, printWebSerial, printNetwork, printBrowser, getPrinterConfig,
} from "@/lib/printer";
import { toast } from "sonner";

export default function TicketPrint({ ticket, onClose }) {
  const { t, settings, language } = useApp();
  const printRef = useRef(null);
  const [printing, setPrinting] = useState(null);
  const cfg = getPrinterConfig();
  const width = cfg.width || 80;
  const isLocal = ticket.ticket_number?.startsWith("LOCAL-");
  const lang = language === "fr" ? "fr" : "ht";

  const downloadPdf = async () => {
    try {
      const token = localStorage.getItem("tl_token");
      const res = await fetch(`${API}/tickets/${ticket.ticket_number}/pdf?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("PDF erè");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${ticket.ticket_number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      return blob;
    } catch (err) {
      toast.error(err.message || t("error"));
      return null;
    }
  };

  const shareWhatsApp = async () => {
    try {
      const token = localStorage.getItem("tl_token");
      const res = await fetch(`${API}/tickets/${ticket.ticket_number}/pdf?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const file = new File([blob], `${ticket.ticket_number}.pdf`, { type: "application/pdf" });
      const shareText = `🎟️ TOP LOTTO — Tikè ${ticket.ticket_number}\n📅 ${ticket.lottery_name} • ${ticket.draw_date}\n💰 Total: R$ ${Number(ticket.total).toFixed(2)}`;
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Tikè ${ticket.ticket_number}`, text: shareText, files: [file] });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
        await downloadPdf();
      }
    } catch (err) {
      toast.error(err.message || t("error"));
    }
  };

  const grouped = {
    bolet: ticket.items.filter((it) => it.game === "bolet"),
    pick3: ticket.items.filter((it) => it.game === "pick3"),
    pick4: ticket.items.filter((it) => it.game === "pick4"),
    pick5: ticket.items.filter((it) => it.game === "pick5"),
    mariage: ticket.items.filter((it) => it.game === "mariage"),
    mariage_gratis: ticket.items.filter((it) => it.game === "mariage_gratis"),
  };
  const Section = ({ id, label, sub, color, bg, ringColor, items, icon }) => {
    if (!items?.length) return null;
    return (
      <div className="flex items-stretch gap-3 py-2 border-b border-dashed border-blue-900/30 px-3">
        <div className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-black text-white ${bg} ring-2 ${ringColor}`}>
          {icon}
        </div>
        <div className="flex flex-col justify-center min-w-[68px]">
          <div className={`font-black uppercase tracking-tight text-base ${color}`}>{label}</div>
          {sub && <div className="text-[9px] uppercase text-zinc-500 leading-tight">{sub}</div>}
        </div>
        <div className="flex-1 space-y-0.5 text-right">
          {items.map((it, i) => (
            <div key={i} className={`flex items-center justify-between text-sm ${it.winning ? "bg-green-100 -mx-1 px-1 py-0.5 rounded" : ""}`}>
              <span className={`font-mono font-bold ${it.winning ? "text-green-700 text-base" : color}`}>
                {it.winning && <span className="mr-1">🏆</span>}
                {it.number}
                {it.winning && (
                  <span className="ml-1 text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-black">
                    {id === "bolet" ? ["", "1YE", "2YEM", "3YEM"][it.win_position] : "GENYEN"}
                  </span>
                )}
              </span>
              <span className="text-[10px] flex-1 mx-1 border-b border-dotted border-zinc-400 mb-1" />
              <span className="flex flex-col items-end gap-0.5">
                <span className={`font-mono font-bold ${color} ${it.winning ? "line-through text-zinc-400 text-[10px]" : ""}`}>R$ {Number(it.line_total ?? it.amount).toFixed(2)}</span>
                {it.winning && (
                  <span className="font-mono font-black text-green-700 text-base bg-green-200 px-2 rounded">
                    +R$ {Number(it.payout || 0).toFixed(2)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const doPrint = async (method) => {
    setPrinting(method);
    try {
      if (isLocal && method !== "browser") {
        toast.error("Ticket offline — impression navigateur uniquement");
        return;
      }
      if (method === "bluetooth") await printBluetooth(ticket.ticket_number, width);
      else if (method === "webserial") await printWebSerial(ticket.ticket_number, width);
      else if (method === "network") await printNetwork(ticket.ticket_number, { width });
      else printBrowser();
      if (method !== "browser") toast.success(t("success"));
    } catch (err) {
      toast.error(err.message || t("error"));
    } finally {
      setPrinting(null);
    }
  };

  const barcode = (ticket.ticket_number || "").split("").map((c, i) => (
    <div key={i} style={{ width: c === "0" ? 3 : 2, height: 28, background: "black", display: "inline-block", marginRight: 1 }} />
  ));

  const total = ticket.total || ticket.items?.reduce((s, it) => s + (it.line_total || it.amount), 0) || 0;
  const hasResult = ticket.has_result;
  const currency = ticket.currency || "BRL";
  const currencySymbol = "R$";

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white text-black border-0 max-w-[440px] p-0 max-h-[95vh] overflow-y-auto" data-testid="ticket-print-modal">
        <DialogTitle className="sr-only">Ticket {ticket.ticket_number}</DialogTitle>
        <div ref={printRef} className="print-area" id="printable" style={{ background: "#FBFAF5", color: "#0A1A33", width: "100%", maxWidth: 380, margin: "0 auto" }}>
          {/* Header with logo */}
          <div className="bg-[#0A1A33] text-white pt-4 pb-3 px-3 relative" style={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <div className="flex justify-center">
              <img src={require("@/assets/logo.jpeg")} alt="TOP LOTTO" className="w-24 h-24 rounded-full ring-2 ring-yellow-400" style={{ objectFit: "cover" }} />
            </div>
          </div>
          {/* Meta info */}
          <div className="px-3 py-3 grid grid-cols-2 gap-x-2 text-[11px] border-b-2 border-dashed border-blue-900/30 bg-white">
            <div><b className="text-blue-900">AGENCE :</b> <span className="font-mono">{settings?.business_name || "TOP LOTTO"}</span></div>
            <div><b className="text-blue-900">TICKET N° :</b> <span className="font-mono font-black text-red-600">{ticket.ticket_number}</span></div>
            <div><b className="text-blue-900">VENDEUR :</b> {ticket.machann_name}</div>
            <div><b className="text-blue-900">DATE :</b> <span className="font-mono">{new Date(ticket.created_at || Date.now()).toLocaleDateString("fr-FR")}</span></div>
            <div><b className="text-blue-900">CLIENT :</b> {ticket.customer_name || "—"}</div>
            <div><b className="text-blue-900">HEURE :</b> <span className="font-mono">{new Date(ticket.created_at || Date.now()).toLocaleTimeString("fr-FR")}</span></div>
            <div className="col-span-2"><b className="text-blue-900">MONNAIE :</b> R$ (REAIS)</div>
          </div>
          {/* Banner */}
          {(ticket.lottery_names?.length > 1) ? (
            <div className="bg-[#0A1A33] text-white text-[10px] px-3 py-2 font-bold">
              <div className="text-center text-yellow-300 mb-1">★ LOTERIES MULTIPLES ({ticket.lottery_names.length})</div>
              <div className="grid grid-cols-2 gap-1 text-center">
                {ticket.lottery_names.map((ln, i) => (
                  <div key={i} className="bg-white/10 rounded px-1.5 py-0.5">{ln}</div>
                ))}
              </div>
              <div className="text-center mt-1.5 text-yellow-300">💰 R$ (REAIS) — Tirage {ticket.draw_date}</div>
            </div>
          ) : (
            <div className="bg-[#0A1A33] text-white text-[10px] px-3 py-2 grid grid-cols-3 gap-2 text-center font-bold">
              <div>🌐 LOTERIE : {ticket.lottery_name?.split(" ")[0]?.toUpperCase()}</div>
              <div>⏰ TIRAGE : {ticket.lottery_name?.split(" ").slice(1).join(" ")?.toUpperCase()}</div>
              <div>💰 R$ (REAIS)</div>
            </div>
          )}
          {/* Items grouped by game */}
          <div className="bg-white">
            <Section id="bolet" label="BÒLÈT" sub="(2 chiffres)" color="text-red-700" bg="bg-red-700" ringColor="ring-red-300"
              items={grouped.bolet} icon={<span className="text-2xl">♛</span>} />
            <Section id="pick3" label="PICK 3" color="text-green-700" bg="bg-green-700" ringColor="ring-green-300"
              items={grouped.pick3} icon={<div className="font-black text-[10px] leading-none">PICK<br/><span className="text-lg">3</span><br/>★★★</div>} />
            <Section id="pick4" label="PICK 4" color="text-blue-700" bg="bg-blue-700" ringColor="ring-blue-300"
              items={grouped.pick4} icon={<div className="font-black text-[10px] leading-none">PICK<br/><span className="text-lg">4</span><br/>★★★★</div>} />
            <Section id="pick5" label="PICK 5" color="text-purple-700" bg="bg-purple-700" ringColor="ring-purple-300"
              items={grouped.pick5} icon={<div className="font-black text-[9px] leading-none">PICK<br/><span className="text-lg">5</span><br/>★★★★★</div>} />
            <Section id="mariage" label="MARYAJ" sub="PÈYAN" color="text-orange-700" bg="bg-orange-600" ringColor="ring-orange-300"
              items={grouped.mariage} icon={<span className="text-2xl">⚭</span>} />
            <Section id="mariage_gratis" label="MARYAJ" sub="GRATIS 🎁" color="text-pink-700" bg="bg-pink-600" ringColor="ring-pink-300"
              items={grouped.mariage_gratis} icon={<span className="text-xl">★</span>} />
          </div>
          {/* Results if available */}
          {hasResult && ticket.result && (
            <div className="bg-yellow-50 px-3 py-2 text-[10px] border-y border-yellow-300">
              <div className="font-bold uppercase tracking-widest mb-1 text-center text-blue-900">REZILTA OFISYÈL</div>
              <div className="grid grid-cols-2 gap-1">
                {(ticket.result.bolet || []).filter(Boolean).length > 0 && (
                  <div className="col-span-2">BÒLÈT: {(ticket.result.bolet || []).map((b, i) => b ? <b key={i} className="mx-1">{["1ye","2yèm","3yèm"][i]}={b}</b> : null)}</div>
                )}
                {ticket.result.pick3 && <div>P3: <b className="font-mono">{ticket.result.pick3}</b></div>}
                {ticket.result.pick4 && <div>P4: <b className="font-mono">{ticket.result.pick4}</b></div>}
              </div>
            </div>
          )}
          {/* Total banner */}
          <div className="bg-[#0A1A33] text-white px-3 py-3 flex justify-between items-center">
            <div className="font-black uppercase tracking-wider">TOTAL GÉNÉRAL</div>
            <div className="font-mono font-black text-xl">R$ {Number(total).toFixed(2)}</div>
          </div>
          {/* Winning banner */}
          {ticket.payout_amount > 0 && (
            <div className="bg-green-600 text-white px-3 py-3 text-center">
              <div className="text-[10px] uppercase tracking-widest font-bold">★ GENYEN ★</div>
              <div className="font-mono font-black text-2xl">R$ {Number(ticket.payout_amount).toFixed(2)}</div>
              {ticket.paid && <div className="text-[10px] font-bold mt-1">[ PEYE ]</div>}
            </div>
          )}
          {/* Footer with barcode */}
          <div className="bg-white px-3 py-3 flex items-center gap-3 border-t-2 border-dashed border-blue-900/30">
            <div className="text-[10px] flex-1">
              <div className="font-bold uppercase tracking-wider text-blue-900">SCANNEZ POUR VÉRIFIER</div>
              <div className="text-zinc-600 italic mt-1">{settings?.ticket_footer || "Chans ou se lavi'w"}</div>
            </div>
            <div className="text-right">
              <div className="my-1" style={{ lineHeight: 0 }}>{barcode}</div>
              <div className="font-mono text-[10px]">{ticket.ticket_number}</div>
            </div>
          </div>
          {/* Bottom banner */}
          <div className="bg-[#0A1A33] text-yellow-400 text-center py-2 text-[10px] font-bold tracking-widest" style={{ borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
            ★ www.toplotto.com ★
          </div>
        </div>

        <div className="no-print bg-zinc-100 p-3 border-t sticky bottom-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => doPrint("browser")} disabled={!!printing} variant="outline" className="bg-white" data-testid="print-browser">
              {printing === "browser" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Printer className="w-4 h-4 mr-1" /> {t("printerBrowser")}</>}
            </Button>
            <Button onClick={() => doPrint("bluetooth")} disabled={!!printing || isLocal} variant="outline" className="bg-white" data-testid="print-bluetooth">
              {printing === "bluetooth" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bluetooth className="w-4 h-4 mr-1" /> BT</>}
            </Button>
            <Button onClick={() => doPrint("webserial")} disabled={!!printing || isLocal} variant="outline" className="bg-white" data-testid="print-serial">
              {printing === "webserial" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Usb className="w-4 h-4 mr-1" /> USB</>}
            </Button>
            <Button onClick={() => doPrint("network")} disabled={!!printing || isLocal} variant="outline" className="bg-white" data-testid="print-network">
              {printing === "network" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wifi className="w-4 h-4 mr-1" /> {t("printerNetwork")}</>}
            </Button>
            <Button onClick={downloadPdf} disabled={isLocal} variant="outline" data-testid="download-pdf" className="bg-white">
              <FileDown className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button onClick={shareWhatsApp} disabled={isLocal} variant="outline" data-testid="share-whatsapp" className="bg-green-50 border-green-500 text-green-700 hover:bg-green-100">
              <Share2 className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
          </div>
          <Button onClick={onClose} variant="ghost" data-testid="print-close" className="w-full text-zinc-700">
            <X className="w-4 h-4 mr-2" /> {t("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
