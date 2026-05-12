import { motion } from "framer-motion";
import { useTokenBalance, useTokenTransactions } from "@/hooks/useTokens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { GlassCard } from "@/components/GlassCard";
import { Coins, ExternalLink, Shield } from "lucide-react";
import { format } from "date-fns";

const Rewards = () => {
  const { data: balance, isLoading: balanceLoading } = useTokenBalance();
  const { data: transactions, isLoading: txLoading } = useTokenTransactions();

  return (
    <AnimatedPage className="space-y-6">
      <h1 className="text-3xl font-bold">Rewards & Tokens</h1>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <GlassCard className="p-8 border-primary/20 eco-gradient relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="relative flex items-center gap-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="rounded-2xl bg-primary-foreground/20 p-4"
              >
                <Coins className="h-10 w-10 text-primary-foreground" />
              </motion.div>
              <div>
                <p className="text-sm text-primary-foreground/80">Green Token Balance</p>
                {balanceLoading ? (
                  <Skeleton className="mt-1 h-10 w-32" />
                ) : (
                  <p className="text-4xl font-bold text-primary-foreground">{balance ?? 0} GT</p>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <GlassCard className="p-8">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">Blockchain-Backed Rewards</p>
                <p className="text-sm text-muted-foreground">
                  Green Tokens are minted on Ethereum/Polygon when AI agents verify and resolve your reports.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <motion.div variants={fadeInUp} initial="initial" animate="animate">
        <Card className="glass">
          <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !transactions?.length ? (
              <p className="py-8 text-center text-muted-foreground">No transactions yet. Submit reports to earn Green Tokens!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>TX Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, i) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>{format(new Date(tx.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium text-primary">+{tx.tokens} GT</TableCell>
                      <TableCell>
                        <Badge variant={tx.status === "confirmed" ? "default" : "secondary"}>{tx.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {tx.tx_hash ? (
                          <a href={`https://polygonscan.com/tx/${tx.tx_hash}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            {tx.tx_hash.slice(0, 10)}... <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatedPage>
  );
};

export default Rewards;
