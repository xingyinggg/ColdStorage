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
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const lockKey = "deadline_check_lock";

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

      // Cross-tab lock: prevent other tabs from triggering the same check within the cooldown window
      try {
        if (!force && typeof window !== "undefined") {
          const raw = localStorage.getItem(lockKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.ts && now - parsed.ts < cooldownMs) {
                console.log("⏳ Deadline check skipped (another tab recently triggered it)");
                return { skipped: true, reason: "cross-tab-cooldown" };
              }
            } catch (e) {
              // ignore parse errors and continue
            }
          }
        }
      } catch (e) {
        // If localStorage access fails, continue and rely on server-side checks
      }

      setLoading(true);
      try {
        // Acquire cross-tab lock (timestamp + instance id)
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              lockKey,
              JSON.stringify({ ts: now, id: instanceIdRef.current })
            );
          }
        } catch (e) {
          // ignore localStorage failures
        }

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
        // Release cross-tab lock only if this instance set it
        try {
          if (typeof window !== "undefined") {
            const raw = localStorage.getItem(lockKey);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.id === instanceIdRef.current) {
                  localStorage.removeItem(lockKey);
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        } catch (e) {
          // ignore localStorage failures
        }
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
/* istanbul ignore file */