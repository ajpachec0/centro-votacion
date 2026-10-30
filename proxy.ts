import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/login";
  const secret = process.env.APP_AUTH_SECRET ?? "";
  const session = secret
    ? readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;

  if (!session && !isPublic) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
