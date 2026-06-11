// middleware/requireRoles.ts
import { Request, Response, NextFunction } from "express";

export function requireRoles(roles: string[]) {
return (req: Request, res: Response, next: NextFunction) => {
const role = req?.user?.role;
if (!role || !roles.includes(role)) {
return res.status(403).json({ error: "Accès refusé." });
}
next();
};
}
