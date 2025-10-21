import { useState } from "react";

/**
 * Hook for managing deadline notifications in development environment
 * Provides manual trigger and status checking for deadline notifications
 */
export const useDeadlineNotifications = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  /**
   * Manually trigger deadline checks
   * @param {boolean} force - Skip cooldown if true
   * @returns {Promise<Object>} Result of deadline checks
   */
  const triggerDeadlineCheck = async (force = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications/check-deadlines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`, // Adjust based on your auth setup
        },
        body: JSON.stringify({ force }),
      });

      const result = await response.json();
      setLastResult(result);

      if (result.success) {
        console.log("Deadline check completed:", result.data);
        return result.data;
      } else {
        throw new Error(result.error || "Deadline check failed");
      }
    } catch (error) {
      console.error("Error triggering deadline check:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get current deadline service status
   * @returns {Promise<Object>} Service status
   */
  const getDeadlineStatus = async () => {
    try {
      const response = await fetch("/api/notifications/deadline-status", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`, // Adjust based on your auth setup
        },
      });

      const result = await response.json();

      if (result.success) {
        setStatus(result.data);
        return result.data;
      } else {
        throw new Error(result.error || "Failed to get status");
      }
    } catch (error) {
      console.error("Error getting deadline status:", error);
      throw error;
    }
  };

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
