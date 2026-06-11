// src/offline/bootstrap.ts
import { initNetworkListener } from "../utils/network";

let started = false;

/**
* Boot offline (UNE seule fois)
* - lance uniquement le network listener global
* - la sync est maintenant gérée par syncEngine.ts
*/
export function initOfflineBootstrap() {
if (started) return () => {};
started = true;

// ✅ uniquement listener réseau global
const unsubscribeNet = initNetworkListener();

// cleanup
return () => {
try {
(unsubscribeNet as any)?.();
} catch {}
};
}
