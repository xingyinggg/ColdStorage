import { getServiceClient } from "../lib/supabase.js";

/**
 * Deadline Notification Service
 * Handles checking for upcoming deadlines and sending notifications
 * Optimized for development environment - runs on-demand instead of cron
 */

class DeadlineNotificationService {
  constructor(dbClient = null) {
    this.db = dbClient || getServiceClient(); // Allow dependency injection for testing
    this.lastCheck = null; // Track when we last checked to avoid spam
    this.checkCooldown = 5 * 60 * 1000; // 5 minutes cooldown between checks
  }

  /**
   * Check if we should run deadline notifications (respects cooldown)
   * @returns {boolean} Whether to run the check
   */
  shouldCheckDeadlines() {
    if (!this.lastCheck) return true;
    return Date.now() - this.lastCheck > this.checkCooldown;
  }

  /**
   * Check for upcoming deadlines (1, 3, 7 days before)
   * @param {boolean} forceCheck - Skip cooldown if true
   * @returns {Object} Result with notifications created
   */
  async checkUpcomingDeadlines(forceCheck = false) {
    try {
      // Respect cooldown unless forced
      if (!forceCheck && !this.shouldCheckDeadlines()) {
        return {
          success: true,
          message: "Deadline check skipped due to cooldown",
          notifications: [],
          skipped: true,
        };
      }

      this.lastCheck = Date.now();
      const today = new Date();
      const notifications = [];
      let duplicatesPrevented = 0;

      // Check for deadlines in 1, 3, and 7 days
      const checkDays = [1, 3, 7];

      for (const days of checkDays) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + days);

        // Format dates for the query
        const startDate = targetDate.toISOString().split("T")[0];
        const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        // Query tasks with deadlines on target date
        const { data: tasks, error } = await this.db
          .from("tasks")
          .select("id, title, due_date, owner_id, collaborators, status")
          .gte("due_date", startDate)
          .lt("due_date", endDate)
          .neq("status", "completed");

        if (error) {
          console.error("Error fetching tasks for deadline check:", error);
          continue;
        }

        for (const task of tasks || []) {
          // Get all people who should receive notifications (owner + collaborators)
          const recipients = [task.owner_id];
          if (task.collaborators && Array.isArray(task.collaborators)) {
            recipients.push(...task.collaborators.map((id) => parseInt(id)));
          }

          // Create notifications for each recipient
          for (const empId of recipients) {
            // Check if notification already sent
            const existingNotification = await this.checkExistingNotification(
              task.id,
              empId,
              "Upcoming Deadline", // Updated type
              days
            );

            if (!existingNotification) {
              // Create the notification title in the format you specified
              const title = `${days} days before ${task.title} is due`;

              const notification = await this.createDeadlineNotification({
                emp_id: empId,
                task_id: task.id,
                type: "Upcoming Deadline",
                title: title,
                description: `Your task "${task.title}" is due in ${days} day${
                  days > 1 ? "s" : ""
                } (${task.due_date}). Please make sure to complete it on time.`,
                metadata: null, // Not using metadata since column doesn't exist
              });

              if (notification) {
                notifications.push({
                  type: "Upcoming Deadline",
                  days_remaining: days,
                  task_id: task.id,
                  title: title,
                });
              }
            } else {
              duplicatesPrevented++;
            }
          }
        }
      }

      return {
        notifications,
        duplicates_prevented: duplicatesPrevented,
      };
    } catch (error) {
      console.error("Error checking upcoming deadlines:", error);
      throw error;
    }
  }

  /**
   * Check for missed deadlines (overdue tasks)
   * @param {boolean} forceCheck - Skip cooldown if true
   * @returns {Object} Result with notifications created
   */
  async checkMissedDeadlines(forceCheck = false) {
    try {
      // Respect cooldown unless forced
      if (!forceCheck && !this.shouldCheckDeadlines()) {
        return {
          success: true,
          message: "Missed deadline check skipped due to cooldown",
          notifications: [],
          skipped: true,
        };
      }

      const today = new Date().toISOString().split("T")[0];
      const notifications = [];
      let duplicatesPrevented = 0;

      // Query tasks that are overdue
      const { data: tasks, error } = await this.db
        .from("tasks")
        .select("id, title, due_date, owner_id, collaborators, status")
        .lt("due_date", today)
        .neq("status", "completed");

      if (error) {
        console.error("Error fetching overdue tasks:", error);
        throw error;
      }

      for (const task of tasks || []) {
        // Get all people who should receive notifications (owner + collaborators)
        const recipients = [task.owner_id];
        if (task.collaborators && Array.isArray(task.collaborators)) {
          recipients.push(...task.collaborators.map((id) => parseInt(id)));
        }

        // Create notifications for each recipient
        for (const empId of recipients) {
          // Check if notification already sent for this overdue task
          const existingNotification = await this.checkExistingNotification(
            task.id,
            empId,
            "Deadline Missed"
          );

          if (!existingNotification) {
            const notification = await this.createDeadlineNotification({
              emp_id: empId,
              task_id: task.id,
              type: "Deadline Missed",
              title: `Overdue: ${task.title}`,
              description: `Your task "${task.title}" was due on ${task.due_date} and is now overdue. Please complete it as soon as possible.`,
              metadata: null, // Not using metadata since column doesn't exist
            });

            if (notification) {
              notifications.push({
                type: "Deadline Missed",
                task_id: task.id,
                emp_id: empId,
              });
            }
          } else {
            duplicatesPrevented++;
          }
        }
      }

      return {
        notifications,
        duplicates_prevented: duplicatesPrevented,
      };
    } catch (error) {
      console.error("Error checking missed deadlines:", error);
      throw error;
    }
  }

  /**
   * Check if a notification already exists to prevent duplicates
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} type - Notification type
   * @param {number} daysRemaining - Days remaining (for deadline reminders)
   * @returns {boolean} True if notification exists
   */
  async checkExistingNotification(taskId, userId, type, daysRemaining = null) {
    try {
      let query = this.db
        .from("notifications")
        .select("id")
        .eq("emp_id", parseInt(userId)) // Ensure it's a number
        .eq("task_id", parseInt(taskId)) // Ensure it's a number
        .eq("type", type)
        .eq("read", false);

      // For upcoming deadline notifications, also check the title contains the days
      // This ensures we don't send duplicate "7 days before" notifications
      if (type === "Upcoming Deadline" && daysRemaining !== null) {
        query = query.like("title", `${daysRemaining} days before%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error checking existing notification:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error("Error in checkExistingNotification:", error);
      return false;
    }
  }

  /**
   * Create a deadline notification
   * @param {Object} notificationData - Notification data
   * @returns {Object} Created notification or null
   */
  async createDeadlineNotification({
    emp_id,
    task_id,
    type,
    title,
    description,
    metadata, // We'll store key info in title/description instead
  }) {
    try {
      const { data, error } = await this.db
        .from("notifications")
        .insert({
          emp_id: parseInt(emp_id), // Ensure it's a number for bigint
          task_id: parseInt(task_id), // Ensure it's a number for bigint
          type,
          notification_category: "deadline",
          title,
          description,
          read: false,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating deadline notification:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in createDeadlineNotification:", error);
      return null;
    }
  }

  /**
   * Manually trigger deadline checks (for development)
   * This replaces the cron scheduler for localhost development
   * @param {boolean} forceCheck - Skip cooldown if true
   * @returns {Object} Combined results from both checks
   */
  async runDeadlineChecks(forceCheck = false) {
    try {
      console.log("Running manual deadline checks...");

      const upcomingResults = await this.checkUpcomingDeadlines(forceCheck);
      const missedResults = await this.checkMissedDeadlines(forceCheck);

      const combinedResults = {
        success: true,
        timestamp: new Date().toISOString(),
        upcoming: upcomingResults,
        missed: missedResults,
        totalNotifications:
          (upcomingResults.notifications?.length || 0) +
          (missedResults.notifications?.length || 0),
      };

      console.log(
        `Deadline checks completed. Created ${combinedResults.totalNotifications} notifications.`
      );
      return combinedResults;
    } catch (error) {
      console.error("Error in manual deadline checks:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get status of the deadline service
   * @returns {Object} Service status info
   */
  getStatus() {
    return {
      mode: "development",
      lastCheck: this.lastCheck,
      cooldownMs: this.checkCooldown,
      nextCheckAvailable: this.lastCheck
        ? new Date(this.lastCheck + this.checkCooldown).toISOString()
        : "immediately",
    };
  }

  /**
   * Error handler for the service
   * @param {Error} error - Error object
   */
  onError(error) {
    console.error("DeadlineNotificationService error:", error);
  }
}

// Create singleton instance
const deadlineNotificationService = new DeadlineNotificationService();

// Export individual functions for backwards compatibility with tests
export const checkUpcomingDeadlines = async (forceCheck = false) => {
  return await deadlineNotificationService.checkUpcomingDeadlines(forceCheck);
};

export const checkMissedDeadlines = async (forceCheck = false) => {
  return await deadlineNotificationService.checkMissedDeadlines(forceCheck);
};

export const createDeadlineNotification = async (notificationData) => {
  return await deadlineNotificationService.createDeadlineNotification(
    notificationData
  );
};

export const runDeadlineChecks = async (forceCheck = false) => {
  return await deadlineNotificationService.runDeadlineChecks(forceCheck);
};

export const getDeadlineServiceStatus = () => {
  return deadlineNotificationService.getStatus();
};

export { DeadlineNotificationService, deadlineNotificationService };
