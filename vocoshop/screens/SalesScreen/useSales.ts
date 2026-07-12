import {
useEffect,
useMemo,
useState,
useContext,
useCallback,
useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API from "../../src/api/api";
import { AuthContext } from "../../src/api/context/AuthContext";

import { runOrQueue } from "../../src/api/offline/queue";
import { isOffline } from "../../src/api/utils/network";

/* ================= TYPES ================= */
export interface Product {
_id: string;
name: string;
sellPrice: number;
quantity: number;
}

export interface CartItem {
product: Product;
qty: number;
total: number;
}

export interface CarnetItem {
productId: string;
productName: string;
sellPrice: number;
qty: number;
}

/* ================= HOOK ================= */
export default function useSales() {
const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
}),
[token, storeId]
);

const [products, setProducts] = useState<Product[]>([]);
const [filtered, setFiltered] = useState<Product[]>([]);
const [search, setSearch] = useState("");
const [loading, setLoading] = useState(true);
const [cart, setCart] = useState<CartItem[]>([]);

/* =====================================================
LOAD PRODUCTS (SAFE OFFLINE)
===================================================== */
const loadProducts = useCallback(async () => {
try {
setLoading(true);

// 🔥 IMPORTANT : ne pas taper API si offline
if (isOffline()) {
setLoading(false);
return;
}

const res = await API.get("/products", { headers });

const data: any = res.data;
const list: Product[] = Array.isArray(data)
? data
: Array.isArray(data?.products)
? data.products
: [];

setProducts(list);
setFiltered(list);
} catch (err) {
console.log("❌ loadProducts:", err);
} finally {
setLoading(false);
}
}, [headers]);

useEffect(() => {
loadProducts();
}, [loadProducts]);

useFocusEffect(
useCallback(() => {
loadProducts();
}, [loadProducts])
);

/* =====================================================
SEARCH
===================================================== */
const applySearch = (val: string) => {
setSearch(val);

if (!val.trim()) {
setFiltered(products);
return;
}

const lower = val.toLowerCase();
setFiltered(products.filter((p) => p.name.toLowerCase().includes(lower)));
};

/* =====================================================
ADD TO CART
===================================================== */
const addToCart = (product: Product, qty: number) => {
if (qty <= 0) return;

setCart((prev) => {
  if (qty > product.quantity) return prev;

  const exists = prev.find(
    (c) => c.product._id === product._id
  );

  if (exists) {
    const newQty = exists.qty + qty;

    if (newQty > product.quantity) return prev;

    return prev.map((c) =>
      c.product._id === product._id
      ? {
          ...c,
          qty: newQty,
          total: newQty * c.product.sellPrice,
        }
      : c
    );
  }

  return [
    ...prev,
    {
      product,
      qty,
      total: qty * product.sellPrice,
    },
  ];
});
};

/* =====================================================
CART ACTIONS
===================================================== */
const increaseQty = (productId: string) => {
setCart((prev) =>
  prev.map((c) => {
    if (c.product._id !== productId) return c;
    if (c.qty + 1 > c.product.quantity) return c;
    return {
      ...c,
      qty: c.qty + 1,
      total: (c.qty + 1) * c.product.sellPrice,
    };
  })
);
};

const decreaseQty = (productId: string) => {
setCart((prev) =>
prev
.map((c) =>
c.product._id === productId
? {
...c,
qty: c.qty - 1,
total: (c.qty - 1) * c.product.sellPrice,
}
: c
)
.filter((c) => c.qty > 0)
);
};

const removeFromCart = (productId: string) => {
setCart((prev) =>
prev.filter((c) => c.product._id !== productId)
);
};

const setItemQty = (productId: string, qty: number) => {
if (qty <= 0) {
removeFromCart(productId);
return;
}
setCart((prev) =>
prev.map((c) => {
if (c.product._id !== productId) return c;
const clamped = Math.min(qty, c.product.quantity);
return {
...c,
qty: clamped,
total: clamped * c.product.sellPrice,
};
})
);
};

/* =====================================================
CART TOTAL
===================================================== */
const cartTotal = useMemo(
() => cart.reduce((sum, c) => sum + c.total, 0),
[cart]
);

/* =====================================================
🔥 OPTIMISTIC STOCK UPDATE (OFFLINE)
===================================================== */
const applyOptimisticStock = useCallback(() => {
setProducts((prev) =>
prev.map((p) => {
const sold = cart.find((c) => c.product._id === p._id);
if (!sold) return p;

return {
...p,
quantity: Math.max(0, p.quantity - sold.qty),
};
})
);

setFiltered((prev) =>
prev.map((p) => {
const sold = cart.find((c) => c.product._id === p._id);
if (!sold) return p;

return {
...p,
quantity: Math.max(0, p.quantity - sold.qty),
};
})
);
}, [cart]);

/* =====================================================
FINALIZE SALE (ONLINE + OFFLINE PRO)
= "success" | "error" | "offline"
===================================================== */
const [selling, setSelling] = useState(false);
const [completedSales, setCompletedSales] = useState(0);
const [dayActive, setDayActive] = useState(false);

const DAY_ACTIVE_KEY = `dayActive_${storeId}`;
const DAY_OPENED_KEY = `dayOpenedAt_${storeId}`;

const resetDayOpen = useCallback(() => {
setDayActive(false);
setCompletedSales(0);
AsyncStorage.removeItem(DAY_ACTIVE_KEY);
AsyncStorage.removeItem(DAY_OPENED_KEY);
}, [DAY_ACTIVE_KEY, DAY_OPENED_KEY]);

// Auto-clôture si on change de jour
useEffect(() => {
if (!token || !storeId) return;
(async () => {
const val = await AsyncStorage.getItem(DAY_ACTIVE_KEY);
if (val !== "true") return;

const openedAt = await AsyncStorage.getItem(DAY_OPENED_KEY);
const today = new Date().toISOString().split("T")[0];

if (openedAt && openedAt !== today) {
try { await API.post("/sales/close-day", {}, { headers }); } catch (e) { console.log("⚠️ auto-close day:", e); }
resetDayOpen();
return;
}

setDayActive(true);
})();
}, []); // eslint-disable-line react-hooks/exhaustive-deps

const incCompletedSales = useCallback(() => {
setCompletedSales((c) => {
const next = c + 1;
if (!dayActive) {
setDayActive(true);
AsyncStorage.multiSet([
[DAY_ACTIVE_KEY, "true"],
[DAY_OPENED_KEY, new Date().toISOString().split("T")[0]],
]);
}
return next;
});
}, [dayActive, DAY_ACTIVE_KEY, DAY_OPENED_KEY]);

const finalizeSale = async (): Promise<"success" | "error" | "offline"> => {
if (!cart.length) return "error";

try {
  setSelling(true);
  const payload = {
    items: cart.map((c) => ({
      productId: c.product._id,
      quantity: c.qty,
    })),
  };

  const result = await runOrQueue({
    title: "Vente panier",
    method: "POST",
    url: "/sales/cart",
    body: payload,
    headers,
  });

  if (result.mode === "offline") {
    applyOptimisticStock();
    setCart([]);
    incCompletedSales();
    setSelling(false);
    return "offline";
  }

  setCart([]);
  incCompletedSales();
  loadProducts();
  setSelling(false);
  return "success";
} catch (err) {
  console.log("❌ finalizeSale:", err);
  setSelling(false);
  return "error";
}
};

/* =====================================================
QUICK SELL (1 tap = 1 vente)
===================================================== */
const quickSell = async (product: Product) => {
  if (product.quantity < 1) return false;

  const payload = { productId: product._id, quantity: 1 };

  try {
    const result = await runOrQueue({
      title: `Vente ${product.name}`,
      method: "POST",
      url: "/sales/add",
      body: payload,
      headers,
    });

    // Optimistic stock update
    setProducts((prev) =>
      prev.map((p) =>
        p._id === product._id ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p
      )
    );
    setFiltered((prev) =>
      prev.map((p) =>
        p._id === product._id ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p
      )
    );

    return true;
  } catch (err) {
    console.log("❌ quickSell:", err);
    return false;
  }
};

/* =====================================================
CARNET (saisie cahier)
===================================================== */
const [carnet, setCarnet] = useState<CarnetItem[]>([]);

const carnetTotal = useMemo(
() => carnet.reduce((s, c) => s + c.qty * c.sellPrice, 0),
[carnet]
);

const setCarnetQty = useCallback((product: Product, qty: number) => {
setCarnet((prev) => {
if (qty <= 0) return prev.filter((c) => c.productId !== product._id);
const exists = prev.find((c) => c.productId === product._id);
if (exists) return prev.map((c) => c.productId === product._id ? { ...c, qty } : c);
return [...prev, { productId: product._id, productName: product.name, sellPrice: product.sellPrice, qty }];
});
}, []);

const submitCarnet = useCallback(async (): Promise<boolean> => {
const items = carnet.filter((c) => c.qty > 0);
if (!items.length) return false;

const payload = {
items: items.map((c) => ({
productId: c.productId,
quantity: c.qty,
})),
};

try {
const result = await runOrQueue({
title: "Carnet",
method: "POST",
url: "/sales/cart",
body: payload,
headers,
});

if (result.mode === "offline") {
items.forEach((c) => {
setProducts((prev) =>
prev.map((p) =>
p._id === c.productId
? { ...p, quantity: Math.max(0, p.quantity - c.qty) }
: p
)
);
});
}

setCarnet([]);
loadProducts();
return true;
} catch (err) {
console.log("❌ submitCarnet:", err);
return false;
}
}, [carnet, headers, loadProducts]);

/* =====================================================
RETURN
===================================================== */
return {
loading,
products,
filtered,
search,
cart,
cartTotal,
selling,
completedSales,
dayActive,
resetDayOpen,
carnet,
carnetTotal,
setCarnetQty,
submitCarnet,
clearCarnet: () => setCarnet([]),

applySearch,
addToCart,
increaseQty,
decreaseQty,
removeFromCart,
setItemQty,
finalizeSale,
quickSell,
};
}
