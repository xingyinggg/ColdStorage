"use client";

import { NotificationProvider } from "@/contexts/NotificationContext";

export default function ClientProviders({ children }) {
  return (
    <NotificationProvider>
      {children}
    </NotificationProvider>
  );
}