import { requireUser } from "@/lib/auth/dal";

// Real session check (database) for everything rendered inside the app layout
export default async function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
