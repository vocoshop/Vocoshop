import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_AUTH_ROUTES = ["/admin/login", "/admin", "/manager-login"];

const PUBLIC_PAGES = ["/", "/login", "/devenir-agent"];

function getSecret(role: "admin" | "manager" | "agent"): Uint8Array {
  const s =
    role === "agent"
      ? process.env.AGENT_JWT_SECRET
      : process.env.JWT_SECRET;
  if (!s) {
    throw new Error(`❌ ${role === "agent" ? "AGENT_JWT_SECRET" : "JWT_SECRET"} non configuré`);
  }
  return new TextEncoder().encode(s);
}

async function verifyToken(token: string, role: "admin" | "manager" | "agent"): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(role));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer les pages publiques
  if (
    PUBLIC_PAGES.some((route) => pathname === route) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/uploads/")
  ) {
    return NextResponse.next();
  }

  // Laisser passer les routes d'auth (login)
  if (PUBLIC_AUTH_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  const isSuperAdmin = pathname.startsWith("/super-admin");
  const isManager = pathname.startsWith("/admin-manager");
  const isAdmin = pathname.startsWith("/admin") && !pathname.startsWith("/admin-manager");
  const isAgent = pathname.startsWith("/agent");

  // Vérifier les tokens JWT existants
  const adminToken = request.cookies.get("adminToken")?.value;
  const managerToken = request.cookies.get("managerToken")?.value;
  const agentToken = request.cookies.get("agentToken")?.value;

  // Rediriger vers login si le token est invalide ou manquant
  const redirectToLogin = (target: string) => {
    const url = new URL(target, request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  };

  if (isSuperAdmin) {
    if (adminToken && (await verifyToken(adminToken, "admin"))) return NextResponse.next();
    return redirectToLogin("/admin/login");
  }

  if (isManager) {
    if (managerToken && (await verifyToken(managerToken, "manager"))) return NextResponse.next();
    if (adminToken && (await verifyToken(adminToken, "admin"))) return NextResponse.next();
    return redirectToLogin("/manager-login");
  }

  if (isAdmin) {
    if (adminToken && (await verifyToken(adminToken, "admin"))) return NextResponse.next();
    return redirectToLogin("/admin/login");
  }

  if (isAgent) {
    if (agentToken && (await verifyToken(agentToken, "agent"))) return NextResponse.next();
    return redirectToLogin("/login");
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
