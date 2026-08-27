import { Button } from "@/components/ui/button";
import { Boxes, MoveUpRight } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return <main className="min-h-screen bg-[#050914] text-white"><div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#168BFF]/30 bg-[#168BFF]/10 text-[#55B3FF]"><Boxes className="h-7 w-7" /></div><div className="mt-7 font-mono text-[10px] uppercase tracking-[.28em] text-[#168BFF]">Couto & Cortês · área operacional</div><h1 className="mt-4 font-display text-4xl font-semibold tracking-[-.05em] sm:text-6xl">Controle de estoque<br /><span className="text-slate-500">para fabricação digital.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-slate-500">Ambiente administrativo privado para acompanhar filamentos e matéria-prima da operação.</p><Link href="/estoque/login"><Button className="mt-8 h-12 rounded-xl bg-[#168BFF] px-6 font-semibold text-white hover:bg-[#0d78df]">Acessar painel <MoveUpRight className="ml-2 h-4 w-4" /></Button></Link></div></main>;
}
