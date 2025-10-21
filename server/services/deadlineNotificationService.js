import { supabase } from "../lib/supabase.js";
import cron from "node-cron";

/**
 * Deadline Notification Service
 * Handles checking for upcoming deadlines and sending notifications
 */

class DeadlineNotificationService {
  constructor() {
    this.isRunning = false;
    this.schedule = "0 9 * * *"; // Daily at 9 AM
    this.cronJob = null;
  }

  /**
   * Check for upcoming deadlines (1, 3, 7 days before)
   * @returns {Object} Result with notifications created
   */
  async checkUpcomingDeadlines() {
    try {
      const today = new Date();
      const notifications = [];
      const duplicatesPrevented = 0;

      // Check for deadlines in 1, 3, and 7 days
      const checkDays = [1, 3, 7];

      for (const days of checkDays) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + days);

        // Query tasks with deadlines on target date
        const { data: tasks, error } = await supabase
          .from("tasks")
          .select("id, title, deadline, assignee_id, status")
          .gte("deadline", targetDate.toISOString().split("T")[0])
          .lt(
            "deadline",
            new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
          )
          .neq("status", "completed");

        if (error) {
          console.error("Error fetching tasks for deadline check:", error);
          continue;
        }

        for (const task of tasks || []) {
          // Check if notification already sent
          const existingNotification = await this.checkExistingNotification(
            task.id,
            task.assignee_id,
            "deadline_reminder",
            days
          );

          if (!existingNotification) {
            const notification = await this.createDeadlineNotification({
              user_id: task.assignee_id,
              task_id: task.id,
              type: "deadline_reminder",
              title: `Deadline Reminder: ${task.title}`,
              description: `Your task "${task.title}" is due in ${days} day${
                days > 1 ? "s" : ""
              }`,
              metadata: {
                days_remaining: days,
                task_id: task.id,
                deadline: task.deadline,
              },
            });

            notifications.push({
              type: "deadline_reminder",
              days_remaining: days,
              task_id: task.id,
            });
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
   * Check for missed deadlines
   * @returns {Object} Result with notifications for missed deadlines
   */
  async checkMissedDeadlines() {
    try {
      const today = new Date();
      const notifications = [];

      // Query tasks with deadlines before today that are not completed
      const { data: overdueTasks, error } = await supabase
        .from("tasks")
        .select("id, title, deadline, assignee_id, status")
        .lt("deadline", today.toISOString().split("T")[0])
        .neq("status", "completed");

      if (error) {
        console.error("Error fetching overdue tasks:", error);
        return { notifications: [] };
      }

      for (const task of overdueTasks || []) {
        // Check if missed deadline notification already sent
        const existingNotification = await this.checkExistingNotification(
          task.id,
          task.assignee_id,
          "deadline_missed"
        );

        if (!existingNotification) {
          await this.createDeadlineNotification({
            user_id: task.assignee_id,
            task_id: task.id,
            type: "deadline_missed",
            title: `Deadline Missed: ${task.title}`,
            description: `Your task "${task.title}" deadline has passed. Please complete it as soon as possible.`,
            metadata: {
              task_id: task.id,
              deadline: task.deadline,
              days_overdue: Math.ceil(
                (today - new Date(task.deadline)) / (1000 * 60 * 60 * 24)
              ),
            },
          });

          notifications.push({
            type: "deadline_missed",
            task_id: task.id,
          });
        }
      }

      return { notifications };
    } catch (error) {
      console.error("Error checking missed deadlines:", error);
      throw error;
    }
  }

  /**
   * Check if a notification already exists to prevent duplicates
   */
  async checkExistingNotification(taskId, userId, type, daysRemaining = null) {
    try {
      let query = supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("metadata->task_id", taskId);

      if (daysRemaining !== null) {
        query = query.eq("metadata->days_remaining", daysRemaining);
      }

      const { data, error } = await query.single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error checking existing notification:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Error in checkExistingNotification:", error);
      return false;
    }
  }

  /**
   * Create a deadline notification in the database
   */
  async createDeadlineNotification({
    user_id,
    task_id,
    type,
    title,
    description,
    metadata,
  }) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          user_id,
          title,
          type,
          description,
          metadata,
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating deadline notification:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in createDeadlineNotification:", error);
      throw error;
    }
  }

  /**
   * Set up the deadline checking scheduler
   */
  async setupDeadlineScheduler() {
    try {
      if (this.cronJob) {
        this.cronJob.destroy();
      }

      this.cronJob = cron.schedule(
        this.schedule,
        async () => {
          console.log("Running scheduled deadline check...");
          try {
            await this.checkUpcomingDeadlines();
            await this.checkMissedDeadlines();
            console.log("Deadline check completed successfully");
          } catch (error) {
            console.error("Error in scheduled deadline check:", error);
            this.onError(error);
          }
        },
        {
          scheduled: false, // Don't start immediately
        }
      );

      this.isRunning = false;

      return {
        isRunning: this.isRunning,
        schedule: this.schedule,
        errorHandling: true,
        onError: this.onError.bind(this),
      };
    } catch (error) {
      console.error("Error setting up deadline scheduler:", error);
      throw error;
    }
  }

  /**
   * Start the deadline checking scheduler
   */
  start() {
    if (this.cronJob) {
      this.cronJob.start();
      this.isRunning = true;
      console.log("Deadline notification scheduler started");
    }
  }

  /**
   * Stop the deadline checking scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log("Deadline notification scheduler stopped");
    }
  }

  /**
   * Error handler for scheduler
   */
  onError(error) {
    console.error("Deadline scheduler error:", error);
    // Could add additional error handling like sending admin notifications
  }
}

// Create singleton instance
const deadlineService = new DeadlineNotificationService();

// Export individual functions that delegate to the service
export const checkUpcomingDeadlines = () =>
  deadlineService.checkUpcomingDeadlines();
export const checkMissedDeadlines = () =>
  deadlineService.checkMissedDeadlines();
export const createDeadlineNotification = (params) =>
  deadlineService.createDeadlineNotification(params);
export const setupDeadlineScheduler = () =>
  deadlineService.setupDeadlineScheduler();

// Export functions for testing and usage
export { deadlineService, DeadlineNotificationService };

// Default export
export default deadlineService;
