import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Leaf, Shield, Cpu, MapPin, Coins, ArrowRight, Recycle, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

const agentFlow = [
  { icon: Cpu, label: "Waste Verification", color: "bg-primary/10 text-primary" },
  { icon: MapPin, label: "Geo-Intelligence", color: "bg-sky-100 text-sky-600" },
  { icon: Shield, label: "Municipal Coordination", color: "bg-violet-100 text-violet-600" },
  { icon: Coins, label: "Reward Optimization", color: "bg-amber-100 text-amber-600" },
  { icon: CheckCircle2, label: "Fraud Detection", color: "bg-emerald-100 text-emerald-600" },
];

const Landing = () => {
  return (
    <AnimatedPage className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="eco-gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>EcoChain</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/hotspots" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">View Hotspots</Button>
            </Link>
            <Link to="/login" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm">Municipal Login</Button>
            </Link>
            <Link to="/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button size="sm">Get Started</Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-mesh">
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center lg:py-36">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm backdrop-blur-sm">
              🌿 AI-Powered Urban Waste Management
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-7xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="eco-gradient-text">EcoChain</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mx-auto mt-4 max-w-2xl text-xl text-muted-foreground lg:text-2xl"
          >
            Where AI Agents Govern Urban Waste
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto mt-6 max-w-xl text-muted-foreground"
          >
            Report waste, let AI agents verify and coordinate, earn blockchain rewards. 
            A transparent, trustless system for cleaner cities.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link to="/login">
              <motion.div whileHover={{ scale: 1.05, boxShadow: "0 0 24px hsl(152 60% 36% / 0.3)" }} whileTap={{ scale: 0.97 }} className="rounded-md">
                <Button size="lg" className="gap-2 px-8">
                  <Recycle className="h-5 w-5" /> Report Waste
                </Button>
              </motion.div>
            </Link>
            <Link to="/hotspots">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" variant="outline" className="gap-2 px-8">
                  <MapPin className="h-5 w-5" /> View Hotspots
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Agent Workflow Strip */}
      <section className="border-y bg-card/50 py-8 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4">
          <p className="mb-6 text-center text-sm font-medium text-muted-foreground uppercase tracking-widest">
            5 AI Agents Working in Sequence
          </p>
          <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
            {agentFlow.map((agent, i) => (
              <motion.div
                key={agent.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i + 0.5, duration: 0.4 }}
                className="flex items-center gap-2 md:gap-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium md:px-4 md:text-sm ${agent.color}`}
                >
                  <agent.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{agent.label}</span>
                </motion.div>
                {i < agentFlow.length - 1 && (
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  >
                    <Zap className="h-3 w-3 text-muted-foreground" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true, margin: "-80px" }}>
            <motion.h2 variants={fadeInUp} className="text-center text-3xl font-bold">The Problem</motion.h2>
            <motion.p variants={fadeInUp} className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Urban waste management is broken. Here's why current systems fail.
            </motion.p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { icon: AlertTriangle, title: "Uncollected Waste", desc: "Reports go unnoticed. Piles grow. Communities suffer from poor sanitation and health hazards." },
                { icon: Shield, title: "Manual Verification", desc: "Human-only checks are slow, subjective, and prone to corruption and inefficiency." },
                { icon: Coins, title: "Low Trust & Incentives", desc: "Citizens have no reason to report. No transparency, no rewards, no accountability." },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeInUp}>
                  <GlassCard className="p-8 text-center">
                    <div className="mx-auto mb-4 w-fit rounded-xl bg-destructive/10 p-3">
                      <item.icon className="h-6 w-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true, margin: "-80px" }}>
            <motion.h2 variants={fadeInUp} className="text-center text-3xl font-bold">The Solution</motion.h2>
            <motion.p variants={fadeInUp} className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              5 AI agents working together with blockchain rewards to create a trustless, efficient waste management system.
            </motion.p>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Cpu, title: "Waste Verification Agent", desc: "AI analyzes uploaded images to verify waste type, severity, and authenticity in seconds." },
                { icon: MapPin, title: "Geo-Intelligence Agent", desc: "Maps waste hotspots, predicts accumulation patterns, and optimizes collection routes." },
                { icon: Shield, title: "Municipal Coordination Agent", desc: "Automatically assigns verified reports to the right department and tracks resolution." },
                { icon: Coins, title: "Reward Optimization Agent", desc: "Calculates fair Green Token rewards based on report quality and impact." },
                { icon: CheckCircle2, title: "Fraud Detection Agent", desc: "Cross-references reports, detects duplicates, and prevents gaming the system." },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeInUp}>
                  <GlassCard className="p-8 h-full">
                    <motion.div
                      whileHover={{ rotate: 8, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="mb-4 w-fit rounded-xl bg-primary/10 p-3"
                    >
                      <item.icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>


      {/* CTA */}
      <section className="py-20 gradient-mesh">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold">Ready to Make Your City Cleaner?</h2>
            <p className="mt-4 text-muted-foreground">
              Join EcoChain today. Report waste, earn rewards, and make a difference.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/signup">
                <motion.div whileHover={{ scale: 1.05, boxShadow: "0 0 24px hsl(152 60% 36% / 0.3)" }} whileTap={{ scale: 0.97 }} className="rounded-md">
                  <Button size="lg" className="gap-2">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link to="/login?role=municipal_officer">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="outline">Municipal Login</Button>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            <span>EcoChain © {new Date().getFullYear()}</span>
          </div>
          <span>AI-Powered Urban Waste Governance</span>
        </div>
      </footer>
    </AnimatedPage>
  );
};

export default Landing;
