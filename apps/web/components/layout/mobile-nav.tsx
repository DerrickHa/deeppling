"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Banknote,
  Menu,
  WalletCards,
  Handshake,
  ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { navItems } from "@/lib/constants";

const iconMap = {
  LayoutDashboard,
  UserPlus,
  Banknote,
  WalletCards,
  Handshake,
  ScrollText
} as const;

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center h-14 border-b px-4 bg-sidebar sticky top-0 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center h-14 border-b px-4">
            <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">D</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">Deeppling</span>
            </Link>
          </div>
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <Link href="/" className="flex items-center gap-2 ml-3">
        <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">D</span>
        </div>
        <span className="font-semibold text-lg tracking-tight">Deeppling</span>
      </Link>
    </div>
  );
}
