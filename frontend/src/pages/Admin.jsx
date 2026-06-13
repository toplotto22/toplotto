import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useApp } from "@/lib/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ROLES } from "@/lib/i18n";
import { toast } from "sonner";
import { UserPlus, Building2, Save, Edit2, Trash2, Printer as PrinterIcon, Download, Loader2 } from "lucide-react";
import { getPrinterConfig, setPrinterConfig } from "@/lib/printer";

const initialUser = { email: "", password: "", name: "", role: "machann", agency_id: "", phone: "", commission_percent: "" };
const initialAgency = { name: "", address: "", phone: "" };

export default function Admin() {
  const { t, lang, refreshSettings, user: currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [settings, setSettings] = useState(null);
  const [userForm, setUserForm] = useState(initialUser);
  const [agencyForm, setAgencyForm] = useState(initialAgency);
  const [openUser, setOpenUser] = useState(false);
  const [openAgency, setOpenAgency] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [printerCfg, setPrinterCfgState] = useState(getPrinterConfig());
  const [importing, setImporting] = useState(false);
  const { lotteries, refreshLotteries } = useApp();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const importResults = async () => {
    setImporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await api.post(`/results/import?date=${today}`);
      toast.success(`${data.imported} loteries importées`);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("error"));
    } finally { setImporting(false); }
  };

  const updateLottery = async (lid, fields) => {
    try {
      await api.put(`/lotteries/${lid}`, fields);
      toast.success(t("success"));
      refreshLotteries();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const load = async () => {
    const [u, a, s] = await Promise.all([
      api.get("/users"), api.get("/agencies"), api.get("/settings"),
    ]);
    setUsers(u.data); setAgencies(a.data); setSettings(s.data);
  };
  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", { ...userForm, agency_id: userForm.agency_id || null });
      toast.success(t("success"));
      setUserForm(initialUser); setOpenUser(false); load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const createAgency = async (e) => {
    e.preventDefault();
    try {
      await api.post("/agencies", agencyForm);
      toast.success(t("success"));
      setAgencyForm(initialAgency); setOpenAgency(false); load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const updateUserField = async (uid, fields) => {
    try {
      await api.put(`/users/${uid}`, fields);
      toast.success(t("success"));
      load();
      setEditingUser(null);
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const deactivateUser = async (uid) => {
    try {
      await api.delete(`/users/${uid}`);
      toast.success(t("success"));
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const deleteUser = async (uid) => {
    try {
      await api.delete(`/users/${uid}?hard=true`);
      toast.success(t("success"));
      load();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const savePrinterCfg = () => {
    setPrinterConfig(printerCfg);
    toast.success(t("success"));
  };

  const saveSettings = async () => {
    try {
      await api.put("/settings", settings);
      toast.success(t("success"));
      refreshSettings();
    } catch (err) { toast.error(err.response?.data?.detail || t("error")); }
  };

  const setBoletPayout = (key, val) => {
    setSettings({
      ...settings,
      payouts: {
        ...settings.payouts,
        bolet: { ...(settings.payouts?.bolet || {}), [key]: parseFloat(val) || 0 },
      },
    });
  };

  const setPickPayout = (game, val) => {
    setSettings({
      ...settings,
      payouts: { ...settings.payouts, [game]: parseFloat(val) || 0 },
    });
  };

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="admin-page">
      <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">{t("settings")}</h1>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-zinc-900 border border-white/5 flex-wrap h-auto">
          <TabsTrigger value="users" data-testid="tab-users" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            {t("users")}
          </TabsTrigger>
          <TabsTrigger value="agencies" data-testid="tab-agencies" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            {t("agencies")}
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            {t("settings")}
          </TabsTrigger>
          <TabsTrigger value="printer" data-testid="tab-printer" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            {t("printer")}
          </TabsTrigger>
          <TabsTrigger value="lotteries" data-testid="tab-lotteries" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
            {t("lotteries")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="bg-[#121214] border-white/5 p-4 sm:p-5">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("users")}</h3>
              <Dialog open={openUser} onOpenChange={setOpenUser}>
                <DialogTrigger asChild>
                  <Button data-testid="add-user-btn" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold">
                    <UserPlus className="w-4 h-4 mr-2" /> {t("addUser")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#121214] border-white/10 text-white max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{t("addUser")}</DialogTitle></DialogHeader>
                  <form onSubmit={createUser} className="space-y-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("name")}</Label>
                      <Input data-testid="user-form-name" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("email")}</Label>
                      <Input data-testid="user-form-email" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="bg-zinc-900 border-white/10 mt-1 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("password")}</Label>
                      <Input data-testid="user-form-password" type="text" required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="bg-zinc-900 border-white/10 mt-1 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("role")}</Label>
                      <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                        <SelectTrigger data-testid="user-form-role" className="bg-zinc-900 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="focus:bg-yellow-400/10 focus:text-yellow-400">
                              {lang === "ht" ? r.labelHt : r.labelFr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("agency")}</Label>
                      <Select value={userForm.agency_id || "none"} onValueChange={(v) => setUserForm({ ...userForm, agency_id: v === "none" ? "" : v })}>
                        <SelectTrigger data-testid="user-form-agency" className="bg-zinc-900 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                          <SelectItem value="none">—</SelectItem>
                          {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("commission")}</Label>
                      <Input
                        data-testid="user-form-commission"
                        type="number" step="0.1"
                        value={userForm.commission_percent}
                        onChange={(e) => setUserForm({ ...userForm, commission_percent: e.target.value })}
                        placeholder="0"
                        className="bg-zinc-900 border-white/10 mt-1 font-mono"
                      />
                    </div>
                    <Button data-testid="user-form-submit" type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold">{t("create")}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/10">
                  <tr>
                    <th className="text-left py-2">{t("name")}</th>
                    <th className="text-left py-2 hidden sm:table-cell">{t("email")}</th>
                    <th className="text-left py-2">{t("role")}</th>
                    <th className="text-center py-2">{t("active")}</th>
                    {isSuperAdmin && <th className="text-center py-2">{t("actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-2.5 font-bold">{u.name}</td>
                      <td className="py-2.5 font-mono text-zinc-400 truncate max-w-[180px] hidden sm:table-cell">{u.email}</td>
                      <td className="py-2.5">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-zinc-800 rounded font-bold">{u.role}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {u.active ? <span className="text-green-400">●</span> : <span className="text-red-400">●</span>}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm" variant="ghost"
                              data-testid={`user-edit-${u.id}`}
                              onClick={() => setEditingUser({ ...u, password: "" })}
                              className="text-blue-400 hover:bg-blue-400/10 h-7 w-7 p-0"
                            ><Edit2 className="w-3.5 h-3.5" /></Button>
                            {u.active && (
                              <Button
                                size="sm" variant="ghost"
                                data-testid={`user-deactivate-${u.id}`}
                                onClick={() => deactivateUser(u.id)}
                                className="text-orange-400 hover:bg-orange-400/10 h-7 w-7 p-0"
                                title={t("deactivateUser")}
                              >●</Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm" variant="ghost"
                                  data-testid={`user-delete-${u.id}`}
                                  className="text-red-400 hover:bg-red-400/10 h-7 w-7 p-0"
                                  title={t("deleteUser")}
                                ><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("deleteUser")}</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">
                                    {u.name} ({u.email}) — {t("confirmDelete")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-800 border-white/10">{t("cancel")}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(u.id)}
                                    className="bg-red-500 hover:bg-red-600 text-white font-bold"
                                  >{t("confirm")}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="agencies" className="mt-4">
          <Card className="bg-[#121214] border-white/5 p-4 sm:p-5">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("agencies")}</h3>
              <Dialog open={openAgency} onOpenChange={setOpenAgency}>
                <DialogTrigger asChild>
                  <Button data-testid="add-agency-btn" className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold">
                    <Building2 className="w-4 h-4 mr-2" /> {t("addAgency")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#121214] border-white/10 text-white">
                  <DialogHeader><DialogTitle>{t("addAgency")}</DialogTitle></DialogHeader>
                  <form onSubmit={createAgency} className="space-y-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("name")}</Label>
                      <Input data-testid="agency-form-name" required value={agencyForm.name} onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("address")}</Label>
                      <Input value={agencyForm.address} onChange={(e) => setAgencyForm({ ...agencyForm, address: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("phone")}</Label>
                      <Input value={agencyForm.phone} onChange={(e) => setAgencyForm({ ...agencyForm, phone: e.target.value })} className="bg-zinc-900 border-white/10 mt-1 font-mono" />
                    </div>
                    <Button data-testid="agency-form-submit" type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold">{t("create")}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agencies.map((a) => (
                <div key={a.id} className="p-4 bg-zinc-900/50 border border-white/5 rounded-md">
                  <div className="font-bold">{a.name}</div>
                  <div className="text-xs text-zinc-500 mt-1">{a.address || "—"}</div>
                  <div className="text-xs font-mono text-zinc-400 mt-1">{a.phone}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {settings && (
            <div className="space-y-4">
              <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("businessInfo")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("business")}</Label>
                    <Input data-testid="settings-business-name" value={settings.business_name || ""} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("phone")}</Label>
                    <Input value={settings.business_phone || ""} onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })} className="bg-zinc-900 border-white/10 mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("address")}</Label>
                    <Input value={settings.business_address || ""} onChange={(e) => setSettings({ ...settings, business_address: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("email")}</Label>
                    <Input value={settings.business_email || ""} onChange={(e) => setSettings({ ...settings, business_email: e.target.value })} className="bg-zinc-900 border-white/10 mt-1 font-mono" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs uppercase text-zinc-400">{t("ticketFooter")}</Label>
                    <Input value={settings.ticket_footer || ""} onChange={(e) => setSettings({ ...settings, ticket_footer: e.target.value })} className="bg-zinc-900 border-white/10 mt-1" />
                  </div>
                </div>
              </Card>

              <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("payoutRates")} — BÒLÈT</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["premye", t("premye"), "text-yellow-400"],
                    ["dezyem", t("dezyem"), "text-green-400"],
                    ["twazyem", t("twazyem"), "text-blue-400"],
                    ["mariage", t("mariageRate"), "text-pink-400"],
                  ].map(([key, label, color]) => (
                    <div key={key}>
                      <Label className={`text-[10px] uppercase tracking-wider font-bold ${color}`}>{label}</Label>
                      <Input
                        data-testid={`payout-bolet-${key}`}
                        type="number" step="0.01"
                        value={settings.payouts?.bolet?.[key] ?? ""}
                        onChange={(e) => setBoletPayout(key, e.target.value)}
                        className="bg-zinc-900 border-white/10 h-11 mt-1 font-mono text-lg text-center"
                      />
                      <div className="text-[10px] text-zinc-500 mt-1 text-center">× mise</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("payoutRates")} — PICK</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    ["pick3", t("pickThree")],
                    ["pick4", t("pickFour")],
                    ["pick5", t("pickFive")],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{label}</Label>
                      <Input
                        data-testid={`payout-${key}`}
                        type="number" step="0.01"
                        value={typeof settings.payouts?.[key] === "number" ? settings.payouts[key] : ""}
                        onChange={(e) => setPickPayout(key, e.target.value)}
                        className="bg-zinc-900 border-white/10 h-11 mt-1 font-mono text-lg text-center"
                      />
                      <div className="text-[10px] text-zinc-500 mt-1 text-center">× mise</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Button data-testid="settings-save" onClick={saveSettings} className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold">
                <Save className="w-4 h-4 mr-2" /> {t("saveSettings")}
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="printer" className="mt-4">
          <Card className="bg-[#121214] border-white/5 p-4 sm:p-5 space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
              <PrinterIcon className="w-4 h-4" /> {t("printerConfig")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("printerType")}</Label>
                <Select
                  value={printerCfg.type || "browser"}
                  onValueChange={(v) => setPrinterCfgState({ ...printerCfg, type: v })}
                >
                  <SelectTrigger data-testid="printer-type" className="bg-zinc-900 border-white/10 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white">
                    <SelectItem value="browser" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("printerBrowser")}</SelectItem>
                    <SelectItem value="bluetooth" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("printerBluetooth")}</SelectItem>
                    <SelectItem value="webserial" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("printerSerial")}</SelectItem>
                    <SelectItem value="network" className="focus:bg-yellow-400/10 focus:text-yellow-400">{t("printerNetwork")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("printerWidth")}</Label>
                <Select
                  value={String(printerCfg.width || 80)}
                  onValueChange={(v) => setPrinterCfgState({ ...printerCfg, width: parseInt(v) })}
                >
                  <SelectTrigger data-testid="printer-width" className="bg-zinc-900 border-white/10 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white">
                    <SelectItem value="58">58 mm</SelectItem>
                    <SelectItem value="80">80 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {printerCfg.type === "network" && (
                <>
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("printerIp")}</Label>
                    <Input
                      data-testid="printer-ip"
                      value={printerCfg.printer_ip || ""}
                      onChange={(e) => setPrinterCfgState({ ...printerCfg, printer_ip: e.target.value })}
                      placeholder="192.168.1.100"
                      className="bg-zinc-900 border-white/10 mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-zinc-400">{t("printerPort")}</Label>
                    <Input
                      data-testid="printer-port"
                      type="number"
                      value={printerCfg.printer_port || 9100}
                      onChange={(e) => setPrinterCfgState({ ...printerCfg, printer_port: parseInt(e.target.value) })}
                      placeholder="9100"
                      className="bg-zinc-900 border-white/10 mt-1 font-mono"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded border border-white/5">
              <b className="text-yellow-400 uppercase">{t("printerBluetooth")}</b>: Compatible imprimantes BT GATT (PT-210, MTP-II, etc.)<br/>
              <b className="text-yellow-400 uppercase">{t("printerSerial")}</b>: Chrome/Edge uniquement — imprimante USB connectée<br/>
              <b className="text-yellow-400 uppercase">{t("printerNetwork")}</b>: Imprimante Wi-Fi/Ethernet à IP fixe, port 9100 (Epson, Star, etc.)<br/>
              <b className="text-yellow-400 uppercase">{t("printerBrowser")}</b>: Impression standard HTML
            </div>
            <Button
              data-testid="printer-save"
              onClick={savePrinterCfg}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold"
            >
              <Save className="w-4 h-4 mr-2" /> {t("save")}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="lotteries" className="mt-4">
          <Card className="bg-[#121214] border-white/5 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm uppercase tracking-wider text-zinc-400 font-bold">{t("lotteries")} — Horaires & API</h3>
              <Button
                data-testid="import-results"
                onClick={importResults}
                disabled={importing}
                className="bg-green-500 hover:bg-green-600 text-black font-bold"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                {t("importApi")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-white/10">
                  <tr>
                    <th className="text-left py-2">{t("lottery")}</th>
                    <th className="text-center py-2">{t("drawTime")}</th>
                    <th className="text-center py-2 hidden sm:table-cell">{t("timezone")}</th>
                    <th className="text-center py-2 hidden md:table-cell">{t("closeOffset")}</th>
                    <th className="text-center py-2 hidden md:table-cell">API ID P3 / P4</th>
                  </tr>
                </thead>
                <tbody>
                  {lotteries.map((l) => (
                    <tr key={l.id} className="border-b border-white/5">
                      <td className="py-2.5 font-bold">{l.name}</td>
                      <td className="py-2.5 text-center">
                        <Input
                          data-testid={`lottery-time-${l.code}`}
                          type="time"
                          defaultValue={l.local_time}
                          disabled={!isSuperAdmin}
                          onBlur={(e) => e.target.value !== l.local_time && updateLottery(l.id, { local_time: e.target.value })}
                          className="bg-zinc-900 border-white/10 h-9 font-mono text-center w-24 mx-auto"
                        />
                      </td>
                      <td className="py-2.5 text-center text-xs text-zinc-400 font-mono hidden sm:table-cell">{l.timezone}</td>
                      <td className="py-2.5 text-center hidden md:table-cell">
                        <Input
                          data-testid={`lottery-offset-${l.code}`}
                          type="number"
                          defaultValue={l.close_offset_minutes || 5}
                          disabled={!isSuperAdmin}
                          onBlur={(e) => parseInt(e.target.value) !== l.close_offset_minutes && updateLottery(l.id, { close_offset_minutes: parseInt(e.target.value) })}
                          className="bg-zinc-900 border-white/10 h-9 font-mono text-center w-16 mx-auto"
                        />
                      </td>
                      <td className="py-2.5 text-center text-xs text-zinc-400 font-mono hidden md:table-cell">
                        {l.external_pick3_id || "—"} / {l.external_pick4_id || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded border border-white/5">
              <b className="text-yellow-400 uppercase">Import API</b> : récupère Pick 3 + Pick 4 depuis lotteryresultsfeed.com pour la date du jour et calcule automatiquement les gagnants pour tous les tickets concernés. Bouton "Importer résultats API" en haut.<br/>
              <b className="text-yellow-400 uppercase">Horaires</b> : modifiables. Les ventes ferment automatiquement <b>{lotteries[0]?.close_offset_minutes || 5} min</b> avant le tirage local (timezone ET ou CT respectée).
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lotteries tab content moved before users to render in Tabs */}
      {editingUser && (
        <Dialog open={true} onOpenChange={(v) => !v && setEditingUser(null)}>
          <DialogContent className="bg-[#121214] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>{t("edit")} — {editingUser.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("name")}</Label>
                <Input
                  data-testid="user-edit-name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="bg-zinc-900 border-white/10 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("role")}</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(v) => setEditingUser({ ...editingUser, role: v })}
                >
                  <SelectTrigger data-testid="user-edit-role" className="bg-zinc-900 border-white/10 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white">
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="focus:bg-yellow-400/10 focus:text-yellow-400">
                        {lang === "ht" ? r.labelHt : r.labelFr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-zinc-400">{t("password")} <span className="text-zinc-600">({t("optional")})</span></Label>
                <Input
                  data-testid="user-edit-password"
                  value={editingUser.password || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder="Laisser vide pour ne pas changer"
                  className="bg-zinc-900 border-white/10 mt-1 font-mono"
                />
              </div>
              <Button
                data-testid="user-edit-save"
                onClick={() => {
                  const fields = { name: editingUser.name, role: editingUser.role };
                  if (editingUser.password) fields.password = editingUser.password;
                  updateUserField(editingUser.id, fields);
                }}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold"
              >{t("save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
