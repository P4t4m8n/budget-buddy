import { Suspense } from "react";
import Link from "next/link";
import UserMenu from "@/components/auth/UserMenu";
import AuthGate from "@/components/auth/AuthGate";
import NavLinks from "@/components/layout/NavLinks";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col gap-4 border-b border-white/10 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <Link
          href="/dashboard"
          className="block text-lg font-bold text-emerald-400"
        >
          Budget Buddy
        </Link>
        <div className="overflow-x-auto">
          <NavLinks />
        </div>
        <div className="border-t border-white/10 pt-4 lg:mt-auto">
          <Suspense fallback={<div className="h-8 animate-pulse rounded-lg bg-white/5" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white/5" />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
}
