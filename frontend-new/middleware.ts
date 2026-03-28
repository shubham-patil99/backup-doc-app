import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("token")?.value || null;
    const role = req.cookies.get("role")?.value || null;

    if (!token) return NextResponse.redirect(new URL("/auth/login", req.url));

    if (pathname.startsWith("/dashboard/admin") && role !== "1") {
      return NextResponse.redirect(new URL("/dashboard/user", req.url));
    }

    if (pathname.startsWith("/dashboard/user") && role !== "2") {
      return NextResponse.redirect(new URL("/dashboard/admin", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
