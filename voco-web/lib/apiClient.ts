const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("adminToken") ||
    localStorage.getItem("managerToken") ||
    localStorage.getItem("agentToken") ||
    ""
  );
}

function getHeaders(): Record<string, string> {
  const token = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function logoutAndRedirect(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminInfo");
  localStorage.removeItem("managerToken");
  localStorage.removeItem("managerInfo");
  localStorage.removeItem("agentToken");
  localStorage.removeItem("agentInfo");
  window.location.href = "/admin/login";
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = { ...getHeaders(), ...(options.headers as Record<string, string>) };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    logoutAndRedirect();
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}`);
  }

  return res.json();
}

export async function fetchWithAuth<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return apiFetch<T>(path, options);
}

export function authHeaders(): Record<string, string> {
  return getHeaders();
}
