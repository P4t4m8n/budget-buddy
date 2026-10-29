import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth/session";

// POST only: SameSite=Lax cookies aren't sent on cross-site POSTs, so other sites can't log you out
export async function POST(request: NextRequest) {
  await deleteSession();
  // 303 turns the redirect into a GET of /login
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
