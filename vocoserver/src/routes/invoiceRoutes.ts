import express from "express";
import authMiddleware from "../middleware/authMiddleware";
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
🌍 PUBLIC INVOICE (SANS TOKEN)
=====================================================
*/
router.get("/public/:invoiceNumber", async (req:any,res)=>{

try{

const { invoiceNumber } = req.params;

if(!invoiceNumber){
return res.status(400).send("invoiceNumber manquant");
}

const invoice = await Invoice.findOne({
invoiceNumber
}).lean();

if(!invoice){
return res.status(404).send("Facture introuvable");
}

return res.json(invoice);

}catch(e){
console.log("public invoice error",e);
return res.status(500).send("invoice error");
}

});

export default router;
