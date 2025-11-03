// utils/hooks/useNotification.js
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { notificationStore } from "@/utils/notificationStore";
import React, { createContext, useContext } from "react";

export default function DebugToken() {
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
    })();
  }, [supabase]);

  return <div>Open the console. Log in first if needed.</div>;
}

// Optional Context provider wrapper so components can share the same
// `useNotification` instance via React Context (alternative to the global store).
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const notif = useNotification();
  return (
    <NotificationContext.Provider value={notif}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotificationContext must be used inside NotificationProvider"
    );
  }
  return ctx;
}

// Hook for subscribing to the global unread count (shared store)
export function useUnreadCount() {
  const [count, setCount] = useState(notificationStore.getUnreadCount());

  useEffect(() => {
    // subscribe to store updates
    const unsubscribe = notificationStore.subscribe((newCount) => {
      setCount(newCount);
    });

    // ensure initial value is current
    setCount(notificationStore.getUnreadCount());

    return () => unsubscribe();
  }, []);

  return count;
}

export function useNotification() {
  const [notification, setNotification] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabaseRef = useRef(createClient());

  // Utility function to recalculate unread count from current notifications
  const recalculateUnreadCount = useCallback(
    (notifications) => {
      const count = notifications.filter((n) => !n.read).length;
      //   console.log(`Updating unread count: ${unreadCount} → ${count}`, {
      //     notifications: notifications.length,
      //     unread: notifications.filter((n) => !n.read).length,
      //     read: notifications.filter((n) => n.read).length,
      //   });
      setUnreadCount(count);
      // Update the global store to notify all components
      notificationStore.setUnreadCount(count);
      return count;
    },
    [] // Remove unreadCount from deps - we're not reading it, only setting it
  );

  //const { data: { session } } = await supabase.auth.getSession();

  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabaseRef.current.auth.getSession();
    console.log("Auth token:", session?.access_token);
    return session?.access_token;
  };

  const createNotification = async (notificationData) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(notificationData),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let message = `HTTP error! status: ${response.status}`;
        try {
          const body = JSON.parse(text);
          message = body?.error || body?.message || message;
        } catch { }
        throw new Error(message);
      }

      const newNotification = await response.json();

      // Always refresh notifications after creating one to ensure unread count is accurate
      // This is especially important when creating notifications for the current user
      //   console.log(
      //     `Created notification: ${newNotification.title}, refreshing notifications...`
      //   );

      // Refresh notifications to get updated count
      setTimeout(() => {
        console.log(
          `🔄 Refreshing notifications after creating: ${newNotification.title}`
        );
        fetchNotification();
      }, 100); // Small delay to ensure backend has processed the notification

      return { success: true, notification: newNotification };
    } catch (err) {
      console.error("Create notification error:", err);
      return { success: false, error: err.message };
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notification/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let message = `HTTP error! status: ${response.status}`;
        try {
          const body = JSON.parse(text);
          message = body?.error || body?.message || message;
        } catch { }
        throw new Error(message);
      }

      const updatedNotification = await response.json();

      // Update local state immediately using functional update
      setNotification((prevNotifications) => {
        const updatedNotifications = prevNotifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        );

        // Recalculate unread count from the updated notifications
        recalculateUnreadCount(updatedNotifications);

        return updatedNotifications;
      });

      return { success: true, notification: updatedNotification };
    } catch (err) {
      console.error("Mark as read error:", err);
      return { success: false, error: err.message };
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notification/mark-all-read`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        let message = `HTTP error! status: ${response.status}`;
        try {
          const body = JSON.parse(text);
          message = body?.error || body?.message || message;
        } catch { }
        throw new Error(message);
      }

      const result = await response.json();

      // Update local state immediately using functional update
      setNotification((prevNotifications) => {
        const updatedNotifications = prevNotifications.map((n) => ({
          ...n,
          read: true,
        }));

        // Recalculate unread count (should be 0)
        recalculateUnreadCount(updatedNotifications);

        return updatedNotifications;
      });

      return { success: true, result };
    } catch (err) {
      console.error("Mark all as read error:", err);
      return { success: false, error: err.message };
    }
  };

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabaseRef.current.auth.getSession();
      if (sessErr) throw sessErr;
      if (!session?.access_token) {
        // Silently return if not authenticated - this is expected on initial load
        console.log("⚠️ Not authenticated - skipping unread count fetch");
        setUnreadCount(0);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/notification/unread-count`, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          Accept: "application/json",
        },
      });

      const text = await res.text();
      const body = text ? JSON.parse(text) : { unread_count: 0 };

      if (!res.ok) {
        console.error(`API error ${res.status}:`, body?.error || res.statusText);
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }

      const newCount = body.unread_count || 0;
      setUnreadCount(newCount);

      // Update the global store to notify all components
      notificationStore.setUnreadCount(newCount);

      console.log(`✅ Updated unread count: ${newCount}`);
    } catch (err) {
      console.error("Error in fetchUnreadCount:", err);
      setUnreadCount(0);
      // Don't update store on error to maintain last known good state
    }
  }, []);
  // Fetch all notifications via Express API
  const fetchNotification = useCallback(async () => {
    try {
      //   console.log(`🔄 Fetching notifications...`);
      setLoading(true);
      setError(null);
      const {
        data: { session },
        error: sessErr,
      } = await supabaseRef.current.auth.getSession();
      if (sessErr) throw sessErr;
      if (!session?.access_token) {
        // Silently return if not authenticated - this is expected on initial load
        console.log("⚠️ Not authenticated - skipping notifications fetch");
        setNotification([]);
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/notification`, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          Accept: "application/json",
        },
      });

      const text = await res.text();
      const body = text ? JSON.parse(text) : []; // your API returns an array

      if (!res.ok)
        throw new Error(body?.error || `Request failed: ${res.status}`);

      setNotification(Array.isArray(body) ? body : []); // <-- expect array

      // Recalculate unread count based on fetched notifications
      //   console.log(
      //     `✅ Fetched ${Array.isArray(body) ? body.length : 0} notifications`
      //   );
      recalculateUnreadCount(Array.isArray(body) ? body : []);
    } catch (err) {
      console.error("Error in fetchNotification:", err);
      setError(err.message || String(err));
      setNotification([]);
    } finally {
      setLoading(false);
    }
  }, [recalculateUnreadCount]);

  useEffect(() => {
    fetchNotification();
    fetchUnreadCount();

    // Set up periodic refresh for real-time updates (every 30 seconds)
    const intervalId = setInterval(() => {
      console.log("🔄 Periodic notification refresh...");
      fetchUnreadCount(); // Quick count refresh
    }, 30000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - functions are stable, only run on mount

  // Additional effect to keep unread count in sync with notification state
  useEffect(() => {
    if (notification.length > 0) {
      recalculateUnreadCount(notification);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification]); // Only depend on notification array, recalculateUnreadCount is stable

  return {
    notification,
    loading,
    error,
    unreadCount,
    refresh: fetchNotification,
    createNotification,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount,
    // activeTasks: getActiveTasks(),
    // completedTasks: getCompletedTasks(),
    // overdueTasks: getOverdueTasks(),
    // fetchTasks,
    // createTask,
    // updateTask,
    // deleteTask,
    // toggleTaskComplete,
    // getTasksByPriority,
  };
}
