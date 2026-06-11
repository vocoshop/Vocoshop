"use client";

export function scoreColor(s: number): string {
  return s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444";
}

export function scoreLabel(s: number): string {
  return s >= 80 ? "Excellent" : s >= 60 ? "Correct" : s >= 40 ? "À surveiller" : "Problématique";
}

export function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function fmtFCFA(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA";
}

export function agentName(a: any): string {
  return a.name || [a.firstName, a.lastName].filter(Boolean).join(" ") || "Agent";
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
