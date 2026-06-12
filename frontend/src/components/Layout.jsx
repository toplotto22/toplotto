import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, Ticket as TicketIcon, Trophy, CreditCard,
  BarChart3, Users, LogOut, ScanLine, Menu, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NavItem = ({ to, icon: Icon, label, testId, onClick }) => (
  <NavLink
    to={to}
    end={to === "/"}
    onClick={onClick}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role;
  const can = (...roles) => roles.includes(role);
  const closeMobile = () => setMobileOpen(false);

  const NavLinks = ({ onClick }) => (
    <>
      <NavItem onClick={onClick} to="/" icon={LayoutDashboard} label={t("dashboard")} testId="nav-dashboard" />
      {can("super_admin", "admin", "sous_admin", "machann") && (
        <NavItem onClick={onClick} to="/sales" icon={ShoppingCart} label={t("sales")} testId="nav-sales" />
      )}
      <NavItem onClick={onClick} to="/tickets" icon={TicketIcon} label={t("tickets")} testId="nav-tickets" />
      <NavItem onClick={onClick} to="/verify" icon={ScanLine} label={t("verify")} testId="nav-verify" />
      <NavItem onClick={onClick} to="/results" icon={Trophy} label={t("results")} testId="nav-results" />
      <NavItem onClick={onClick} to="/payments" icon={CreditCard} label={t("payments")} testId="nav-payments" />
      {can("super_admin", "directeur", "superviseur", "admin") && (
        <NavItem onClick={onClick} to="/reports" icon={BarChart3} label={t("reports")} testId="nav-reports" />
      )}
      {can("super_admin", "admin") && (
        <NavItem onClick={onClick} to="/admin" icon={Users} label={t("settings")} testId="nav-admin" />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#0d0d0f] sticky top-0 h-screen">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-yellow-400 text-black flex items-center justify-center font-black text-lg">TL</div>
            <div>
              <div className="font-black tracking-tight text-lg leading-none">TOP LOTTO</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">{t("poweredBy")}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="text-xs text-zinc-500 mb-2 px-2 truncate">{user?.email}</div>
          <Button
            variant="ghost" data-testid="logout-btn"
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut className="w-4 h-4 mr-2" /> {t("signOut")}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={closeMobile}>
          <aside className="w-72 h-full bg-[#0d0d0f] border-r border-white/10 slide-up flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-md bg-yellow-400 text-black flex items-center justify-center font-black">TL</div>
                <div className="font-black tracking-tight">TOP LOTTO</div>
              </div>
              <button data-testid="mobile-close" onClick={closeMobile} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLinks onClick={closeMobile} />
            </nav>
            <div className="p-3 border-t border-white/5">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-400"
                onClick={() => { logout(); navigate("/login"); }}
              >
                <LogOut className="w-4 h-4 mr-2" /> {t("signOut")}
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#0d0d0f]/90 backdrop-blur-md border-b border-white/5 px-3 sm:px-4 lg:px-8 py-3 flex items-center justify-between gap-2">
          <button
            data-testid="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-zinc-400 hover:text-white p-2 -ml-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-yellow-400 text-black flex items-center justify-center font-black text-xs">TL</div>
            <span className="font-black text-sm">TOP LOTTO</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5" data-testid="currency-switch">
              {["HTG", "BRL"].map((c) => (
                <button
                  key={c}
                  data-testid={`currency-${c}`}
                  onClick={() => setCurrency(c)}
                  className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-mono font-bold rounded transition-colors ${
                    currency === c ? "bg-yellow-400 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5" data-testid="lang-switch">
              {["fr", "ht"].map((l) => (
                <button
                  key={l}
                  data-testid={`lang-${l}`}
                  onClick={() => setLang(l)}
                  className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase rounded transition-colors ${
                    lang === l ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-zinc-900 border-white/10 hover:bg-zinc-800 h-9 px-2 sm:px-3" data-testid="user-menu">
                  <span className="w-6 h-6 rounded-full bg-yellow-400 text-black font-black text-[10px] flex items-center justify-center sm:mr-2">
                    {user?.name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="hidden sm:inline text-sm truncate max-w-[120px]">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
                <DropdownMenuLabel className="text-xs text-zinc-400">{user?.role.toUpperCase()}</DropdownMenuLabel>
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

        <div className="flex-1 p-3 sm:p-4 lg:p-8 slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
