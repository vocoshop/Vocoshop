import express from "express";
import crypto from "crypto";
import authMiddleware from "../middleware/authMiddleware";
import { publicInvoiceLimiter } from "../middleware/rateLimiter";
import Invoice from "../models/Invoice";
import Store from "../models/Store"; // ✅ IMPORTANT
import { generateInvoicePDF } from "../services/pdfInvoiceService";

const router = express.Router();

/**
=====================================================
🧾 GET MES FACTURES (PRIVÉ APP)
=====================================================
*/
router.get("/my", authMiddleware, async (req:any,res)=>{

try{

const storeId = req.user?.storeId;

if(!storeId){
return res.status(401).json({error:"storeId manquant"});
}

const invoices = await Invoice.find({storeId})
.sort({createdAt:-1})
.lean();

return res.json(invoices);

}catch(e){
console.log("invoice fetch error",e);
return res.status(500).json({error:"invoice error"});
}

});

/**
=====================================================
📄 DOWNLOAD FACTURE PDF (PRIVÉ APP)
🔥 VERSION SAAS PRO + PROFIL BOUTIQUE
=====================================================
*/
router.get("/pdf/:id", authMiddleware, async (req:any,res)=>{

try{

const storeId = req.user?.storeId;

if(!storeId){
return res.status(401).json({error:"storeId manquant"});
}

/**
🔥 récupérer facture
*/
const invoice = await Invoice.findOne({
_id:req.params.id,
storeId
});

if(!invoice){
return res.status(404).json({error:"Invoice not found"});
}

/**
🔥 BACKFILL JETON PUBLIC
Les factures créées avant ce correctif n'ont pas de publicToken.
On le génère au premier téléchargement du PDF (lazy, sans migration).
*/
if(!invoice.publicToken){
invoice.publicToken = crypto.randomBytes(24).toString("hex");
await invoice.save();
}

/**
🔥 récupérer profil boutique (nom commercial)
*/
const store = await Store.findById(storeId).lean() as any;

/**
🔥 injecter données profil dans le PDF
Architecture propre SaaS
*/
const invoiceData = {
...invoice.toObject(),
storeName: store?.storeName || "Boutique Vocoshop"
};

/**
🔥 GENERATE PDF
*/
const pdfBuffer = await generateInvoicePDF(invoiceData);

/**
🔥 Retour BASE64 (Expo Safe)
*/
return res.json({
file: pdfBuffer.toString("base64")
});

}catch(e){
console.log("pdf error",e);
return res.status(500).json({error:"pdf error"});
}

});

/**
=====================================================
🌍 PUBLIC INVOICE (CAPABILITY URL)
=====================================================
🔐 Exige le jeton `?t=` présent dans le QR code du PDF.
   invoiceNumber seul ne suffit plus : VOC-2026-482913 ne
   donne que ~900 000 combinaisons/an et était donc énumérable.
➡️ storeId, transactionId, publicToken, _id ne sont JAMAIS exposés.
➡️ Réponse 404 identique pour "facture inconnue" et "mauvais jeton"
   (pas d'oracle permettant de tester l'existence d'une facture).
*/
router.get("/public/:invoiceNumber", publicInvoiceLimiter, async (req:any,res)=>{

try{

const { invoiceNumber } = req.params;
const token = typeof req.query.t === "string" ? req.query.t : "";

if(!invoiceNumber || !token){
return res.status(404).json({error:"Facture introuvable"});
}

const invoice = await Invoice.findOne({
invoiceNumber,
publicToken: token
}).lean();

if(!invoice){
return res.status(404).json({error:"Facture introuvable"});
}

return res.json({
invoiceNumber: invoice.invoiceNumber,
plan: invoice.plan,
amount: invoice.amount,
currency: invoice.currency,
billingPeriodStart: invoice.billingPeriodStart,
billingPeriodEnd: invoice.billingPeriodEnd,
paidAt: invoice.paidAt,
status: invoice.paidAt ? "PAYEE" : "EN_ATTENTE"
});

}catch(e){
console.log("public invoice error",e);
return res.status(500).json({error:"invoice error"});
}

});

export default router;
