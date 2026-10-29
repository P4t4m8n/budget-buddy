import Link from "next/link";
import NavLinks from "@/components/layout/NavLinks";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-white/10 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <Link
          href="/dashboard"
          className="mb-4 block text-lg font-bold text-emerald-400"
        >
          Budget Buddy
        </Link>
        <div className="overflow-x-auto">
          <NavLinks />
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
