import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = [
  "/admin/login",
  "/admin",
  "/manager-login",
];

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/devenir-agent",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PAGES.some((route) => pathname === route || pathname.startsWith("/api/"))) {
    return NextResponse.next();
  }

  if (PUBLIC_AUTH_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  const adminToken = request.cookies.get("adminToken")?.value;
  const managerToken = request.cookies.get("managerToken")?.value;
  const agentToken = request.cookies.get("agentToken")?.value;

  const isSuperAdmin = pathname.startsWith("/super-admin");
  const isManager = pathname.startsWith("/admin-manager");
  const isAgent = pathname.startsWith("/agent");
  const isAdmin = pathname.startsWith("/admin") && !pathname.startsWith("/admin-manager");

  if (isSuperAdmin && adminToken) return NextResponse.next();
  if (isManager && (managerToken || adminToken)) return NextResponse.next();
  if (isAgent && agentToken) return NextResponse.next();
  if (isAdmin && adminToken) return NextResponse.next();

  if (isSuperAdmin || isAgent) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isManager) {
    return NextResponse.redirect(new URL("/manager-login", request.url));
  }
  if (isAdmin) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin-manager/:path*",
    "/admin/:path*",
    "/agent/:path*",
  ],
};
