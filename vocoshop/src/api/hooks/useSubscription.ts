import { useEffect, useState } from "react";
import API from "../api";

export default function useSubscription() {
const [subscription, setSubscription] = useState<any>(null);
const [loadingSubscription, setLoading] = useState(true);

useEffect(() => {
let mounted = true;

const load = async () => {
try {
const res = await API.get("/subscription/me");

if (!mounted) return;

setSubscription(res.data);
} catch (e) {
console.log("subscription fetch error", e);
} finally {
if (mounted) setLoading(false);
}
};

load();

return () => {
mounted = false;
};
}, []);

return { subscription, loadingSubscription };
}
