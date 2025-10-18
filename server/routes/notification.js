import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { title, description, type, emp_id, created_at } = req.body;

    if (!title || !description || !type || !emp_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert([{ title, description, type, emp_id, created_at, read: false }])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    res.type("application/json");
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, description, created_at, read")
      .eq("emp_id", empId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (e) {
    console.error("Error fetching notifications:", e);
    res.status(500).json({ error: e.message });
  }
});

// Mark a notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    const { id } = req.params;

    // Update notification to mark as read, but only for the current user
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("emp_id", empId)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.patch("/mark-all-read", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    // Update all notifications for this user to mark as read
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("emp_id", empId)
      .eq("read", false)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: "All notifications marked as read",
      updated_count: data?.length || 0,
      data: data,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
router.get("/unread-count", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(401).json({ error: "Employee ID not found for user" });
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("emp_id", empId)
      .eq("read", false);

    if (error) {
      console.error("Supabase count error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ unread_count: count || 0 });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
