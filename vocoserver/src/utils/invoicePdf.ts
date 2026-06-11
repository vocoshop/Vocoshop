import PDFDocument from "pdfkit";

export const buildInvoicePdf = (res:any,invoice:any)=>{

const doc = new PDFDocument({
size:"A4",
margin:50
});

res.setHeader("Content-Type","application/pdf");
doc.pipe(res);

/* ========================================
🔥 WATERMARK VOCOSHOP
======================================== */

doc.save();
doc.rotate(-35,{origin:[300,400]});

for(let y=0;y<900;y+=200){
doc.fillColor("#6E56CF")
.fontSize(60)
.opacity(0.05)
.text("VOCOSHOP",50,y);
}

doc.restore();
doc.opacity(1);
doc.fillColor("#000");

/* ========================================
HEADER FACTURE
======================================== */

doc.fontSize(22).text("Facture Vocoshop",{align:"center"});

doc.moveDown();

doc.fontSize(12);
doc.text(`Numéro : ${invoice.invoiceNumber}`);
doc.text(`Plan : ${invoice.plan}`);
doc.text(`Montant : ${invoice.amount} ${invoice.currency}`);

doc.moveDown();

doc.text("Merci pour votre confiance.");

doc.end();
};
