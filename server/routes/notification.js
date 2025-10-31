import express from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
  getNumericIdFromEmpId,
} from "../lib/supabase.js";

// Import deadline notification functions - but handle gracefully if not available
let runDeadlineChecks;
try {
  const deadlineModule = await import(
    "../services/deadlineNotificationService.js"
  );
  runDeadlineChecks = deadlineModule.runDeadlineChecks;
} catch (error) {
  console.warn("Deadline notification service not available:", error.message);
  runDeadlineChecks = null;
}

const router = express.Router();

// Helper function to extract token from authorization header
function extractToken(authHeader) {
  if (!authHeader) return null;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
}

// GET /notification - Get all notifications for authenticated user
router.get("/", async (req, res) => {
  try {
    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Fetch notifications from database
    const supabase = getServiceClient();
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("emp_id", getNumericIdFromEmpId(empId)) // Convert emp_id to numeric ID for notifications table
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ error: "Failed to fetch notifications" });
    }

    // Automatically check for deadline notifications when user fetches notifications
    // This happens in the background and doesn't affect the response
    if (runDeadlineChecks) {
      runDeadlineChecks().catch((error) => {
        console.log("Background deadline check failed:", error.message);
      });
    }

    res.json(notifications || []);
  } catch (error) {
    console.error("Error in GET /notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /notification/unread-count - Get unread notification count for authenticated user
router.get("/unread-count", async (req, res) => {
  try {
    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Count unread notifications
    const supabase = getServiceClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("emp_id", getNumericIdFromEmpId(empId)) // Convert emp_id to numeric ID for notifications table
      .eq("read", false);

    if (error) {
      console.error("Error counting notifications:", error);
      return res.status(500).json({ error: "Failed to count notifications" });
    }

    res.json({ unread_count: count || 0 });
  } catch (error) {
    console.error("Error in GET /notification/unread-count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /notification - Create a new notification
router.post("/", async (req, res) => {
  try {
    const { recipient_id, title, type, description, emp_id, task_id } = req.body;

    // Validate required fields
    if (!title || !type || !emp_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get and validate user for authorization
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const currentEmpId = await getEmpIdForUserId(user.id);
    if (!currentEmpId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Build notification payload; include task_id when provided so notifications can be linked to tasks
    const notificationData = {
      recipient_id,
      title,
      type,
      description,
      emp_id: getNumericIdFromEmpId(emp_id), // Convert emp_id to numeric ID for notifications table
      created_at: new Date().toISOString(),
      read: false,
    };

    if (typeof task_id !== "undefined" && task_id !== null) {
      // Attach the task id field so it is persisted if the notifications table has this column
      notificationData.task_id = task_id;
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return res.status(500).json({ error: "Failed to create notification" });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error("Error in POST /notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notification/:id/read - Mark a single notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const { id: notificationId } = req.params;

    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Update notification as read
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("emp_id", getNumericIdFromEmpId(empId)) // Convert emp_id to numeric ID for notifications table
      .select()
      .single();

    if (error) {
      console.error("Error updating notification:", error);
      return res.status(500).json({ error: "Failed to update notification" });
    }

    if (!data) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error in PATCH /notification/:id/read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notification/mark-all-read - Mark all notifications as read for the user
router.patch("/mark-all-read", async (req, res) => {
  try {
    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Update all unread notifications as read
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("emp_id", getNumericIdFromEmpId(empId)) // Convert emp_id to numeric ID for notifications table
      .eq("read", false)
      .select();

    if (error) {
      console.error("Error updating notifications:", error);
      return res.status(500).json({ error: "Failed to update notifications" });
    }

    res.json({
      message: "All notifications marked as read",
      updated_count: data?.length || 0,
      data: data || [],
    });
  } catch (error) {
    console.error("Error in PATCH /notification/mark-all-read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /notification/check-deadlines - Manually trigger deadline checks
router.post("/check-deadlines", async (req, res) => {
  try {
    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    if (!runDeadlineChecks) {
      return res.status(503).json({
        error: "Deadline notification service not available",
        success: false,
      });
    }

    const { force } = req.body;
    const result = await runDeadlineChecks(force || false);

    res.json(result);
  } catch (error) {
    console.error("Error in deadline check:", error);
    res.status(500).json({
      error: "Failed to check deadlines",
      success: false,
      message: error.message,
    });
  }
});

// GET /notification/deadline-status - Get deadline service status
router.get("/deadline-status", async (req, res) => {
  try {
    // Get and validate user
    const token = extractToken(req.headers.authorization);
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    if (!runDeadlineChecks) {
      return res.json({
        success: false,
        message: "Deadline notification service not available",
        data: { available: false },
      });
    }

    const deadlineModule = await import(
      "../services/deadlineNotificationService.js"
    );
    const status = deadlineModule.getDeadlineServiceStatus();

    res.json({
      success: true,
      message: "Deadline service status retrieved",
      data: status,
    });
  } catch (error) {
    console.error("Error getting deadline status:", error);
    res.status(500).json({
      error: "Failed to get deadline status",
      success: false,
    });
  }
});

/* istanbul ignore next */
export default router;

