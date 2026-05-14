import { Link, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Chatbot from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";
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

  const { t } = useTranslation();

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const initials = user?.fullName ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";
  const isMunicipalOfficer = hasRole("municipal_officer");
  const isAdmin = hasRole("admin");
  const isCityPlanner = hasRole("city_planner");

  const isStaff = isAdmin || isMunicipalOfficer;

  const navLinks = isStaff
    ? [
        { to: "/municipal", label: t('nav.municipal', 'Municipal Dashboard') },
        { to: "/hotspots", label: t('nav.hotspots', 'Hotspots') },
        { to: "/analytics", label: t('nav.analytics', 'Analytics') },
      ]
    : isCityPlanner && !isAdmin
    ? [{ to: "/analytics", label: t('nav.analytics', 'Analytics') }]
    : [
        { to: "/dashboard", label: t('nav.dashboard', 'Dashboard') },
        { to: "/report/new", label: t('nav.report_waste', 'Report Waste') },
        { to: "/reports", label: t('nav.my_reports', 'My Reports') },
        { to: "/hotspots", label: t('nav.hotspots', 'Hotspots') },
        { to: "/rewards", label: t('nav.rewards', 'Rewards') },
      ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="eco-gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>NammaWaste</span>
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
            <LanguageToggle />
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
                <DropdownMenuItem onClick={handleSignOut}>{t('nav.sign_out', 'Sign Out')}</DropdownMenuItem>
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
