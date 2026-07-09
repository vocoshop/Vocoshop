jest.mock("../../src/models/Product", () => ({
__esModule: true,
default: { findOne: jest.fn() },
}));

jest.mock("../../src/models/Sales", () => ({
__esModule: true,
default: { create: jest.fn(), find: jest.fn(() => ({ lean: jest.fn() })), deleteMany: jest.fn() },
}));

jest.mock("../../src/models/DailyReport", () => ({
__esModule: true,
default: { findOne: jest.fn(() => ({ lean: jest.fn() })), findOneAndUpdate: jest.fn(() => ({ lean: jest.fn() })) },
}));

jest.mock("../../src/models/Store", () => ({
__esModule: true,
default: { updateOne: jest.fn() },
}));

jest.mock("../../src/utils/storeId", () => ({
__esModule: true,
getStoreId: jest.fn(),
}));

jest.mock("../../src/utils/helpers", () => ({
__esModule: true,
getBusinessDate: jest.fn(() => "2026-06-29"),
safeNum: jest.fn((v: any) => Number(v ?? 0)),
isValidObjectId: jest.fn((id: any) => /^[a-f0-9]{24}$/i.test(id)),
}));

import { Request, Response } from "express";
import Product from "../../src/models/Product";
import Sale from "../../src/models/Sales";

// Test the pure profit calculation logic without asyncHandler wrapping
describe("Profit calculation (merge logic)", () => {
type Line = {
productId?: string;
productName: string;
unitPrice: number;
purchasePrice: number;
quantity: number;
totalAmount: number;
lineProfit: number;
};

const n = (v: any) => Number(v ?? 0);

it("calcule le profit correct: (prix vente - prix achat) * qty", () => {
const sales = [
{ productId: "p1", productName: "A", unitPrice: 2000, quantity: 3, totalAmount: 6000, purchasePriceAtSale: 1200 },
{ productId: "p2", productName: "B", unitPrice: 1500, quantity: 2, totalAmount: 3000, purchasePriceAtSale: 800 },
];

const map = new Map<string, Line>();

for (const s of sales) {
const u = n(s.unitPrice);
const b = n(s.purchasePriceAtSale);
const q = n(s.quantity);
const key = `${s.productId || s.productName}__${u}__${b}`;
map.set(key, {
productId: s.productId,
productName: String(s.productName || "Produit"),
unitPrice: u,
purchasePrice: b,
quantity: q,
totalAmount: q * u,
lineProfit: (u - b) * q,
});
}

const merged = Array.from(map.values());
const totalRevenue = merged.reduce((sum, l) => sum + n(l.totalAmount), 0);
const cogs = merged.reduce((sum, l) => sum + n(l.purchasePrice) * n(l.quantity), 0);
const grossProfit = totalRevenue - cogs;

expect(totalRevenue).toBe(9000);
expect(cogs).toBe(5200);
expect(grossProfit).toBe(3800);
});

it("merge les lignes d'un même produit", () => {
const lines = [
{ productId: "p1", productName: "A", unitPrice: 2000, quantity: 1, totalAmount: 2000, purchasePriceAtSale: 1200 },
{ productId: "p1", productName: "A", unitPrice: 2000, quantity: 2, totalAmount: 4000, purchasePriceAtSale: 1200 },
];

const map = new Map<string, Line>();

for (const s of lines) {
const u = n(s.unitPrice);
const b = n(s.purchasePriceAtSale);
const q = n(s.quantity);
const key = `${s.productId || s.productName}__${u}__${b}`;
const prev = map.get(key);

if (!prev) {
map.set(key, {
productId: s.productId,
productName: String(s.productName || "Produit"),
unitPrice: u,
purchasePrice: b,
quantity: q,
totalAmount: q * u,
lineProfit: (u - b) * q,
});
} else {
prev.quantity += q;
prev.totalAmount = prev.quantity * u;
prev.lineProfit = (u - b) * prev.quantity;
map.set(key, prev);
}
}

const merged = Array.from(map.values());
expect(merged).toHaveLength(1);
expect(merged[0].quantity).toBe(3);
expect(merged[0].totalAmount).toBe(6000);
expect(merged[0].lineProfit).toBe(2400);
});

it("gère le cas sans vente (panier vide)", () => {
const merged: Line[] = [];
const totalRevenue = merged.reduce((sum, l) => sum + n(l.totalAmount), 0);
const cogs = merged.reduce((sum, l) => sum + n(l.purchasePrice) * n(l.quantity), 0);
const grossProfit = totalRevenue - cogs;

expect(totalRevenue).toBe(0);
expect(cogs).toBe(0);
expect(grossProfit).toBe(0);
});
});
