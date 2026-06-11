import { Request, Response } from "express";
import Invoice from "../models/Invoice";

/**
=====================================================
🔥 GET MY INVOICES — ULTRA SAFE
=====================================================
*/
export const getMyInvoices = async (req: Request, res: Response) => {

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

console.error("❌ getMyInvoices error",e);
return res.status(500).json({error:"server error"});

}

};
