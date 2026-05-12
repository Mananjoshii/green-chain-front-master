import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard = ({ children, className, hover = true }: GlassCardProps) => (
  <motion.div
    whileHover={hover ? { y: -2, boxShadow: "0 12px 40px -8px hsl(152 60% 36% / 0.12)" } : undefined}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className={cn(
      "rounded-xl glass",
      className
    )}
  >
    {children}
  </motion.div>
);

export const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconBg?: string;
  iconColor?: string;
}) => (
  <GlassCard className="p-5">
    <div className="flex items-center gap-4">
      <motion.div
        whileHover={{ rotate: 8, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300 }}
        className={cn("rounded-xl p-3", iconBg)}
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </motion.div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  </GlassCard>
);
