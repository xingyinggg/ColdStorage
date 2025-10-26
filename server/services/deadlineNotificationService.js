import { getServiceClient } from "../lib/supabase.js";

class DeadlineNotificationService {
  constructor() {
    // Don't initialize supabase client during construction
    this.supabase = null;
    this.lastCheck = null;
  }

  // Get Singapore date in YYYY-MM-DD format
  getSingaporeDate(offsetDays = 0) {
    const now = new Date();
    // Convert to Singapore timezone (UTC+8)
    const singaporeTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    // Add offset days
    singaporeTime.setDate(singaporeTime.getDate() + offsetDays);

    // Return in YYYY-MM-DD format
    return singaporeTime.toISOString().split("T")[0];
  }

  // Initialize the supabase client when first needed
  getSupabaseClient() {
    if (!this.supabase) {
      try {
        this.supabase = getServiceClient();
      } catch (e) {
        // In test or env-missing scenarios, defer client init; callers may mock getServiceClient
        this.supabase = null;
      }
    }
    return this.supabase;
  }

  /**
   * Check for upcoming deadlines (1, 3, 7 days before)
   * @param {boolean} forceCheck - Skip cooldown if true
   * @returns {Object} Result with notifications created
   */
  async checkUpcomingDeadlines(forceCheck = false) {
    try {
      // Check cooldown (5 minutes for automatic checks, can be bypassed with force)
      if (!forceCheck && this.lastCheck) {
        const timeSinceLastCheck = Date.now() - this.lastCheck;
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes

        if (timeSinceLastCheck < cooldownPeriod) {
          const remainingTime = cooldownPeriod - timeSinceLastCheck;
          const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));

          return {
            success: true,
            message: "Deadline check skipped due to cooldown",
            nextCheckAvailable: new Date(
              Date.now() + remainingTime
            ).toISOString(),
            remainingMinutes,
            notifications: [],
            skipped: true,
          };
        }
      }

      // Update last check time
      this.lastCheck = Date.now();

      let supabase = this.getSupabaseClient();
      if (!supabase) {
        // Allow tests to mock getServiceClient dynamically after construction
        supabase = getServiceClient();
        this.supabase = supabase;
      }

      const checkDays = [1, 3, 7];
      const allNotifications = [];
      let totalCreated = 0;
      let duplicatesPrevented = 0;

      // Check each day interval separately using Singapore dates
      for (const days of checkDays) {
        // Calculate target date using Singapore timezone
        const targetDateStr = this.getSingaporeDate(days);

        // Query tasks due on target date
        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select("id, title, due_date, owner_id, collaborators, status")
          .eq("due_date", targetDateStr)
          .neq("status", "completed");

        if (tasksError) {
          continue;
        }

        if (!tasks || tasks.length === 0) {
          continue;
        }

        // Process each task
        for (const task of tasks) {
          // Get recipients (owner + collaborators)
          const recipients = [];

          // Add owner if exists and is valid
          if (task.owner_id) {
            const ownerId = parseInt(task.owner_id);
            if (!isNaN(ownerId)) {
              recipients.push(ownerId);
            }
          }

          // Add collaborators if they exist and are valid
          if (task.collaborators && Array.isArray(task.collaborators)) {
            for (const id of task.collaborators) {
              const collabId = parseInt(id);
              if (!isNaN(collabId)) {
                recipients.push(collabId);
              }
            }
          }

          // Skip if no valid recipients
          if (recipients.length === 0) {
            continue;
          }

          // Create notification for each recipient
          for (const empId of recipients) {
            // Check for existing notification to prevent duplicates
            const existingNotification = await this.checkExistingNotification(
              task.id,
              empId,
              "Upcoming Deadline",
              days
            );

            if (existingNotification) {
              duplicatesPrevented++;
              continue;
            }

            // Create notification
            try {
              const notification = await this.createDeadlineNotification({
                emp_id: empId,
                task_id: task.id,
                type: "Upcoming Deadline",
                notification_category: "deadline",
                title: `${days} days before ${task.title} is due`,
                description: `Your task "${task.title}" is due in ${days} day${
                  days > 1 ? "s" : ""
                } (${task.due_date}). Please make sure to complete it on time.`,
                metadata: null,
              });

              if (notification) {
                allNotifications.push({
                  type: "Upcoming Deadline",
                  days_remaining: days,
                  task_id: task.id,
                  title: `${days} days before ${task.title} is due`,
                });
                totalCreated++;
              }
            } catch (createError) {
              // Silently continue on error
            }
          }
        }
      }

      const result = {
        success: true,
        message: `Deadline check completed. Created ${totalCreated} notifications.`,
        data: {
          upcoming: {
            notifications: allNotifications,
            created: totalCreated,
            duplicates_prevented: duplicatesPrevented,
          },
        },
        notifications: allNotifications,
        totalNotifications: totalCreated,
        duplicates_prevented: duplicatesPrevented,
        timestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check for missed deadlines (past due date) using Singapore timezone
   * @param {boolean} forceCheck - Skip cooldown if true
   * @returns {Object} Result with notifications created
   */
  async checkMissedDeadlines(forceCheck = false) {
    try {
      const supabase = this.getSupabaseClient();

      // Get today's date in Singapore timezone
      const todaySingapore = this.getSingaporeDate(0);

      // Query overdue tasks using Singapore timezone
      const { data: overdueTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, due_date, owner_id, collaborators, status")
        .lt("due_date", todaySingapore)
        .neq("status", "completed");

      if (tasksError) {
        return {
          success: false,
          error: tasksError.message,
          timestamp: new Date().toISOString(),
        };
      }

      if (!overdueTasks || overdueTasks.length === 0) {
        return {
          success: true,
          message: "No overdue tasks found",
          notifications: [],
          totalNotifications: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const allNotifications = [];
      let totalCreated = 0;
      let duplicatesPrevented = 0;

      // Process each overdue task
      for (const task of overdueTasks) {
        // Get recipients (owner + collaborators)
        const recipients = [];

        // Add owner if exists and is valid
        if (task.owner_id) {
          const ownerId = parseInt(task.owner_id);
          if (!isNaN(ownerId)) {
            recipients.push(ownerId);
          }
        }

        // Add collaborators if they exist and are valid
        if (task.collaborators && Array.isArray(task.collaborators)) {
          for (const id of task.collaborators) {
            const collabId = parseInt(id);
            if (!isNaN(collabId)) {
              recipients.push(collabId);
            }
          }
        }

        // Skip if no valid recipients
        if (recipients.length === 0) {
          continue;
        }

        // Create notification for each recipient
        for (const empId of recipients) {
          // Check for existing missed deadline notification
          const existingNotification = await this.checkExistingNotification(
            task.id,
            empId,
            "Deadline Missed",
            0 // Special case for missed deadlines
          );

          if (existingNotification) {
            duplicatesPrevented++;
            continue;
          }

          // Create missed deadline notification
          const notification = await this.createDeadlineNotification({
            emp_id: empId,
            task_id: task.id,
            type: "Deadline Missed",
            notification_category: "deadline",
            title: `Overdue: ${task.title} deadline has passed`,
            description: `Your task "${task.title}" was due on ${task.due_date} and is now overdue. Please complete it as soon as possible.`,
            metadata: null,
          });

          if (notification) {
            allNotifications.push({
              type: "Deadline Missed",
              task_id: task.id,
              title: `Overdue: ${task.title} deadline has passed`,
            });
            totalCreated++;
          }
        }
      }

      return {
        success: true,
        message: `Missed deadline check completed. Created ${totalCreated} notifications.`,
        notifications: allNotifications,
        totalNotifications: totalCreated,
        duplicates_prevented: duplicatesPrevented,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check for existing notification to prevent duplicates
   */
  async checkExistingNotification(taskId, empId, type, days) {
    try {
      let supabase = this.getSupabaseClient();
      if (!supabase) {
        supabase = getServiceClient();
        this.supabase = supabase;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("id, title")
        .eq("task_id", taskId)
        .eq("emp_id", empId)
        .eq("type", type)
        .eq("read", false);

      if (error) {
        return null;
      }

      if (!data || data.length === 0) return null;

      // If checking upcoming deadlines, ensure the title mentions the specific day count
      if (type === "Upcoming Deadline" && days > 0) {
        const match = data.find(
          (row) =>
            typeof row.title === "string" && row.title.includes(`${days} days`)
        );
        return match || null;
      }

      // Any existing row counts as a duplicate
      return data[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Create deadline notification in database
   */
  async createDeadlineNotification({
    emp_id,
    task_id,
    type,
    title,
    description,
    metadata,
    notification_category = "deadline",
  }) {
    try {
      // Be lenient with ID types for tests/mocks: accept numeric or string IDs
      const finalEmpId = Number.isFinite(Number(emp_id))
        ? Number(emp_id)
        : emp_id;
      const finalTaskId = Number.isFinite(Number(task_id))
        ? Number(task_id)
        : task_id;

      let supabase = this.getSupabaseClient();
      if (!supabase) {
        supabase = getServiceClient();
        this.supabase = supabase;
      }

      const notificationData = {
        emp_id: finalEmpId,
        task_id: finalTaskId,
        type,
        notification_category,
        title,
        description,
        read: false,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("notifications")
        .insert(notificationData)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to create deadline notification: ${error.message}`
        );
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Run all deadline checks (for manual triggers)
   */
  async runDeadlineChecks(forceCheck = true) {
    try {
      const upcomingResult = await this.checkUpcomingDeadlines(forceCheck);
      const missedResult = await this.checkMissedDeadlines(forceCheck);

      const totalNotifications =
        (upcomingResult.totalNotifications || 0) +
        (missedResult.totalNotifications || 0);

      return {
        success: true,
        message: `All deadline checks completed. Created ${totalNotifications} total notifications.`,
        data: {
          upcoming: upcomingResult,
          missed: missedResult,
          totalNotifications,
        },
        totalNotifications,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get last check status
   */
  getStatus() {
    return {
      lastCheck: this.lastCheck,
      nextCheckAvailable: this.lastCheck
        ? new Date(this.lastCheck + 5 * 60 * 1000).toISOString()
        : null,
      cooldownActive: this.lastCheck
        ? Date.now() - this.lastCheck < 5 * 60 * 1000
        : false,
    };
  }

  /**
   * Setup deadline scheduler (for development/production environments)
   */
  setupScheduler() {
    // In test environment, don't set up actual cron jobs
    if (process.env.NODE_ENV === "test") {
      return;
    }

    // For development/production, you could add cron scheduling here
  }
}

// Create and export service instance - but don't initialize supabase client yet
let deadlineNotificationService;

try {
  deadlineNotificationService = new DeadlineNotificationService();
} catch (error) {
  deadlineNotificationService = null;
}

// Export service instance and individual functions
export default deadlineNotificationService;

// Export individual functions for testing
export async function checkUpcomingDeadlines(forceCheck = false) {
  if (!deadlineNotificationService) {
    throw new Error("Deadline notification service not available");
  }
  return deadlineNotificationService.checkUpcomingDeadlines(forceCheck);
}

export async function checkMissedDeadlines(forceCheck = false) {
  if (!deadlineNotificationService) {
    throw new Error("Deadline notification service not available");
  }
  return deadlineNotificationService.checkMissedDeadlines(forceCheck);
}

export async function createDeadlineNotification(data) {
  if (!deadlineNotificationService) {
    throw new Error("Deadline notification service not available");
  }
  return deadlineNotificationService.createDeadlineNotification(data);
}

export async function runDeadlineChecks(forceCheck = true) {
  if (!deadlineNotificationService) {
    throw new Error("Deadline notification service not available");
  }
  return deadlineNotificationService.runDeadlineChecks(forceCheck);
}

export function setupDeadlineScheduler() {
  if (!deadlineNotificationService) {
    return;
  }
  return deadlineNotificationService.setupScheduler();
}

export function getDeadlineServiceStatus() {
  if (!deadlineNotificationService) {
    return { available: false, error: "Service not initialized" };
  }
  return { available: true, ...deadlineNotificationService.getStatus() };
}
