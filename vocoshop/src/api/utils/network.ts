// src/utils/network.ts
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

let isConnected = true;
let isInternetReachable = true;

// ✅ override manuel (pour test offline sans couper le wifi)
let forcedOffline: boolean | null = null;

type NetworkState = {
online: boolean;
isConnected: boolean;
isInternetReachable: boolean;
forcedOffline: boolean | null;
};

type Listener = (s: NetworkState) => void;

const listeners = new Set<Listener>();

function computeOnline() {
const realOnline = isConnected && isInternetReachable;
// si forcedOffline === true -> offline forcé
if (forcedOffline === true) return false;
// si forcedOffline === false -> online forcé (utile si NetInfo bug)
if (forcedOffline === false) return true;
return realOnline;
}

function notify() {
const payload: NetworkState = {
online: computeOnline(),
isConnected,
isInternetReachable,
forcedOffline,
};
listeners.forEach((fn) => fn(payload));
}

/**
* ✅ Forcer online/offline (DEV)
* - true => OFFLINE forcé
* - false => ONLINE forcé
* - null => retour au vrai NetInfo
*/
export function setForceOffline(v: boolean | null) {
forcedOffline = v;
console.log("🧪 setForceOffline =", v);
notify();
}

export function getForceOffline() {
return forcedOffline;
}

/**
* Initialise l'écoute réseau globale
* À appeler UNE SEULE FOIS au boot de l'app
* ✅ retourne unsubscribe()
*/
export function initNetworkListener() {
const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
isConnected = Boolean(state.isConnected);

isInternetReachable =
state.isInternetReachable === null ? isConnected : Boolean(state.isInternetReachable);

  // log optionnel (désactivé en production pour perf)
  if (__DEV__) {
    console.log("🌐 Network state:", {
      isConnected,
      isInternetReachable,
      online: computeOnline(),
      forcedOffline,
    });
  }

notify();
});

return unsubscribe;
}

/** ✅ Abonnement aux changements réseau (utile pour offline bootstrap) */
export function onNetworkChange(cb: Listener) {
listeners.add(cb);

// push immédiat de l'état actuel
cb({
online: computeOnline(),
isConnected,
isInternetReachable,
forcedOffline,
});

return () => listeners.delete(cb);
}

/** Retourne true si on considère l'app ONLINE */
export function isOnline(): boolean {
return computeOnline();
}

/** Retourne true si OFFLINE */
export function isOffline(): boolean {
return !computeOnline();
}
