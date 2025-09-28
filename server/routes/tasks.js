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

    // Parse collaborators if it exists
    const collaborators = req.body.collaborators
      ? JSON.parse(req.body.collaborators)
      : null;

    // Prepare task data
    const taskData = {
      title: req.body.title,
      description: req.body.description || null,
      priority: req.body.priority || "medium",
      status: req.body.status || "unassigned",
      due_date: req.body.due_date || null,
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
      const { data: uploadData, error: uploadError } = await supabase.storage
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

      console.log("📎 Public URL:", attachmentUrl);
    }

    // Validate the task data
    const validatedData = TaskSchema.parse(taskData);

    // Insert task into database
    const { data: newTask, error: dbError } = await supabase
      .from("tasks")
      .insert({
        ...validatedData,
        owner_id: empId,
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
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
    if ((requester?.role || "").toLowerCase() !== "manager") {
      return res.status(403).json({ error: "Forbidden: managers only" });
    }

    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (tasksError) return res.status(400).json({ error: tasksError.message });

    if (tasksData && tasksData.length > 0) {
      const ownerIds = [
        ...new Set(tasksData.map((t) => t.owner_id).filter(Boolean)),
      ];
      if (ownerIds.length > 0) {
        const { data: owners, error: ownersErr } = await supabase
          .from("users")
          .select("emp_id, name, role")
          .in("emp_id", ownerIds);
        if (!ownersErr && owners) {
          const ownersMap = {};
          owners.forEach((o) => {
            ownersMap[o.emp_id] = o;
          });
          tasksData.forEach((task) => {
            if (task.owner_id && ownersMap[task.owner_id]) {
              task.task_owner = ownersMap[task.owner_id];
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
    if ((requester?.role || "").toLowerCase() !== "manager") {
      return res.status(403).json({ error: "Forbidden: managers only" });
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
    if ((requester?.role || "").toLowerCase() !== "manager") {
      return res.status(403).json({ error: "Forbidden: managers only" });
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
  console.log("🚀 PUT ROUTE HIT! ID:", req.params.id);
  console.log("🚀 REQUEST BODY:", req.body);
  console.log("🚀 HAS FILE:", !!req.file);
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    console.log("User authentication:", {
      userId: user.id,
      empId: empId,
      empIdType: typeof empId,
    });

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
    if (
      updates.status &&
      ["unassigned", "ongoing", "under_review", "completed"].includes(
        updates.status
      )
    ) {
      cleanUpdates.status = updates.status;
    }
    if (updates.due_date) {
      cleanUpdates.due_date = updates.due_date;
    }

    console.log("Task update request:", {
      id,
      empId,
      originalUpdates: updates,
      cleanUpdates,
      remove_file,
      hasFile: !!req.file,
    });

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
    console.log("Current task ownership:", {
      taskId: id,
      currentTaskOwnerId: currentTask.owner_id,
      currentUserEmpId: empId,
      ownershipMatch: currentTask.owner_id == empId, // loose comparison
      strictMatch: currentTask.owner_id === empId,
      ownerIdType: typeof currentTask.owner_id,
      empIdType: typeof empId,
    });

    // Check if user owns the task (use loose comparison for string/number)
    if (currentTask.owner_id != empId) {
      console.log("Ownership check failed:", {
        taskOwnerId: currentTask.owner_id,
        userEmpId: empId,
        taskOwnerType: typeof currentTask.owner_id,
        userEmpType: typeof empId,
      });
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

      const { data: uploadData, error: uploadError } = await supabase.storage
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

    console.log("Final updates:", cleanUpdates);

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

    console.log("Task updated successfully:", data[0]);
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
        "id, title, status, project_id, description, due_date, priority, owner_id, created_at, file"
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

export default router;
