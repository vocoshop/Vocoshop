"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

const COLORS = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#3b82f6",
};

export function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        padding: "12px 20px",
        background: COLORS[type],
        color: "#fff",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 9999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const show = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  return { toast, show, hide: () => setToast(null) };
}
