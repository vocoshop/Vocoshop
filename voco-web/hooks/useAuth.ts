"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type TokenKey = "adminToken" | "managerToken" | "agentToken";

export function useAuth(requiredToken: TokenKey = "adminToken") {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(requiredToken);
    if (!t) {
      const loginMap: Record<TokenKey, string> = {
        adminToken: "/admin/login",
        managerToken: "/manager-login",
        agentToken: "/login",
      };
      router.push(loginMap[requiredToken]);
      return;
    }
    setToken(t);
    setLoading(false);
  }, [requiredToken, router]);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  return { token, headers, loading };
}
