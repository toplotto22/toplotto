import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Search, Eye, Edit2, Trash2, Ban, Trash } from "lucide-react";
import TicketPrint from "@/components/TicketPrint";
import { toast } from "sonner";
import { GAME_LABELS } from "@/lib/i18n";

export default function Tickets() {
  const { t, formatMoney, user } = useApp();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  const load = async () => {
    const { data } = await api.get("/tickets");
    setTickets(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = tickets.filter((tk) =>
    !search ||
    tk.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
    tk.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    tk.machann_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openTicket = async (num) => {
    const { data } = await api.get(`/tickets/${num}`);
    setView(data);
  };

  const cancelTicket = async (num) => {
    try {
      await api.delete(`/tickets/${num}`);
      toast.success(t("success"));
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const deleteTicket = async (num) => {
    try {
      await api.delete(`/tickets/${num}?hard=true`);
      toast.success(t("success"));
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const openEdit = async (num) => {
    const { data } = await api.get(`/tickets/${num}`);
    setEdit({
      ...data,
      itemsEdit: data.items.map((it) => ({ ...it })),
    });
  };

  const saveEdit = async () => {
    try {
      await api.put(`/tickets/${edit.ticket_number}`, {
        items: edit.itemsEdit.map((it) => ({
          game: it.game, number: it.number, amount: parseFloat(it.amount) || 0,
        })),
        customer_name: edit.customer_name,
      });
      toast.success(t("success"));
      setEdit(null);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="tickets-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("tickets")}</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("quickSearch")}
            data-testid="tickets-search"
            className="bg-zinc-900 border-white/10 pl-10 w-full sm:w-72 h-10 font-mono"
          />
        </div>
      </div>

      <Card className="bg-[#121214] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold bg-[#1A1A1E] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4">{t("ticketNo")}</th>
                <th className="text-left py-3 px-4 hidden sm:table-cell">{t("lottery")}</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">{t("drawDate")}</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">{t("machann")}</th>
                <th className="text-right py-3 px-4">{t("total")}</th>
                <th className="text-center py-3 px-4">{t("status")}</th>
                <th className="text-center py-3 px-4">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-600">{t("noTickets")}</td></tr>
              )}
              {filtered.map((tk) => (
                <tr key={tk.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono font-bold text-yellow-400">{tk.ticket_number}</td>
                  <td className="py-3 px-4 hidden sm:table-cell">{tk.lottery_name}</td>
                  <td className="py-3 px-4 font-mono hidden md:table-cell">{tk.draw_date}</td>
                  <td className="py-3 px-4 text-zinc-400 hidden md:table-cell">{tk.machann_name}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">{formatMoney(tk.total)}</td>
                  <td className="py-3 px-4 text-center">
                    {tk.paid ? (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">{t("paid")}</span>
                    ) : tk.status === "cancelled" ? (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-red-500/10 text-red-400 border border-red-500/20">{t("cancelled")}</span>
                    ) : (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-zinc-800 text-zinc-400 border border-white/5">{t("pending")}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm" variant="ghost"
                        data-testid={`ticket-view-${tk.ticket_number}`}
                        onClick={() => openTicket(tk.ticket_number)}
                        className="text-yellow-400 hover:bg-yellow-400/10 h-7 w-7 p-0"
                      ><Eye className="w-3.5 h-3.5" /></Button>
                      {isSuperAdmin && tk.status !== "cancelled" && (
                        <Button
                          size="sm" variant="ghost"
                          data-testid={`ticket-edit-${tk.ticket_number}`}
                          onClick={() => openEdit(tk.ticket_number)}
                          className="text-blue-400 hover:bg-blue-400/10 h-7 w-7 p-0"
                        ><Edit2 className="w-3.5 h-3.5" /></Button>
                      )}
                      {isAdmin && tk.status !== "cancelled" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"
                              data-testid={`ticket-cancel-${tk.ticket_number}`}
                              className="text-orange-400 hover:bg-orange-400/10 h-7 w-7 p-0"
                            ><Ban className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("cancelTicket")}</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                {tk.ticket_number} — {t("confirmDelete")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-zinc-800 border-white/10">{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelTicket(tk.ticket_number)}
                                className="bg-orange-500 hover:bg-orange-600 text-black font-bold"
                              >{t("confirm")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {isSuperAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"
                              data-testid={`ticket-delete-${tk.ticket_number}`}
                              className="text-red-400 hover:bg-red-400/10 h-7 w-7 p-0"
                            ><Trash className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("deleteTicket")}</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                {tk.ticket_number} — Action irréversible. {t("confirmDelete")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-zinc-800 border-white/10">{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTicket(tk.ticket_number)}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold"
                              >{t("confirm")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {view && <TicketPrint ticket={view} onClose={() => { setView(null); load(); }} />}

      {edit && (
        <Dialog open={true} onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent className="bg-[#121214] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editTicket")} — <span className="font-mono text-yellow-400">{edit.ticket_number}</span></DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("customer")}</Label>
                <Input
                  data-testid="edit-ticket-customer"
                  value={edit.customer_name || ""}
                  onChange={(e) => setEdit({ ...edit, customer_name: e.target.value })}
                  className="bg-zinc-900 border-white/10 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("game")}s</Label>
                <div className="space-y-2 mt-1">
                  {edit.itemsEdit.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-900 p-2 rounded">
                      <span className="text-[10px] uppercase font-bold w-16 text-yellow-400">{GAME_LABELS[it.game]}</span>
                      <Input
                        data-testid={`edit-item-number-${i}`}
                        value={it.number}
                        onChange={(e) => {
                          const next = [...edit.itemsEdit];
                          next[i].number = e.target.value;
                          setEdit({ ...edit, itemsEdit: next });
                        }}
                        className="bg-zinc-800 border-white/10 h-9 font-mono text-center w-24"
                      />
                      <Input
                        data-testid={`edit-item-amount-${i}`}
                        value={it.amount}
                        type="number"
                        onChange={(e) => {
                          const next = [...edit.itemsEdit];
                          next[i].amount = e.target.value;
                          setEdit({ ...edit, itemsEdit: next });
                        }}
                        className="bg-zinc-800 border-white/10 h-9 font-mono text-right flex-1"
                      />
                      <button
                        onClick={() => setEdit({ ...edit, itemsEdit: edit.itemsEdit.filter((_, idx) => idx !== i) })}
                        className="text-red-400 hover:bg-red-500/10 p-1 rounded"
                      ><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <Button data-testid="edit-ticket-save" onClick={saveEdit} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold">
                {t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
