import { Request, Response, NextFunction } from "express";
import Store from "../models/Store";

/**
* 🔥 Middleware global
* Met à jour la dernière activité boutique automatiquement
*/
export const storeActivityTracker = async (
req: Request,
res: Response,
next: NextFunction
) => {
try {
// On suppose que ton auth middleware met req.storeId
const storeId =
(req as any).storeId ||
(req as any).user?.storeId ||
req.headers["x-store-id"];

if (storeId) {
// update silencieux, sans ralentir la requête
Store.updateOne(
{ _id: storeId },
{ $set: { lastActiveAt: new Date() } }
).catch(() => {});
}
} catch {}

next();
};
