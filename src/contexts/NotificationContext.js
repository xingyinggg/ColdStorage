// contexts/NotificationContext.js
"use client";

import { createContext, useContext } from "react";
import { useNotification as useNotificationHook } from "@/utils/hooks/useNotification";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const notificationData = useNotificationHook();

  return (
    <NotificationContext.Provider value={notificationData}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    );
  }
  return context;
}
