import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, Ticket as TicketIcon, Trophy, CreditCard,
  BarChart3, Users, LogOut, ScanLine, Settings,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NavItem = ({ to, icon: Icon, label, testId }) => (
  <NavLink
    to={to}
    end={to === "/"}
    data-testid={testId}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
        isActive
          ? "bg-yellow-400/10 text-yellow-400 border-l-2 border-yellow-400"
          : "text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
      }`
    }
  >
    <Icon className="w-4 h-4 shrink-0" />
    <span className="truncate">{label}</span>
  </NavLink>
);

export default function Layout() {
  const { user, logout, t, lang, setLang, currency, setCurrency } = useApp();
  const navigate = useNavigate();
  const role = user?.role;

  const can = (...roles) => roles.includes(role);

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#0d0d0f] sticky top-0 h-screen">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-yellow-400 text-black flex items-center justify-center font-black text-lg">
              TL
            </div>
            <div>
              <div className="font-black tracking-tight text-lg leading-none">TOP LOTTO</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">{t("poweredBy")}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem to="/" icon={LayoutDashboard} label={t("dashboard")} testId="nav-dashboard" />
          {can("super_admin", "admin", "sous_admin", "machann") && (
            <NavItem to="/sales" icon={ShoppingCart} label={t("sales")} testId="nav-sales" />
          )}
          <NavItem to="/tickets" icon={TicketIcon} label={t("tickets")} testId="nav-tickets" />
          <NavItem to="/verify" icon={ScanLine} label={t("verify")} testId="nav-verify" />
          <NavItem to="/results" icon={Trophy} label={t("results")} testId="nav-results" />
          <NavItem to="/payments" icon={CreditCard} label={t("payments")} testId="nav-payments" />
          {can("super_admin", "directeur", "superviseur", "admin") && (
            <NavItem to="/reports" icon={BarChart3} label={t("reports")} testId="nav-reports" />
          )}
          {can("super_admin", "admin") && (
            <NavItem to="/admin" icon={Users} label={t("settings")} testId="nav-admin" />
          )}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="text-xs text-zinc-500 mb-2 px-2">{user?.email}</div>
          <Button
            variant="ghost"
            data-testid="logout-btn"
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut className="w-4 h-4 mr-2" /> {t("signOut")}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#0d0d0f]/80 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 rounded-md bg-yellow-400 text-black flex items-center justify-center font-black">TL</div>
            <span className="font-black">TOP LOTTO</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Currency switch */}
            <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5" data-testid="currency-switch">
              {["HTG", "BRL"].map((c) => (
                <button
                  key={c}
                  data-testid={`currency-${c}`}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded transition-colors ${
                    currency === c ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* Lang switch */}
            <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5" data-testid="lang-switch">
              {["fr", "ht"].map((l) => (
                <button
                  key={l}
                  data-testid={`lang-${l}`}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-xs font-bold uppercase rounded transition-colors ${
                    lang === l ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-zinc-900 border-white/10 hover:bg-zinc-800"
                  data-testid="user-menu"
                >
                  <span className="w-7 h-7 rounded-full bg-yellow-400 text-black font-black text-xs flex items-center justify-center mr-2">
                    {user?.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="hidden sm:inline text-sm">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
                <DropdownMenuLabel className="text-xs text-zinc-400">
                  {user?.role.toUpperCase()}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                  onClick={() => { logout(); navigate("/login"); }}
                  className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                  data-testid="user-menu-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" /> {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="lg:hidden border-b border-white/5 bg-[#0d0d0f] overflow-x-auto">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {[
              ["/", t("dashboard"), LayoutDashboard],
              ["/sales", t("sales"), ShoppingCart],
              ["/tickets", t("tickets"), TicketIcon],
              ["/verify", t("verify"), ScanLine],
              ["/results", t("results"), Trophy],
              ["/payments", t("payments"), CreditCard],
              ["/reports", t("reports"), BarChart3],
              ["/admin", t("settings"), Settings],
            ].map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded text-xs whitespace-nowrap ${
                    isActive ? "bg-yellow-400 text-black font-bold" : "text-zinc-400"
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-8 slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
