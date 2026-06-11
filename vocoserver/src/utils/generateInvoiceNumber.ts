export const generateInvoiceNumber = ()=>{

const date = new Date();
const year = date.getFullYear();

const rand = Math.floor(100000 + Math.random()*900000);

return `VOC-${year}-${rand}`;
};
