import { Link, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Chatbot from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Leaf, Menu, X } from "lucide-react";
import { useState } from "react";

const AppLayout = () => {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const initials = user?.fullName ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";
  const isMunicipalOfficer = hasRole("municipal_officer");
  const isAdmin = hasRole("admin");
  const isCityPlanner = hasRole("city_planner");

  const navLinks = isMunicipalOfficer && !isAdmin
    ? [{ to: "/municipal", label: "Municipal Dashboard" }]
    : isCityPlanner && !isAdmin
    ? [{ to: "/analytics", label: "Analytics" }, { to: "/hotspots", label: "Hotspots" }]
    : [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/report/new", label: "Report Waste" },
        { to: "/reports", label: "My Reports" },
        { to: "/hotspots", label: "Hotspots" },
        { to: "/rewards", label: "Rewards" },
        ...(isAdmin ? [{ to: "/municipal", label: "Municipal" }, { to: "/analytics", label: "Analytics" }] : []),
      ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="eco-gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>EcoChain</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="ghost" size="sm">{l.label}</Button>
                </motion.div>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong">
                <div className="px-2 py-1.5 text-sm font-medium">{user?.fullName || user?.email}</div>
                <div className="px-2 pb-1.5 text-xs text-muted-foreground">{user?.roles.join(", ")}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t bg-card px-4 py-3 md:hidden"
          >
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">{l.label}</Button>
              </Link>
            ))}
          </motion.nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <Chatbot />
    </div>
  );
};

export default AppLayout;
