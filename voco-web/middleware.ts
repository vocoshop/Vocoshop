import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/super-admin",
  "/admin-manager",
  "/admin",
  "/agent",
];

const PUBLIC_ROUTES = [
  "/super-admin/dashboard",
  "/super-admin/admin-managers",
  "/super-admin/partenaires",
  "/super-admin/demandes",
  "/super-admin/logs",
  "/super-admin/preuves",
  "/super-admin/securite",
  "/super-admin/analytics",
  "/super-admin/parrainages",
  "/super-admin/paiements",
  "/super-admin/notifications",
  "/super-admin/boutiques",
  "/super-admin/agents",
  "/super-admin/abonnements",
  "/super-admin/parametres",
  "/super-admin/candidatures",
  "/super-admin/AIAgent",
  "/admin-manager/dashboard",
  "/admin-manager/agents",
  "/admin-manager/boutiques",
  "/admin-manager/alertes",
  "/admin-manager/notifications",
  "/admin-manager/comparer",
  "/admin-manager/performances",
  "/admin-manager/support",
  "/admin-manager/parametres",
  "/admin-manager/commissions",
  "/admin/login",
  "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route);
  if (isPublic) return NextResponse.next();

  const adminToken = request.cookies.get("adminToken")?.value;
  const managerToken = request.cookies.get("managerToken")?.value;
  const agentToken = request.cookies.get("agentToken")?.value;

  const isSuperAdmin = pathname.startsWith("/super-admin");
  const isManager = pathname.startsWith("/admin-manager");
  const isAgent = pathname.startsWith("/agent");

  if (isSuperAdmin && adminToken) return NextResponse.next();
  if (isManager && (managerToken || adminToken)) return NextResponse.next();
  if (isAgent && agentToken) return NextResponse.next();
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin-manager") && adminToken) return NextResponse.next();

  if (isSuperAdmin || isAgent) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isManager) {
    return NextResponse.redirect(new URL("/manager-login", request.url));
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin-manager/:path*",
    "/admin/:path*",
    "/agent/:path*",
  ],
};
