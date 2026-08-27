import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Boxes, LockKeyhole, MoveUpRight, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";

export default function AdminLogin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) setLocation("/estoque");
  }, [loading, user, setLocation]);

  return <div className="min-h-screen overflow-hidden bg-[#050914] text-white selection:bg-[#168BFF]/30">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(22,139,255,.15),transparent_30%),radial-gradient(circle_at_20%_90%,rgba(124,92,255,.12),transparent_30%)]" />
    <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.1fr_.9fr]">
      <div className="hidden flex-col justify-between border-r border-white/[0.07] p-10 lg:flex xl:p-16">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#168BFF]/30 bg-[#168BFF]/10 text-[#55B3FF]"><Boxes className="h-5 w-5" /></div><div><div className="font-display text-sm font-semibold tracking-[.16em]">COUTO & CORTÊS</div><div className="mt-1 font-mono text-[10px] uppercase tracking-[.25em] text-[#168BFF]">Fabricação digital</div></div></div>
        <div className="max-w-xl"><div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.3em] text-[#55B3FF]"><span className="h-px w-10 bg-[#168BFF]" />Área restrita / 01</div><h1 className="font-display text-5xl font-semibold leading-[1.03] tracking-[-.04em] xl:text-7xl">Matéria-prima<br /><span className="bg-gradient-to-r from-[#168BFF] via-[#7C5CFF] to-[#C06CFF] bg-clip-text text-transparent">sob controle.</span></h1><p className="mt-8 max-w-md text-base leading-7 text-slate-400">Acompanhe cada grama, cada cor e cada rolo que transforma o digital em físico.</p><div className="mt-12 grid grid-cols-3 gap-3">{[[ScanLine,"Rastreável"],[ShieldCheck,"Protegido"],[MoveUpRight,"Operacional"]].map(([Icon,label]) => <div key={label as string} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><Icon className="h-4 w-4 text-[#168BFF]" /><div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">{label as string}</div></div>)}</div></div>
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-600">CC / STOCK CONTROL / 2026</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#168BFF]/30 bg-[#168BFF]/10 text-[#55B3FF]"><Boxes className="h-5 w-5" /></div><div><div className="font-display text-sm font-semibold tracking-[.16em]">COUTO & CORTÊS</div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#168BFF]">Stock control</div></div></div>
        <div className="rounded-[28px] border border-white/[.09] bg-[#0B1220]/80 p-7 shadow-2xl shadow-black/20 backdrop-blur sm:p-10"><div className="mb-9"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#168BFF] text-white shadow-[0_0_32px_rgba(22,139,255,.35)]"><LockKeyhole className="h-5 w-5" /></div><h2 className="font-display text-2xl font-semibold tracking-[-.02em]">Entrar no estoque</h2><p className="mt-2 text-sm leading-6 text-slate-400">Acesse com sua conta autorizada para gerenciar os filamentos.</p></div><Button onClick={() => startLogin()} disabled={loading} className="h-12 w-full rounded-xl bg-[#168BFF] font-semibold text-white hover:bg-[#0d78df]">{loading ? "Verificando sessão..." : "Continuar com acesso seguro"}<MoveUpRight className="ml-2 h-4 w-4" /></Button><p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-slate-600">Ambiente privado · sessão criptografada</p></div>
        <p className="mt-6 text-center text-xs leading-5 text-slate-600">Este ambiente é exclusivo para gestão interna da operação.</p>
      </div></div>
    </div>
  </div>;
}
