import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

export default function Login() {
  const { login, t, lang, setLang } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t("welcomeBack"));
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || t("invalidCreds"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center relative overflow-hidden p-4">
      {/* Background gradient & image */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1709377195538-5522ed0f9e10?crop=entropy&cs=srgb&fm=jpg&w=1920&q=70")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090B] via-transparent to-[#09090B]" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-400/5 blur-3xl rounded-full" />

      {/* Lang switch top right */}
      <div className="absolute top-4 right-4 flex bg-zinc-900/80 backdrop-blur border border-white/10 rounded-md p-0.5">
        {["fr", "ht"].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            data-testid={`login-lang-${l}`}
            className={`px-3 py-1 text-xs font-bold uppercase rounded transition-colors ${
              lang === l ? "bg-zinc-700 text-white" : "text-zinc-400"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <Card className="w-full max-w-md bg-[#121214] border-white/5 relative z-10 p-8 slide-up">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={64} />
          <div>
            <h1 className="text-3xl font-black tracking-tighter">TOP LOTTO</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-1">{t("welcomeBackTo")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("email")}</Label>
            <Input
              type="email"
              autoFocus
              required
              data-testid="login-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-900 border-white/10 h-11 font-mono focus:border-yellow-400 focus:ring-yellow-400/30"
              placeholder="admin@toplotto.ht"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-zinc-400">{t("password")}</Label>
            <Input
              type="password"
              required
              data-testid="login-password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-900 border-white/10 h-11 font-mono focus:border-yellow-400 focus:ring-yellow-400/30"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-black font-bold glow-gold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("signIn")}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center text-xs text-zinc-500">
          <span className="font-mono">admin@toplotto.ht / Admin123!</span>
        </div>
      </Card>
    </div>
  );
}
