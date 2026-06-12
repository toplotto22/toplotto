import React, { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { useApp } from "@/lib/context";
import { GAMES, PLAY_TYPE_LABELS } from "@/lib/i18n";

export default function TicketPrint({ ticket, onClose }) {
  const { t, settings, formatMoney } = useApp();
  const printRef = useRef(null);

  const handlePrint = () => {
    window.print();
  };

  // simple barcode visual from ticket_number
  const barcode = ticket.ticket_number.split("").map((c, i) => (
    <div key={i} style={{ width: c === "0" ? 3 : 2, height: 30, background: "black", display: "inline-block", marginRight: 1 }} />
  ));

  const total = ticket.total || ticket.items?.reduce((s, it) => s + (it.line_total || it.amount), 0) || 0;

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white text-black border-white max-w-md p-0" data-testid="ticket-print-modal">
        <div ref={printRef} className="print-area ticket-print" id="printable">
          <div className="text-center border-b-2 border-dashed border-black pb-3">
            <div className="text-2xl font-black tracking-tight">{settings?.business_name || "TOP LOTTO"}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1">{settings?.business_address}</div>
            <div className="text-[10px]">{settings?.business_phone}</div>
          </div>

          <div className="py-3 text-xs space-y-1 border-b border-dashed border-black">
            <div className="flex justify-between"><span>TICKET:</span><b>{ticket.ticket_number}</b></div>
            <div className="flex justify-between"><span>DATE:</span><span>{new Date(ticket.created_at || Date.now()).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>{t("lottery").toUpperCase()}:</span><b>{ticket.lottery_name}</b></div>
            <div className="flex justify-between"><span>{t("drawDate").toUpperCase()}:</span><span>{ticket.draw_date}</span></div>
            <div className="flex justify-between"><span>MACHANN:</span><span>{ticket.machann_name}</span></div>
            {ticket.customer_name && <div className="flex justify-between"><span>{t("customer").toUpperCase()}:</span><span>{ticket.customer_name}</span></div>}
          </div>

          <div className="py-3 border-b border-dashed border-black">
            <div className="text-center text-xs font-bold uppercase tracking-widest mb-2">JEUX</div>
            {ticket.items.map((it, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5">
                <span>
                  {GAMES.find((g) => g.value === it.game)?.label} {PLAY_TYPE_LABELS[it.play_type]}
                  <b className="ml-1">{it.number}</b>
                </span>
                <span className="font-bold">{(it.line_total ?? it.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="py-3 text-sm">
            <div className="flex justify-between font-black text-base">
              <span>TOTAL ({ticket.currency}):</span>
              <span>{Number(total).toFixed(2)}</span>
            </div>
          </div>

          {ticket.payout_amount > 0 && (
            <div className="py-2 border-t border-dashed border-black text-center">
              <div className="text-sm font-black">★ {t("winning").toUpperCase()} ★</div>
              <div className="text-xl font-black">{Number(ticket.payout_amount).toFixed(2)} {ticket.currency}</div>
              {ticket.paid && <div className="text-xs">[ {t("paid").toUpperCase()} ]</div>}
            </div>
          )}

          <div className="pt-3 text-center border-t border-dashed border-black">
            <div className="my-2" style={{ lineHeight: 0 }}>{barcode}</div>
            <div className="font-mono text-[10px]">{ticket.ticket_number}</div>
            <div className="text-[10px] mt-2 italic">{settings?.ticket_footer}</div>
          </div>
        </div>

        <div className="no-print flex gap-2 p-3 border-t bg-zinc-100">
          <Button onClick={handlePrint} data-testid="print-confirm" className="flex-1 bg-black text-white hover:bg-zinc-800">
            <Printer className="w-4 h-4 mr-2" /> {t("printTicket")}
          </Button>
          <Button onClick={onClose} variant="outline" data-testid="print-close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
