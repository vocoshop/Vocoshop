import { Request, Response, NextFunction } from "express";
import { logSystem } from "../utils/systemLogger";

export default async function systemLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  const originalSend = res.send.bind(res);
  res.send = function (body: any) {
    const duration = Date.now() - start;

    const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;
    const ua = req.headers["user-agent"] as string || null;
    const path = req.originalUrl || req.url || "";
    const method = req.method || "";
    const status = res.statusCode || 500;

    if (status >= 500) {
      logSystem("error", `${method} ${path} → ${status} (${duration}ms)`, {
        source: "api",
        method,
        path,
        statusCode: status,
        durationMs: duration,
        ip,
        userAgent: ua,
        details: typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body)?.slice(0, 200),
      });
    } else if (status >= 400) {
      logSystem("warning", `${method} ${path} → ${status} (${duration}ms)`, {
        source: "api",
        method,
        path,
        statusCode: status,
        durationMs: duration,
        ip,
        userAgent: ua,
      });
    } else if (duration > 2000) {
      logSystem("performance", `SLOW REQUEST: ${method} ${path} took ${duration}ms`, {
        source: "api",
        method,
        path,
        statusCode: status,
        durationMs: duration,
        ip,
      });
    }

    return originalSend(body);
  };

  next();
}