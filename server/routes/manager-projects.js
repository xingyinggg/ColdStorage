import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();

// Get ALL projects (for managers only)
router.get("/all", async (req, res) => {
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
      return res.status(404).json({ error: "Employee ID not found" });
    }

    // Check if user is a manager
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("emp_id", empId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userData.role?.toLowerCase() !== 'manager') {
      return res.status(403).json({ error: "Access denied. Manager role required." });
    }

    // Get ALL projects for managers
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Create a new project (manager functionality)
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

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(404).json({ error: "Employee ID not found" });
    }

    // Check if user is a manager
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("emp_id", empId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userData.role?.toLowerCase() !== 'manager') {
      return res.status(403).json({ error: "Access denied. Manager role required." });
    }

    const { title, description, status = "active", members = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Extract emp_ids from members array if they are objects
    const memberIds = members.map((member) => {
      if (typeof member === "object" && member.emp_id) {
        return member.emp_id;
      }
      return member;
    });

    const projectData = {
      title,
      description,
      owner_id: empId,
      status,
      members: memberIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("projects")
      .insert([projectData])
      .select()
      .single();

    if (error) {
      console.error("Create project error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a project (manager functionality - can delete any project)
router.delete("/:id", async (req, res) => {
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
      return res.status(404).json({ error: "Employee ID not found" });
    }

    // Check if user is a manager
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("emp_id", empId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userData.role?.toLowerCase() !== 'manager') {
      return res.status(403).json({ error: "Access denied. Manager role required." });
    }

    const projectId = req.params.id;

    // Managers can delete any project (no owner check needed)
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("Delete project error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Project deleted successfully" });
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;