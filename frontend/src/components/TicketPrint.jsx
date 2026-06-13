import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Bluetooth, Usb, Wifi, Loader2 } from "lucide-react";
import { useApp } from "@/lib/context";
import { GAME_LABELS } from "@/lib/i18n";
import {
  printBluetooth, printWebSerial, printNetwork, printBrowser, getPrinterConfig,
} from "@/lib/printer";
import { toast } from "sonner";

export default function TicketPrint({ ticket, onClose }) {
  const { t, settings } = useApp();
  const printRef = useRef(null);
  const [printing, setPrinting] = useState(null);
  const cfg = getPrinterConfig();
  const width = cfg.width || 80;

  const isLocal = ticket.ticket_number?.startsWith("LOCAL-");

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
      <DialogContent className="bg-white text-black border-white max-w-md p-0 max-h-[95vh] overflow-y-auto" data-testid="ticket-print-modal">
        <DialogTitle className="sr-only">Ticket {ticket.ticket_number}</DialogTitle>
        <div ref={printRef} className="print-area ticket-print" id="printable">
          <div className="text-center border-b-2 border-dashed border-black pb-3">
            <div className="text-2xl font-black tracking-tight">{settings?.business_name || "TOP LOTTO"}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1">{settings?.business_address}</div>
            <div className="text-[10px]">{settings?.business_phone}</div>
          </div>

          <div className="py-3 text-xs space-y-1 border-b border-dashed border-black">
            <div className="flex justify-between"><span>TIKÈ:</span><b>{ticket.ticket_number}</b></div>
            <div className="flex justify-between"><span>DAT:</span><span>{new Date(ticket.created_at || Date.now()).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>LOTRI:</span><b>{ticket.lottery_name}</b></div>
            <div className="flex justify-between"><span>TIRAJ:</span><span>{ticket.draw_date}</span></div>
            <div className="flex justify-between"><span>MACHANN:</span><span>{ticket.machann_name}</span></div>
            {ticket.customer_name && <div className="flex justify-between"><span>KLIYAN:</span><span>{ticket.customer_name}</span></div>}
            {isLocal && <div className="text-center font-bold mt-1">[OFFLINE — Senkwonize lè konekte]</div>}
          </div>

          <div className="py-3 border-b border-dashed border-black">
            <div className="text-center text-xs font-bold uppercase tracking-widest mb-2">JWÈT</div>
            {ticket.items.map((it, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5 items-center">
                <span className="flex items-center gap-1">
                  {GAME_LABELS[it.game]}
                  <b className="ml-1">{it.number}</b>
                  {it.winning && (
                    <span className="text-[9px] font-bold ml-1 px-1 border border-black">
                      ★{it.game === "bolet" ? ["", "1ye", "2yèm", "3yèm"][it.win_position] : "GENYEN"}
                    </span>
                  )}
                </span>
                <span className="font-bold">{(it.line_total ?? it.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {hasResult && ticket.result && (
            <div className="py-2 border-b border-dashed border-black text-[10px]">
              <div className="text-center font-bold uppercase tracking-widest mb-1">REZILTA</div>
              {ticket.result.bolet?.filter(Boolean).length > 0 && (
                <div>BÒLÈT: {(ticket.result.bolet || []).map((b, i) => b ? `${["1ye", "2yèm", "3yèm"][i]}=${b}` : "").filter(Boolean).join(" | ")}</div>
              )}
              {ticket.result.pick3 && <div>P3: {ticket.result.pick3}</div>}
              {ticket.result.pick4 && <div>P4: {ticket.result.pick4}</div>}
              {ticket.result.pick5 && <div>P5: {ticket.result.pick5}</div>}
            </div>
          )}

          <div className="py-3 text-sm">
            <div className="flex justify-between font-black text-base">
              <span>TOTAL ({currency}):</span>
              <span>{currencySymbol} {Number(total).toFixed(2)}</span>
            </div>
          </div>

          {ticket.payout_amount > 0 && (
            <div className="py-2 border-t-2 border-dashed border-black text-center">
              <div className="text-sm font-black">★ GENYEN ★</div>
              <div className="text-xl font-black">{currencySymbol} {Number(ticket.payout_amount).toFixed(2)}</div>
              {ticket.paid && <div className="text-xs">[ PEYE ]</div>}
            </div>
          )}

          <div className="pt-3 text-center border-t border-dashed border-black">
            <div className="my-2" style={{ lineHeight: 0 }}>{barcode}</div>
            <div className="font-mono text-[10px]">{ticket.ticket_number}</div>
            <div className="text-[10px] mt-2 italic">{settings?.ticket_footer}</div>
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
          </div>
          <Button onClick={onClose} variant="ghost" data-testid="print-close" className="w-full text-zinc-700">
            <X className="w-4 h-4 mr-2" /> {t("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
