import StockLot from "../models/StockLot";
import Product from "../models/Product";

export async function recomputeProductQuantity(storeId: string, productId: string) {
const lots = await StockLot.find({ storeId, productId }).lean();

const total = lots.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

await Product.updateOne(
{ _id: productId, storeId },
{ $set: { quantity: total } }
);

return total;
}
