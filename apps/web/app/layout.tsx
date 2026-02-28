import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Deeppling",
  description: "Rippling/Deel-style onboarding + autonomous payroll on Unlink x Monad"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="row">
            <div className="brand">Deeppling</div>
            <nav>
              <Link href="/">Overview</Link>
              <Link href="/admin">Admin Onboarding</Link>
              <Link href="/payroll">Payroll Ops</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
