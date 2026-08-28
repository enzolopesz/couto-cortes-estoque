import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Filaments from "./pages/Filaments";
import Movements from "./pages/Movements";
import Products from "./pages/Products";
import Tracking from "./pages/Tracking";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/estoque/login" component={AdminLogin} />
    <Route path="/estoque"><ProtectedAdmin><Dashboard /></ProtectedAdmin></Route>
    <Route path="/estoque/filamentos" component={() => <ProtectedAdmin><Filaments /></ProtectedAdmin>} />
      <Route path="/estoque/movimentacoes" component={() => <ProtectedAdmin><Movements /></ProtectedAdmin>} />
    <Route path="/estoque/produtos" component={() => <ProtectedAdmin><Products /></ProtectedAdmin>} />
    <Route path="/estoque/acompanhamento" component={() => <ProtectedAdmin><Tracking /></ProtectedAdmin>} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
