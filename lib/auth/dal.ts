import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";

// cache() dedupes the database lookup within one request
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  return session?.user ?? null;
});

// Call this in every data function that reads or writes user data, not only in layouts:
// layouts don't re-render on client navigation, so a layout check alone isn't enough
export const requireUser = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
};
