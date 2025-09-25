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
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Create task
router.post("/", upload.single('file'), async (req, res) => {
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
      status: req.body.status || "pending",
      due_date: req.body.due_date || null,
      project_id: req.body.project_id ? parseInt(req.body.project_id) : null,
      collaborators,
    };

    // Handle file upload to Supabase Storage
    let attachmentUrl = null;
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `task-attachment/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachment')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get the public URL of the uploaded file
      const { data: urlData } = supabase.storage
        .from('task-attachment')
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
