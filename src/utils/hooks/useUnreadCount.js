// utils/hooks/useUnreadCount.js
"use client";

import { useState, useEffect } from "react";
import { notificationStore } from "@/utils/notificationStore";

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(
    notificationStore.getUnreadCount()
  );

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe((count) => {
      //   console.log(`Store notified: unread count changed to ${count}`);
      setUnreadCount(count);
    });

    return unsubscribe;
  }, []);

  return unreadCount;
}
