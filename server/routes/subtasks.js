import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();

// Create subtask
router.post("/", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No token provided" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const currentEmpId = await getEmpIdForUserId(user.id);
    const { 
      parent_task_id, 
      title, 
      description, 
      priority, 
      status, 
      due_date,
      collaborators 
    } = req.body;

    // Verify user has access to parent task
    const { data: parentTask, error: parentError } = await supabase
      .from("tasks")
      .select("owner_id, collaborators")
      .eq("id", parent_task_id)
      .single();

    if (parentError || !parentTask) {
      return res.status(404).json({ error: "Parent task not found" });
    }

    // Check if user can create subtasks (owner or collaborator)
    const isOwner = parentTask.owner_id === currentEmpId;
    const isCollaborator = Array.isArray(parentTask.collaborators) && 
                          parentTask.collaborators.includes(currentEmpId);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: "You don't have permission to create subtasks for this task" });
    }

    // Create subtask
    const { data: subtask, error: subtaskError } = await supabase
      .from("sub_tasks")
      .insert({
        parent_task_id,
        title,
        description: description || null,
        priority: priority || "medium",
        status: status || "ongoing",
        due_date: due_date || null,
        collaborators: collaborators || [],
        created_by: currentEmpId,
        owner_id: currentEmpId
      })
      .select()
      .single();

    if (subtaskError) throw subtaskError;

    res.json({ success: true, subtask });
  } catch (error) {
    console.error("Error creating subtask:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get subtasks for a task
router.get("/task/:taskId", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No token provided" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { taskId } = req.params;

    const { data, error } = await supabase
      .from("sub_tasks")
      .select(`
        *,
        owner:users!owner_id(emp_id, name, email),
        creator:users!created_by(emp_id, name, email)
      `)
      .eq("parent_task_id", taskId)
      .order("created_at");

    if (error) throw error;
    res.json({ subtasks: data || [] });
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update subtask
router.put("/:id", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No token provided" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const currentEmpId = await getEmpIdForUserId(user.id);
    const { id } = req.params;
    const updates = req.body;

    // Update subtask (only owner can update)
    const { data, error } = await supabase
      .from("sub_tasks")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", currentEmpId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Subtask not found or no permission" });

    res.json({ success: true, subtask: data });
  } catch (error) {
    console.error("Error updating subtask:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete subtask
router.delete("/:id", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No token provided" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const currentEmpId = await getEmpIdForUserId(user.id);
    const { id } = req.params;

    const { error } = await supabase
      .from("sub_tasks")
      .delete()
      .eq("id", id)
      .eq("owner_id", currentEmpId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting subtask:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;