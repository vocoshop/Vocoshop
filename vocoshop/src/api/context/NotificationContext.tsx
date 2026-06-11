import React, { createContext, useContext, useEffect, useState } from "react";
import * as Notifications from 'expo-notifications';
import { AppState } from "react-native";
import API from "../api";
import { AuthContext } from "./AuthContext";
import { PushService } from "../services/pushService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowAlert: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* =====================================================
🔔 TYPES
===================================================== */

export type NotificationType = {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt?: string;
};

type NotificationContextType = {
  notifications: NotificationType[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  pushToken: string | null;
  setupPush: () => Promise<void>;
};

/* =====================================================
🧠 CONTEXT
===================================================== */

export const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  refreshNotifications: async () => {},
  refreshUnreadCount: async () => {},
  markAsRead: async () => {},
  pushToken: null,
  setupPush: async () => {},
});

/* =====================================================
🚀 PROVIDER
===================================================== */

export const NotificationProvider = ({ children }: any) => {
  const { token } = useContext(AuthContext);

  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushToken, setPushToken] = useState<string | null>(null);

/* =====================================================
🔄 FETCH LIST
===================================================== */

const refreshNotifications = async () => {
try {
if (!token) return;

const res: any = await API.get("/notifications");

if (res?.data) {
setNotifications(res.data || []);
}
} catch (e) {
console.log("❌ notifications fetch error", e);
}
};

/* =====================================================
🔔 FETCH BADGE COUNT
===================================================== */

const refreshUnreadCount = async () => {
try {
if (!token) {
setUnreadCount(0);
return;
}

const res: any = await API.get("/notifications/unread");

if (res?.data?.count !== undefined) {
setUnreadCount(Number(res.data.count || 0));
}
} catch (e) {
console.log("❌ unread count error", e);
}
};

/* =====================================================
✅ MARK AS READ
===================================================== */

const markAsRead = async (id: string) => {
  try {
    await API.patch(`/notifications/${id}/read`);

    setNotifications((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, isRead: true } : n
      )
    );

    refreshUnreadCount();
  } catch (e) {
    console.log("❌ markAsRead error", e);
  }
};

/* =====================================================
📱 PUSH SETUP
===================================================== */

const setupPush = async () => {
  try {
    const token = await PushService.setup();
    setPushToken(token);
  } catch (e) {
    console.log("❌ setupPush error", e);
  }
};

/* =====================================================
⚡ AUTO REFRESH LOGIN
===================================================== */

useEffect(() => {
  refreshUnreadCount();
  refreshNotifications();
  setupPush();

  const listener = Notifications.addNotificationReceivedListener((n) => {
    refreshUnreadCount();
  });
  return () => listener.remove();
}, [token]);

/* =====================================================
🔥 REALTIME UX (APP ACTIVE)
===================================================== */

useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      refreshUnreadCount();
    }
  });

  return () => sub.remove();
}, []);

/* =====================================================
PROVIDER
===================================================== */

return (
  <NotificationContext.Provider
    value={{
      notifications,
      unreadCount,
      refreshNotifications,
      refreshUnreadCount,
      markAsRead,
      pushToken,
      setupPush,
    }}
  >
    {children}
  </NotificationContext.Provider>
);
};

/* =====================================================
🔥 HOOK SAFE
===================================================== */

export function useNotifications() {
const ctx = useContext(NotificationContext);

if (!ctx) {
throw new Error(
"useNotifications doit être utilisé dans NotificationProvider"
);
}

return ctx;
}