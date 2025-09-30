import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";
import { TaskSchema } from "../schemas/task.js";
import multer from "multer";

const router = Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

// Create task
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const empId = await getEmpIdForUserId(user.id);

    // Parse collaborators if it exists and is a string (from FormData)
    // If it's already an array (from JSON), use it directly
    let collaborators = null;
    if (req.body.collaborators !== undefined && req.body.collaborators !== null) {
      try {
        if (typeof req.body.collaborators === "string") {
          // From FormData - needs parsing
          const parsed = JSON.parse(req.body.collaborators);
          collaborators = Array.isArray(parsed) ? parsed : [];
        } else {
          // From JSON - already parsed
          collaborators = Array.isArray(req.body.collaborators) ? req.body.collaborators : [];
        }
      } catch {
        // Bad payload should not 500; return 400 with message
        return res.status(400).json({ error: "Invalid collaborators format" });
      }
    }

    // Prepare task data
    const rawStatus = (req.body.status || "unassigned");
    const normalizedStatus = typeof rawStatus === 'string'
      ? rawStatus
          .toLowerCase()
          .replace(/_/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : rawStatus;
    const taskData = {
      title: req.body.title,
      description: req.body.description || null,
      priority: req.body.priority || "medium",
      // normalizedStatus handles cases where the client sends different casing
      status: normalizedStatus,
      // accept both snake_case and camelCase from clients
      due_date: req.body.due_date || req.body.dueDate || null,
      project_id: req.body.project_id ? parseInt(req.body.project_id) : null,
      collaborators,
    };

    // Handle file upload to Supabase Storage
    let attachmentUrl = null;
    if (req.file) {
      const fileExt = req.file.originalname.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `task-attachment/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("task-attachment")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get the public URL of the uploaded file
      const { data: urlData } = supabase.storage
        .from("task-attachment")
        .getPublicUrl(filePath);

      attachmentUrl = urlData.publicUrl;
      taskData.file = attachmentUrl;
    }

    // Validate empId exists
    if (!empId) {
      throw new Error("Employee ID not found for user");
    }

    // Validate the task data
    let validatedData;
    try {
      validatedData = TaskSchema.parse(taskData);
    } catch (zErr) {
      return res.status(400).json({ error: `Validation error: ${zErr.message}` });
    }

    // Use provided owner_id or default to current user's empId
    const ownerId = req.body.owner_id || empId;

    // Ensure owner_id is a string (emp_id format)
    if (ownerId && typeof ownerId !== 'string') {
      return res.status(400).json({ error: "Invalid owner_id format - must be string" });
    }

    // Insert task into database
    const { data: newTask, error: dbError } = await supabase
      .from("tasks")
      .insert({
        ...validatedData,
        owner_id: ownerId,
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Record history (create)
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: newTask.id,
          editor_emp_id: ownerId,
          editor_user_id: user.id,
          action: 'create',
          details: { task: { id: newTask.id, title: newTask.title, status: newTask.status, priority: newTask.priority, due_date: newTask.due_date, project_id: newTask.project_id } }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (create):', hErr);
    }

    res.status(201).json(newTask);
  } catch (e) {
    console.error("Stack trace:", e.stack);
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
      .or(`owner_id.eq.${empId},collaborators.cs.{${empId}}`)
      .order("created_at", { ascending: false });

    if (tasksError) return res.status(400).json({ error: tasksError.message });

    // If there are tasks, fetch owner (manager) information and assignee (collaborator) names
    if (tasksData && tasksData.length > 0) {
      // Get unique owner_ids and collaborator emp_ids
      const ownerIds = new Set();
      const collaboratorIds = new Set();
      tasksData.forEach((task) => {
        if (task.owner_id) ownerIds.add(task.owner_id);
        if (Array.isArray(task.collaborators)) {
          task.collaborators.forEach((id) => collaboratorIds.add(id));
        }
      });

      // Fetch owners (managers)
      if (ownerIds.size > 0) {
        const { data: managersData, error: managersError } = await supabase
          .from("users")
          .select("emp_id, name, department")
          .in("emp_id", Array.from(ownerIds));

        if (!managersError && managersData) {
          const managersMap = {};
          managersData.forEach((manager) => {
            managersMap[manager.emp_id] = manager;
          });
          tasksData.forEach((task) => {
            if (task.owner_id && managersMap[task.owner_id]) {
              task.manager = managersMap[task.owner_id];
              task.owner_name = managersMap[task.owner_id]?.name || null;
            } else {
              task.owner_name = null;
            }
          });
        }
      }

      // Fetch collaborator user names and attach to each task as assignees
      if (collaboratorIds.size > 0) {
        const { data: collaboratorsData, error: collabErr } = await supabase
          .from("users")
          .select("emp_id, name, department")
          .in("emp_id", Array.from(collaboratorIds));

        if (!collabErr && collaboratorsData) {
          const collabMap = {};
          collaboratorsData.forEach((u) => {
            collabMap[u.emp_id] = u;
          });
          tasksData.forEach((task) => {
            if (Array.isArray(task.collaborators) && task.collaborators.length > 0) {
              task.assignees = task.collaborators
                .map((id) => collabMap[id])
                .filter(Boolean);
            } else {
              task.assignees = [];
            }
          });
        } else {
          // Ensure assignees is at least an empty array
          tasksData.forEach((task) => {
            if (!Array.isArray(task.assignees)) task.assignees = [];
          });
        }
      } else {
        tasksData.forEach((task) => {
          task.assignees = [];
        });
      }
    }

    res.json({ tasks: tasksData || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manager: Get all tasks (with owner info)
router.get("/manager/all", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    // Verify role is manager
    const { data: requester, error: reqErr } = await supabase
      .from("users")
      .select("id, emp_id, role")
      .eq("id", user.id)
      .single();
    if (reqErr) return res.status(400).json({ error: reqErr.message });
    const userRole = (requester?.role || "").toLowerCase();
    if (userRole !== "manager" && userRole !== "director") {
      return res.status(403).json({ error: "Forbidden: managers and directors only" });
    }

    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (tasksError) return res.status(400).json({ error: tasksError.message });

    if (tasksData && tasksData.length > 0) {
      const ownerIds = new Set();
      const collaboratorIds = new Set();
      tasksData.forEach((t) => {
        if (t.owner_id) ownerIds.add(t.owner_id);
        if (Array.isArray(t.collaborators)) t.collaborators.forEach((id) => collaboratorIds.add(id));
      });

      if (ownerIds.size > 0) {
        const { data: owners, error: ownersErr } = await supabase
          .from("users")
          .select("emp_id, name, role")
          .in("emp_id", Array.from(ownerIds));
        if (!ownersErr && owners) {
          const ownersMap = {};
          owners.forEach((o) => { ownersMap[o.emp_id] = o; });
          tasksData.forEach((task) => {
            if (task.owner_id && ownersMap[task.owner_id]) {
              task.task_owner = ownersMap[task.owner_id];
              task.owner_name = ownersMap[task.owner_id]?.name || null;
            } else {
              task.owner_name = null;
            }
          });
        }
      }

      if (collaboratorIds.size > 0) {
        const { data: collaboratorsData, error: collabErr } = await supabase
          .from("users")
          .select("emp_id, name, department")
          .in("emp_id", Array.from(collaboratorIds));
        if (!collabErr && collaboratorsData) {
          const collabMap = {};
          collaboratorsData.forEach((u) => { collabMap[u.emp_id] = u; });
          tasksData.forEach((task) => {
            if (Array.isArray(task.collaborators) && task.collaborators.length > 0) {
              task.assignees = task.collaborators.map((id) => collabMap[id]).filter(Boolean);
            } else {
              task.assignees = [];
            }
          });
        }
      } else {
        tasksData.forEach((task) => { task.assignees = []; });
      }
    }

    res.json({ tasks: tasksData || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manager: Update any task (e.g., collaborators, status) regardless of owner
router.put("/manager/:id", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    // Verify manager role
    const { data: requester, error: reqErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .single();
    if (reqErr) return res.status(400).json({ error: reqErr.message });
    const userRole = (requester?.role || "").toLowerCase();
    if (userRole !== "manager" && userRole !== "director") {
      return res.status(403).json({ error: "Forbidden: managers and directors only" });
    }

    const { id } = req.params;
    const updates = req.body || {};
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...updates })
      .eq("id", Number(id))
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    // Find editor emp_id
    let editorEmpId = null;
    try {
      editorEmpId = await getEmpIdForUserId(user.id);
    } catch {}

    // Record history (manager/director update)
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: data.id,
          editor_emp_id: editorEmpId,
          editor_user_id: user.id,
          action: 'update',
          details: { updates }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (manager update):', hErr);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manager: Get staff members list
router.get("/manager/staff-members", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    // Verify manager role
    const { data: requester, error: reqErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .single();
    if (reqErr) return res.status(400).json({ error: reqErr.message });
    const userRole = (requester?.role || "").toLowerCase();
    if (userRole !== "manager" && userRole !== "director") {
      return res.status(403).json({ error: "Forbidden: managers and directors only" });
    } 

    const { data, error } = await supabase
      .from("users")
      .select("emp_id, name, role, department")
      .eq("role", "staff")
      .order("name");
    if (error) return res.status(400).json({ error: error.message });
    res.json({ staffMembers: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Replace the PUT route (lines 265-420) with this fixed version:
router.put("/:id", upload.single("file"), async (req, res) => {
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
    const { remove_file, ...updates } = req.body || {};

    // Clean and validate updates object
    const cleanUpdates = {};
    if (updates.title && updates.title.trim()) {
      cleanUpdates.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      cleanUpdates.description = updates.description || null;
    }
    if (
      updates.priority &&
      ["low", "medium", "high"].includes(updates.priority)
    ) {
      cleanUpdates.priority = updates.priority;
    }
    if (updates.status) {
      const normalizedUpdateStatus = String(updates.status)
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const allowedStatuses = ["unassigned", "ongoing", "under review", "completed"];
      if (allowedStatuses.includes(normalizedUpdateStatus)) {
        cleanUpdates.status = normalizedUpdateStatus;
      }
    }
    if (updates.due_date) {
      cleanUpdates.due_date = updates.due_date;
    }

    // Get current task to check existing file and ownership
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("file, owner_id")
      .eq("id", Number(id))
      .single();

    if (fetchError || !currentTask) {
      console.error("Fetch error:", fetchError);
      return res.status(404).json({ error: "Task not found" });
    }

    // NOW we can use currentTask for logging
    // Check if user owns the task (use loose comparison for string/number)
    if (currentTask.owner_id != empId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own tasks" });
    }

    // Handle file operations
    let newFileUrl = currentTask.file;

    // Remove existing file if requested
    if (remove_file === "true" && currentTask.file) {
      try {
        const fileName = currentTask.file.split("/").pop();
        await supabase.storage.from("task-attachment").remove([fileName]); // Changed from "task-files"
        newFileUrl = null;
      } catch (error) {
        console.error("Error removing old file:", error);
      }
    }

    // Upload new file if provided
    if (req.file) {
      // Remove old file if exists (when new file is being uploaded)
      if (currentTask.file && remove_file !== "true") {
        try {
          const fileName = currentTask.file.split("/").pop();
          await supabase.storage.from("task-attachment").remove([fileName]); // Changed from "task-files"
        } catch (error) {
          console.error("Error removing old file:", error);
        }
      }

      // Upload new file - use same structure as POST route
      const fileExt = req.file.originalname.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `task-attachment/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("task-attachment") // Changed from "task-files"
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({ error: "File upload failed" });
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("task-attachment") // Changed from "task-files"
        .getPublicUrl(filePath);

      newFileUrl = publicUrlData.publicUrl;
    }

    cleanUpdates.file = newFileUrl;

    // Update the task
    const { data, error } = await supabase
      .from("tasks")
      .update(cleanUpdates)
      .eq("id", Number(id))
      .eq("owner_id", empId)
      .select();

    if (error) {
      console.error("Update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: "Task not found or you don't have permission to edit it",
      });
    }

    // Record history (owner updates)
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: data[0].id,
          editor_emp_id: empId,
          editor_user_id: user.id,
          action: 'update',
          details: { updates: cleanUpdates }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (update):', hErr);
    }

    res.json(data[0]);
  } catch (e) {
    console.error("Unexpected error:", e);
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
      .select(
        "id, title, status, project_id, description, due_date, priority, owner_id, created_at, file, collaborators"
      )
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
      .select(
        "id, title, status, project_id, description, due_date, priority, owner_id, created_at, file"
      )
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

// Get edit history for a task
router.get("/:id/history", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const { id } = req.params;
    const { data, error } = await supabase
      .from('task_edit_history')
      .select('id, task_id, editor_emp_id, editor_user_id, action, details, created_at')
      .eq('task_id', Number(id))
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ history: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
