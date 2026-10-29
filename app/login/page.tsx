import type { Metadata } from "next";
import { Suspense } from "react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import LoginError from "@/components/auth/LoginError";

export const metadata: Metadata = { title: "Sign in | Budget Buddy" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8">
        <h1 className="text-2xl font-bold text-emerald-400">Budget Buddy</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-400">
          Sign in to track your spending, budgets, savings and wishlist.
        </p>
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
