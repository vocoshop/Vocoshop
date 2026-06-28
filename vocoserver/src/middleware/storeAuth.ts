import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import Store from "../models/Store";

export default async function storeAuth(req: Request, res: Response, next: NextFunction) {
try {
const token = req.headers.authorization?.split(" ")[1];

if (!token) {
return res.status(401).json({ message: "Token manquant." });
}

const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

// ✅ token créé par authController = { storeId }
const storeIdFromToken = decoded?.storeId ? String(decoded.storeId) : null;

if (!storeIdFromToken) {
return res.status(401).json({ message: "Token invalide (storeId manquant)." });
}

const store = await Store.findById(storeIdFromToken).select("_id").lean();
if (!store?._id) {
return res.status(401).json({ message: "Boutique invalide." });
}

// ✅ TOUJOURS une string (évite les bugs match ObjectId vs string)
req.user = {
id: String(store._id),
storeId: String(store._id),
role: "owner",
permissions: { "*": true },
};

next();
} catch (error) {
console.error("❌ storeAuth middleware:", error);
return res.status(401).json({ message: "Token invalide." });
}
}
