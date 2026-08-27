import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import { Boxes, ChevronRight, LayoutDashboard, LogOut, PanelLeft, Settings2, Warehouse, Wrench } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/estoque" },
  { icon: Boxes, label: "Filamentos", path: "/estoque/filamentos" },
  { icon: Wrench, label: "Movimentações", path: "/estoque/movimentacoes" },
  { icon: Warehouse, label: "Produtos prontos", path: "#produtos-prontos", soon: true },
  { icon: Settings2, label: "Configurações", path: "#configuracoes", soon: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#050914] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[#168BFF]"><Boxes /></div>
          <div><h1 className="font-display text-2xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-slate-400">Entre com sua conta para acessar o controle de estoque.</p></div>
          <Button onClick={() => startLogin()} className="w-full bg-[#168BFF] text-white hover:bg-[#0d78df]">Entrar no painel</Button>
        </div>
      </div>
    );
  }

  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleMenuClick = (item: typeof menuItems[number]) => {
    if (item.soon) {
      toast.info("Módulo em breve", { description: "Estamos preparando esta área para a próxima etapa." });
      return;
    }
    setLocation(item.path);
  };

  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar collapsible="icon" className="border-r border-white/[0.07] bg-[#080D19]" disableTransition={isResizing}>
        <SidebarHeader className="h-[86px] justify-center border-b border-white/[0.07] px-3">
          <div className="flex items-center gap-3 px-2 w-full">
            <button onClick={toggleSidebar} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white transition-colors" aria-label="Alternar menu"><PanelLeft className="h-4 w-4" /></button>
            {state !== "collapsed" && <div className="min-w-0"><div className="font-display truncate text-sm font-semibold tracking-[0.13em] text-white">COUTO & CORTÊS</div><div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#168BFF]"><span className="h-1.5 w-1.5 rounded-full bg-[#24D18A] shadow-[0_0_8px_#24D18A]" />Stock control</div></div>}
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-0 px-2 py-5">
          {state !== "collapsed" && <div className="px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">Operação</div>}
          <SidebarMenu>{menuItems.map(item => <SidebarMenuItem key={item.label}><SidebarMenuButton isActive={!item.soon && location === item.path} onClick={() => handleMenuClick(item)} tooltip={item.label} className="h-11 rounded-xl px-3 text-slate-400 transition-all hover:bg-white/[0.05] hover:text-white data-[active=true]:bg-[#168BFF]/10 data-[active=true]:text-[#55B3FF] data-[active=true]:shadow-[inset_2px_0_#168BFF]"><item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span>{item.soon && state !== "collapsed" && <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-slate-600">em breve</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/[0.07] p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.05] transition-colors"><Avatar className="h-9 w-9 border border-white/10 bg-[#168BFF]/10"><AvatarFallback className="bg-transparent text-sm font-semibold text-[#55B3FF]">{user?.name?.charAt(0).toUpperCase() || "C"}</AvatarFallback></Avatar>{state !== "collapsed" && <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-white">{user?.name || "Gestor"}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{user?.email || "sessão ativa"}</p></div>}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 border-white/10 bg-[#111A2A] text-white"><DropdownMenuItem onClick={() => void logout()} className="cursor-pointer text-red-300 focus:bg-red-500/10 focus:text-red-200"><LogOut className="mr-2 h-4 w-4" />Sair do painel</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#168BFF]/30 ${state === "collapsed" ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
    </div>
    <SidebarInset className="bg-[#050914] text-white">
      {isMobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-[#080D19]/95 px-3 backdrop-blur"><SidebarTrigger className="h-9 w-9 text-slate-300" /><span className="font-display text-sm font-semibold tracking-wide">{activeMenuItem?.label || "Painel"}</span></div>}
      <main className="min-h-screen p-4 sm:p-6 lg:p-8">{children}</main>
    </SidebarInset>
  </>;
}
