"use client";

import { useEffect } from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import { useNotification } from "@/utils/hooks/useNotification";
import { useDeadlineNotifications } from "@/utils/hooks/useDeadlineNotifications";

/**
 * Component that initializes notifications and automatically checks deadlines
 * Runs deadline checks when user is authenticated, anywhere on the website
 */
export default function NotificationInitializer() {
  const { user } = useAuth();
  const { fetchUnreadCount, refresh } = useNotification();
  const { triggerDeadlineCheck } = useDeadlineNotifications();

  useEffect(() => {
    if (user) {
      console.log(" User authenticated, initializing notifications and deadline checks...");
      
      // Immediately fetch unread count and notifications
      fetchUnreadCount();
      refresh();
      
      // Run deadline check immediately on login (force it)
      triggerDeadlineCheck(true).then((result) => {
        if (result.data?.totalNotifications > 0) {
          console.log(`📧 ${result.data.totalNotifications} new deadline notifications created on login`);
          setTimeout(() => {
            fetchUnreadCount();
            refresh();
          }, 500);
        }
      }).catch((error) => {
        console.error("Initial deadline check failed:", error);
      });
      
      // Set up periodic deadline checks every 5 minutes
      const deadlineInterval = setInterval(async () => {
        try {
          const result = await triggerDeadlineCheck(false); // Don't force periodic checks
          if (result.data?.totalNotifications > 0) {
            console.log(` ${result.data.totalNotifications} new deadline notifications from periodic check`);
            fetchUnreadCount();
          }
        } catch (error) {
          console.error("Periodic deadline check failed:", error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Set up focus listener for real-time updates when user returns to tab
      const handleFocus = async () => {
        console.log("Window focused, refreshing notifications and checking deadlines...");
        fetchUnreadCount();
        try {
          const result = await triggerDeadlineCheck(false);
          if (result.data?.totalNotifications > 0) {
            console.log(`📧 ${result.data.totalNotifications} new deadline notifications from focus`);
            fetchUnreadCount();
          }
        } catch (error) {
          console.error(" Focus deadline check failed:", error);
        }
      };

      // Set up visibility change listener
      const handleVisibilityChange = async () => {
        if (!document.hidden) {
          console.log("Tab became visible, refreshing notifications and checking deadlines...");
          fetchUnreadCount();
          try {
            const result = await triggerDeadlineCheck(false);
            if (result.data?.totalNotifications > 0) {
              console.log(` ${result.data.totalNotifications} new deadline notifications from visibility`);
              fetchUnreadCount();
            }
          } catch (error) {
            console.error(" Visibility deadline check failed:", error);
          }
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(deadlineInterval);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, fetchUnreadCount, refresh, triggerDeadlineCheck]);

  // This component doesn't render anything
  return null;
}