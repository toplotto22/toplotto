import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, X, Clock, CheckCircle, ArrowLeft } from "lucide-react";
import logoImg from "@/assets/logo.jpeg";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const GAME_LABEL = {
  bolet: "BÒLÈT", pick3: "PICK 3", pick4: "PICK 4", pick5: "PICK 5",
  mariage: "MARYAJ", mariage_gratis: "MARYAJ GRATIS",
};
const GAME_COLOR = {
  bolet: "bg-red-500/10 text-red-400 border-red-500/30",
  pick3: "bg-green-500/10 text-green-400 border-green-500/30",
  pick4: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  pick5: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  mariage: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  mariage_gratis: "bg-pink-500/10 text-pink-400 border-pink-500/30",
};

export default function PublicVerify() {
  const { num } = useParams();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!num) return;
    axios.get(`${API}/public/verify/${num.toUpperCase()}`)
      .then(({ data }) => setTicket(data))
      .catch((err) => setError(err.response?.data?.detail || "Tikè pa jwenn"))
      .finally(() => setLoading(false));
  }, [num]);

  const status = ticket
    ? (ticket.paid ? "paid" :
       ticket.has_result ? (ticket.payout_amount > 0 ? "won" : "lost") :
       "pending")
    : null;

  return (
    <div className="min-h-screen bg-[#0A1A33] text-white px-4 py-8" data-testid="public-verify">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pb-4">
          <div className="inline-block p-1 rounded-full bg-yellow-400 mb-3">
            <img src={logoImg} alt="TOP LOTTO" className="w-20 h-20 rounded-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-yellow-400 tracking-tight">TOP LOTTO</h1>
          <p className="text-xs uppercase tracking-widest text-yellow-400/60 mt-1">Verifikasyon Tikè</p>
        </div>

        {loading && (
          <div className="text-center py-12 text-zinc-400">
            <div className="animate-spin w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-3" />
            Verifikasyon an kours...
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 text-center" data-testid="verify-error">
            <X className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <div className="text-xl font-bold text-red-400">{error}</div>
            <div className="text-sm text-zinc-400 mt-2 font-mono">{num}</div>
          </div>
        )}

        {ticket && (
          <>
            {/* Ticket number */}
            <div className="bg-white/5 backdrop-blur border border-yellow-400/20 rounded-2xl p-5 text-center">
              <div className="text-[10px] uppercase tracking-widest text-yellow-400/60 mb-1">Nimewo Tikè</div>
              <div className="text-2xl font-mono font-black text-yellow-400" data-testid="verify-num">{ticket.ticket_number}</div>
              <div className="text-sm text-zinc-300 mt-2">{ticket.lottery_name}</div>
              <div className="text-xs text-zinc-400 font-mono">Tiraj: {ticket.draw_date}</div>
            </div>

            {/* Status banner */}
            {status === "won" && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-center shadow-2xl" data-testid="verify-won">
                <Trophy className="w-14 h-14 mx-auto mb-2 text-yellow-300" />
                <div className="text-sm uppercase tracking-widest font-bold text-yellow-100">★ Tikè a GENYEN ★</div>
                <div className="text-4xl font-black mt-2">{fmt(ticket.payout_amount)}</div>
                <div className="text-xs text-yellow-100 mt-2">Pote tikè a pou ranmase kòb la</div>
              </div>
            )}
            {status === "lost" && (
              <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 text-center" data-testid="verify-lost">
                <X className="w-12 h-12 text-red-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-red-400">PA GENYEN</div>
                <div className="text-sm text-zinc-400 mt-1">Tikè sa pa matche ak rezilta yo</div>
              </div>
            )}
            {status === "pending" && (
              <div className="bg-zinc-800/50 border-2 border-yellow-400/20 rounded-2xl p-6 text-center" data-testid="verify-pending">
                <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-yellow-400">RAN TIRAJ</div>
                <div className="text-sm text-zinc-400 mt-1">Rezilta yo poko soti pou tirage sa</div>
              </div>
            )}
            {status === "paid" && (
              <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 text-center" data-testid="verify-paid">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-emerald-400">✓ DEJA PEYE</div>
                <div className="text-2xl font-mono font-bold mt-2">{fmt(ticket.payout_amount)}</div>
              </div>
            )}

            {/* Items */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-yellow-400/60 mb-2 font-bold">Detay Jwèt</div>
              {ticket.items?.map((it, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${GAME_COLOR[it.game] || GAME_COLOR.bolet} ${it.winning ? "ring-2 ring-green-400" : ""}`}>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider">{GAME_LABEL[it.game] || it.game}</span>
                    <span className="font-mono text-xl font-bold tracking-wider mt-0.5 text-white">{it.number}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-white">{fmt(it.amount)}</div>
                    {it.winning && <div className="text-xs text-green-300 font-bold mt-0.5">★ GENYEN {fmt(it.payout || 0)}</div>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-white/10">
                <span className="text-sm uppercase font-bold text-yellow-400/60">Total</span>
                <span className="font-mono text-xl font-black text-yellow-400">{fmt(ticket.total)}</span>
              </div>
            </div>

            {/* Result */}
            {ticket.has_result && ticket.result && (
              <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-yellow-400 mb-2 font-bold text-center">★ Rezilta Ofisyèl ★</div>
                {ticket.result.bolet?.filter(Boolean).length > 0 && (
                  <div className="flex justify-center gap-2 mb-2">
                    {ticket.result.bolet.map((b, i) => b && (
                      <div key={i} className="text-center">
                        <div className="text-[9px] uppercase text-zinc-500">{["1ye", "2yèm", "3yèm"][i]}</div>
                        <div className="font-mono font-black text-lg text-yellow-400">{b}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-center gap-4 text-xs">
                  {ticket.result.pick3 && <div><span className="text-zinc-500">P3:</span> <span className="font-mono font-bold">{ticket.result.pick3}</span></div>}
                  {ticket.result.pick4 && <div><span className="text-zinc-500">P4:</span> <span className="font-mono font-bold">{ticket.result.pick4}</span></div>}
                </div>
              </div>
            )}

            <div className="text-center text-xs text-zinc-500 pt-3">
              Vandè: {ticket.machann_name} • Kreye: {ticket.created_at?.slice(0, 16).replace("T", " ")}
            </div>
          </>
        )}

        <Link to="/" className="block mt-6">
          <button className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Retounen sou aplikasyon
          </button>
        </Link>
      </div>
    </div>
  );
}
