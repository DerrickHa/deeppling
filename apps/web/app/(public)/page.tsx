import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { UserPlus, Shield, Brain, ArrowRight, WalletCards, Handshake } from "lucide-react";

const features = [
  {
    icon: UserPlus,
    title: "Smart Onboarding",
    description:
      "Streamlined admin wizard with KYB verification, treasury setup, payroll policy configuration, and secure employee invite links.",
    items: [
      "Multi-step admin wizard",
      "KYB verification flow",
      "Treasury & policy config",
      "Invite link onboarding",
    ],
  },
  {
    icon: Shield,
    title: "Monad + Unlink Rail",
    description:
      "All payroll, EWA, and contractor payouts execute through Unlink on Monad with preflight checks and deterministic receipts.",
    items: [
      "Monad treasury preflight",
      "Unlink transfer execution",
      "Idempotency on every payout",
      "Circuit breaker protection",
    ],
  },
  {
    icon: Brain,
    title: "Private Attestations",
    description:
      "Critical workflow events are hash-anchored on-chain while compensation amounts stay private by default.",
    items: [
      "Hash-only chain anchors",
      "Need-to-know amount visibility",
      "Signature attestations",
      "Auditable decision trails",
    ],
  },
  {
    icon: WalletCards,
    title: "Earned Pay Access",
    description:
      "Salaried employees can request prorated withdrawals with replay-safe signatures and instant settlement.",
    items: [
      "Biweekly accrual engine",
      "100% accrued cap support",
      "Immediate payout settlement",
      "Payroll netting at close",
    ],
  },
  {
    icon: Handshake,
    title: "Contractor Co-Sign",
    description:
      "Contractor and employer signatures drive submit, dispute, resolve, and approval flow with immediate pay on approval.",
    items: [
      "Timesheet handshake model",
      "Dispute locks payment",
      "Approval triggers payout",
      "Monad anchor per transition",
    ],
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Deeppling
          </Link>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/payroll">Payroll</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/earned-pay">Earned Pay</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contractors">Contractors</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center sm:pt-32 lg:pt-40">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
            Enterprise Payroll Platform
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Enterprise Payroll on{" "}
            <span className="text-primary">Unlink x Monad</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            US-first employee onboarding with invite links, simulated compliance
            states, managed wallets, and AI-assisted payroll execution.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/admin">
                Start Admin Wizard
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/payroll">Open Payroll Ops</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {features.map(({ icon: Icon, title, description, items }) => (
            <Card
              key={title}
              className="group hover:shadow-lg transition-shadow duration-300"
            >
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary/20">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-primary/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 text-sm text-muted-foreground">
          <span>Deeppling</span>
          <span>&copy; 2026 Deeppling</span>
        </div>
      </footer>
    </div>
  );
}
