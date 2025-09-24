import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";
import { TaskSchema } from "../schemas/task.js";

const router = Router();

// Create task
router.post("/", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    const parsed = TaskSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const { data, error } = await supabase
      .from("tasks")
      .insert([{ ...parsed.data, owner_id: empId }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List tasks
router.get("/", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    // First, get tasks where user is in collaborators
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .contains("collaborators", [empId])
      .order("created_at", { ascending: false });

    if (tasksError) return res.status(400).json({ error: tasksError.message });

    // If there are tasks, fetch manager information for each task
    if (tasksData && tasksData.length > 0) {
      // Get unique owner_ids
      const ownerIds = [
        ...new Set(tasksData.map((task) => task.owner_id).filter(Boolean)),
      ];

      if (ownerIds.length > 0) {
        // Fetch manager info for all unique owner_ids
        const { data: managersData, error: managersError } = await supabase
          .from("users")
          .select("emp_id, name, department")
          .in("emp_id", ownerIds);

        if (!managersError && managersData) {
          // Create a map of emp_id to manager info
          const managersMap = {};
          managersData.forEach((manager) => {
            managersMap[manager.emp_id] = manager;
          });

          // Add manager info to each task
          tasksData.forEach((task) => {
            if (task.owner_id && managersMap[task.owner_id]) {
              task.manager = managersMap[task.owner_id];
            }
          });
        }
      }
    }

    res.json({ tasks: tasksData || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update task
router.put("/:id", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    const { id } = req.params;
    const updates = req.body || {};

    const { data, error } = await supabase
      .from("tasks")
      .update({ ...updates })
      .eq("id", Number(id))
      .eq("owner_id", empId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete task
router.delete("/:id", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    const { id } = req.params;
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", Number(id))
      .eq("owner_id", empId);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get tasks for multiple projects (needed for your frontend)
router.post("/bulk", async (req, res) => {
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

    const { project_ids } = req.body;

    if (!project_ids || !Array.isArray(project_ids)) {
      return res.status(400).json({ error: "project_ids array is required" });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, project_id, description, due_date, priority")
      .in("project_id", project_ids);

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

// Get tasks for a specific project
router.get("/project/:projectId", async (req, res) => {
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

    const { projectId } = req.params;

    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, project_id, description, due_date, priority")
      .eq("project_id", projectId);

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

export default router;
