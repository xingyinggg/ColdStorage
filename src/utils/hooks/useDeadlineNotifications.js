import { useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * Hook for managing deadline notifications
 * Provides automatic and manual triggering of deadline checks
 */
export const useDeadlineNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const supabase = createClient();
  const lastCheckRef = useRef(0);
  const cooldownMs = 2 * 60 * 1000; // 2 minute cooldown between manual checks

  /**
   * Manually trigger deadline checks
   * @param {boolean} force - Skip cooldown if true
   * @returns {Promise<Object>} Result of deadline checks
   */
  const triggerDeadlineCheck = useCallback(
    async (force = false) => {
      // Respect cooldown unless forced
      const now = Date.now();
      if (!force && now - lastCheckRef.current < cooldownMs) {
        console.log("⏱️ Deadline check skipped (cooldown)");
        return { skipped: true, reason: "cooldown" };
      }

      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("No authentication token");
        }

        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/notification/check-deadlines`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ force }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        setLastResult(result);
        lastCheckRef.current = now;

        console.log("✅ Deadline check completed:", result);
        return result;
      } catch (error) {
        console.error("❌ Error triggering deadline check:", error);
        setLastResult({ error: error.message });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [supabase, cooldownMs]
  );

  /**
   * Get current deadline service status
   * @returns {Promise<Object>} Service status
   */
  const getDeadlineStatus = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/notification/deadline-status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setStatus(result.data);
      return result.data;
    } catch (error) {
      console.error("Error getting deadline status:", error);
      throw error;
    }
  }, [supabase]);

  /**
   * Check if deadline service is ready for another check
   * @returns {boolean} Whether ready for another check
   */
  const isReadyForCheck = () => {
    if (!status) return true;
    if (status.nextCheckAvailable === "immediately") return true;
    return new Date() >= new Date(status.nextCheckAvailable);
  };

  return {
    loading,
    status,
    lastResult,
    triggerDeadlineCheck,
    getDeadlineStatus,
    isReadyForCheck,
  };
};
