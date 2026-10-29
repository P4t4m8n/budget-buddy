import Link from "next/link";
import Button from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";

export default async function UserMenu() {
  const session = await getSession();

  if (!session) {
    return (
      <Link
        href="/login"
        className="block rounded-lg px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-white/5"
      >
        Sign in
      </Link>
    );
  }

  const { user } = session;
  const label = user.name ?? user.email;

  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google avatar; next/image would need a remote host config
        <img
          src={user.image}
          alt=""
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          className="size-8 shrink-0 rounded-full"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-400">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <form action="/api/auth/logout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className="-ml-2 px-2 py-0.5 text-xs"
          >
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
