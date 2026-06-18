import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Search, Eye, Edit2, Trash2, Ban, Trash, Filter as FilterIcon, AlertTriangle } from "lucide-react";
import TicketPrint from "@/components/TicketPrint";
import { toast } from "sonner";
import { GAME_LABELS } from "@/lib/i18n";

const STATUS_COLORS = {
  won: "bg-green-500/10 text-green-400 border-green-500/30",
  lost: "bg-red-500/10 text-red-400 border-red-500/30",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  active: "bg-zinc-800 text-zinc-400 border-white/5",
};

const statusOf = (tk) => {
  if (tk.paid) return "paid";
  if (tk.status === "cancelled") return "cancelled";
  if (tk.status === "won") return "won";
  if (tk.status === "lost") return "lost";
  return "active";
};

const STATUS_LABEL = {
  won: "Gagné",
  lost: "Perdu",
  paid: "Payé",
  cancelled: "Annulé",
  active: "En attente",
};

export default function Tickets() {
  const { t, formatMoney, user, lotteries } = useApp();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [lotteryFilter, setLotteryFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [bulkDate, setBulkDate] = useState("");

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  const load = async () => {
    const { data } = await api.get("/tickets?limit=500");
    setTickets(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return tickets.filter((tk) => {
      if (search) {
        const s = search.toLowerCase();
        const match = tk.ticket_number?.toLowerCase().includes(s) ||
          tk.customer_name?.toLowerCase().includes(s) ||
          tk.machann_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (statusFilter !== "all" && statusOf(tk) !== statusFilter) return false;
      if (lotteryFilter !== "all" && tk.lottery_id !== lotteryFilter) return false;
      if (sessionFilter !== "all") {
        const lot = lotteries.find((l) => l.id === tk.lottery_id);
        if (!lot || lot.session !== sessionFilter) return false;
      }
      if (dateFilter && tk.draw_date !== dateFilter) return false;
      return true;
    });
  }, [tickets, search, statusFilter, lotteryFilter, sessionFilter, dateFilter, lotteries]);

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

  const deleteAll = async () => {
    try {
      const { data } = await api.delete(`/tickets/bulk/all`);
      toast.success(`${data.deleted} ticket(s) supprimés`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const deleteByDate = async () => {
    if (!bulkDate) { toast.error("Choisir une date"); return; }
    try {
      const { data } = await api.delete(`/tickets/bulk/by-date?draw_date=${bulkDate}`);
      toast.success(`${data.deleted} ticket(s) supprimés pour ${bulkDate}`);
      setBulkDate("");
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

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setLotteryFilter("all");
    setSessionFilter("all"); setDateFilter("");
  };

  return (
    <div className="space-y-4" data-testid="tickets-page">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("tickets")}</h1>
        <span className="text-xs text-zinc-500 font-mono">{filtered.length} / {tickets.length}</span>
      </div>

      {/* Filters */}
      <Card className="bg-[#121214] border-white/5 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-yellow-400 font-bold">
          <FilterIcon className="w-3.5 h-3.5" /> Filtres
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Label className="text-[10px] uppercase text-zinc-500">Recherche</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="N° / client / machann"
                data-testid="tickets-search"
                className="bg-zinc-900 border-white/10 pl-8 h-9 font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-zinc-500">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="filter-status" className="bg-zinc-900 border-white/10 h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">En attente</SelectItem>
                <SelectItem value="won">Gagné</SelectItem>
                <SelectItem value="lost">Perdu</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-zinc-500">Loterie</Label>
            <Select value={lotteryFilter} onValueChange={setLotteryFilter}>
              <SelectTrigger data-testid="filter-lottery" className="bg-zinc-900 border-white/10 h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-72">
                <SelectItem value="all">Toutes</SelectItem>
                {lotteries.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-zinc-500">Tirage</Label>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger data-testid="filter-session" className="bg-zinc-900 border-white/10 h-9 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="midday">Midi</SelectItem>
                <SelectItem value="evening">Soir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-zinc-500">Date tirage</Label>
            <Input type="date" data-testid="filter-date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="bg-zinc-900 border-white/10 h-9 mt-1 font-mono text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={clearFilters} variant="ghost" className="h-8 text-xs text-zinc-400 hover:text-white">
            Effacer filtres
          </Button>
          {isSuperAdmin && (
            <>
              <div className="flex-1" />
              <div className="flex items-center gap-2 flex-wrap">
                <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
                  className="bg-zinc-900 border-white/10 h-8 font-mono text-xs w-36" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" data-testid="bulk-delete-by-date"
                      className="h-8 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 border border-orange-500/30 text-xs">
                      <Trash className="w-3.5 h-3.5 mr-1" /> Suppr. par jour
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer tous les tickets du {bulkDate || "..."}</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Action irréversible. Tous les tickets ayant cette date de tirage seront définitivement supprimés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-800 border-white/10">{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteByDate} className="bg-orange-500 hover:bg-orange-600 text-black font-bold">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" data-testid="bulk-delete-all"
                      className="h-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Suppr. TOUT
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-400">⚠ Supprimer TOUS les tickets</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Action irréversible. <strong>TOUS les tickets et paiements seront définitivement supprimés.</strong> Confirmez-vous ?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-800 border-white/10">{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteAll} className="bg-red-600 hover:bg-red-700 text-white font-bold">
                        Tout supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Desktop table */}
      <Card className="bg-[#121214] border-white/5 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold bg-[#1A1A1E] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4">{t("ticketNo")}</th>
                <th className="text-left py-3 px-4">{t("lottery")}</th>
                <th className="text-left py-3 px-4">{t("drawDate")}</th>
                <th className="text-left py-3 px-4">{t("machann")}</th>
                <th className="text-right py-3 px-4">{t("total")}</th>
                <th className="text-right py-3 px-4">Gain</th>
                <th className="text-center py-3 px-4">{t("status")}</th>
                <th className="text-center py-3 px-4">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-zinc-600">{t("noTickets")}</td></tr>
              )}
              {filtered.map((tk) => {
                const st = statusOf(tk);
                return (
                  <tr key={tk.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono font-bold text-yellow-400">{tk.ticket_number}</td>
                    <td className="py-3 px-4">{tk.lottery_name}</td>
                    <td className="py-3 px-4 font-mono">{tk.draw_date}</td>
                    <td className="py-3 px-4 text-zinc-400">{tk.machann_name}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{formatMoney(tk.total)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${tk.payout_amount > 0 ? "text-green-400" : "text-zinc-600"}`}>
                      {tk.payout_amount > 0 ? formatMoney(tk.payout_amount) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${STATUS_COLORS[st]}`}>
                        {STATUS_LABEL[st]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost"
                          data-testid={`ticket-view-${tk.ticket_number}`}
                          onClick={() => openTicket(tk.ticket_number)}
                          className="text-yellow-400 hover:bg-yellow-400/10 h-7 w-7 p-0">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {isSuperAdmin && tk.status !== "cancelled" && (
                          <Button size="sm" variant="ghost"
                            data-testid={`ticket-edit-${tk.ticket_number}`}
                            onClick={() => openEdit(tk.ticket_number)}
                            className="text-blue-400 hover:bg-blue-400/10 h-7 w-7 p-0">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isAdmin && tk.status !== "cancelled" && (
                          <CancelBtn tk={tk} onConfirm={cancelTicket} t={t} />
                        )}
                        {isSuperAdmin && (
                          <DeleteBtn tk={tk} onConfirm={deleteTicket} t={t} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <Card className="bg-[#121214] border-white/5 p-8 text-center text-zinc-600">{t("noTickets")}</Card>
        )}
        {filtered.map((tk) => {
          const st = statusOf(tk);
          return (
            <Card key={tk.id} className="bg-[#121214] border-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-yellow-400 text-sm">{tk.ticket_number}</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${STATUS_COLORS[st]}`}>
                  {STATUS_LABEL[st]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div><span className="text-zinc-500">Loterie:</span> <span className="text-white">{tk.lottery_name}</span></div>
                <div><span className="text-zinc-500">Tirage:</span> <span className="font-mono">{tk.draw_date}</span></div>
                <div className="col-span-2"><span className="text-zinc-500">Machann:</span> <span className="text-zinc-300">{tk.machann_name}</span></div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="space-y-0.5">
                  <div className="text-[10px] text-zinc-500 uppercase">Total</div>
                  <div className="font-mono font-bold">{formatMoney(tk.total)}</div>
                </div>
                {tk.payout_amount > 0 && (
                  <div className="space-y-0.5 text-right">
                    <div className="text-[10px] text-green-500/70 uppercase">Gain</div>
                    <div className="font-mono font-bold text-green-400">{formatMoney(tk.payout_amount)}</div>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost"
                    data-testid={`ticket-view-m-${tk.ticket_number}`}
                    onClick={() => openTicket(tk.ticket_number)}
                    className="text-yellow-400 hover:bg-yellow-400/10 h-8 w-8 p-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                  {isSuperAdmin && tk.status !== "cancelled" && (
                    <Button size="sm" variant="ghost"
                      onClick={() => openEdit(tk.ticket_number)}
                      className="text-blue-400 hover:bg-blue-400/10 h-8 w-8 p-0">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                  {isAdmin && tk.status !== "cancelled" && (
                    <CancelBtn tk={tk} onConfirm={cancelTicket} t={t} mobile />
                  )}
                  {isSuperAdmin && (
                    <DeleteBtn tk={tk} onConfirm={deleteTicket} t={t} mobile />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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

function CancelBtn({ tk, onConfirm, t, mobile }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost"
          data-testid={`ticket-cancel-${tk.ticket_number}`}
          className={`text-orange-400 hover:bg-orange-400/10 ${mobile ? "h-8 w-8" : "h-7 w-7"} p-0`}>
          <Ban className={mobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </Button>
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
          <AlertDialogAction onClick={() => onConfirm(tk.ticket_number)} className="bg-orange-500 hover:bg-orange-600 text-black font-bold">
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteBtn({ tk, onConfirm, t, mobile }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost"
          data-testid={`ticket-delete-${tk.ticket_number}`}
          className={`text-red-400 hover:bg-red-400/10 ${mobile ? "h-8 w-8" : "h-7 w-7"} p-0`}>
          <Trash className={mobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
        </Button>
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
          <AlertDialogAction onClick={() => onConfirm(tk.ticket_number)} className="bg-red-500 hover:bg-red-600 text-white font-bold">
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
