import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import ReportCreate from "@/pages/ReportCreate";
import MyReports from "@/pages/MyReports";
import ReportDetail from "@/pages/ReportDetail";
import MunicipalDashboard from "@/pages/MunicipalDashboard";
import Hotspots from "@/pages/Hotspots";
import Rewards from "@/pages/Rewards";
import Analytics from "@/pages/Analytics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/hotspots" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Hotspots />} />
              </Route>
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/report/new" element={<ReportCreate />} />
                <Route path="/reports" element={<MyReports />} />
                <Route path="/reports/:id" element={<ReportDetail />} />
                <Route path="/rewards" element={<Rewards />} />
              </Route>
              <Route element={<ProtectedRoute roles={["municipal_officer", "admin"]}><AppLayout /></ProtectedRoute>}>
                <Route path="/municipal" element={<MunicipalDashboard />} />
              </Route>
              <Route element={<ProtectedRoute roles={["city_planner", "admin"]}><AppLayout /></ProtectedRoute>}>
                <Route path="/analytics" element={<Analytics />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
