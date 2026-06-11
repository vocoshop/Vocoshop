"use client";

export function LoadingSpinner({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          border: "3px solid #27272a",
          borderTopColor: "#a855f7",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
