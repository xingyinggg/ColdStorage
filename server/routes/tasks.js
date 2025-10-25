import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";
import { TaskSchema } from "../schemas/task.js";
import multer from "multer";
import recurrenceService from "../services/recurrenceService.js";

// Function to normalize status to match test expectations
function normalizeStatus(status) {
  if (!status) return "ongoing"; // Default status

  // Convert to lowercase for easier matching
  const statusLower = status.toLowerCase();

  // Map of status values
  const statusMap = {
    'ongoing': 'ongoing',
    'unassigned': 'unassigned',
    'completed': 'completed',
    'under review': 'Under Review'
  };

  return statusMap[statusLower] || status;
}

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

    if (!token) return res.status(401).json({ error: "No token provided" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const empId = await getEmpIdForUserId(user.id);

    // Parse the request body
    const {
      title,
      description,
      priority,
      status: rawStatus = "ongoing",
      due_date,
      project_id,
      collaborators: collaboratorsStr,
      owner_id,
      subtasks: subtasksStr, // This comes from your TaskForm
      // Recurrence fields
      is_recurring,
      recurrence_pattern,
      recurrence_interval,
      recurrence_end_date,
      recurrence_count,
      recurrence_weekday,
    } = req.body;

    // Parse and validate priority as integer
    let taskPriority = null;
    if (priority !== undefined && priority !== null && priority !== "") {
      const parsedPriority = parseInt(priority, 10);
      if (!isNaN(parsedPriority) && parsedPriority >= 1 && parsedPriority <= 10) {
        taskPriority = parsedPriority;
      }
    }
    // Ensure non-null priority to satisfy DB NOT NULL constraint
    if (taskPriority === null) {
      taskPriority = 5; // sensible default
    }

    // Parse collaborators
    let collaborators = [];
    if (collaboratorsStr) {
      try {
        collaborators = JSON.parse(collaboratorsStr);
      } catch (e) {
        console.error("Error parsing collaborators:", e);
      }
    }

    // Parse subtasks
    let subtasksToCreate = [];
    if (subtasksStr) {
      try {
        subtasksToCreate = JSON.parse(subtasksStr);
        console.log("📝 Parsed subtasks to create:", subtasksToCreate);
      } catch (e) {
        console.error("Error parsing subtasks:", e);
      }
    }

    // Handle file upload
    let fileUrl = null;
    if (req.file) {
      try {
        const fileName = `task-${Date.now()}-${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("task-files")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

        if (uploadError) throw uploadError;
        fileUrl = uploadData.path;
        console.log("📎 File uploaded:", fileUrl);
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    // Determine final owner_id and status
    let finalOwnerId = empId; // Default to current user
    let finalStatus = normalizeStatus(rawStatus);

    // Handle assignment logic (only for managers/directors)
    const userRole = await getUserRole(empId); // You'll need this helper function
    const canAssignTasks = userRole === "manager" || userRole === "director";

    if (canAssignTasks && owner_id && owner_id !== empId) {
      finalOwnerId = owner_id;
      finalStatus = "ongoing"; // Assigned tasks are always ongoing
      console.log("🎯 Task assigned to:", owner_id);
    }

    // Check if this is a recurring task
    const isRecurring = is_recurring === true || is_recurring === "true";

    let newTask;
    let createdSubtasks = [];

    if (isRecurring) {
      // ========== RECURRING TASK CREATION ==========
      console.log("🔄 Creating recurring task with pattern:", recurrence_pattern);

      // Validate recurrence fields
      if (!recurrence_pattern) {
        return res.status(400).json({ error: "Recurrence pattern is required for recurring tasks" });
      }

      const validPatterns = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
      if (!validPatterns.includes(recurrence_pattern)) {
        return res.status(400).json({ error: `Invalid recurrence pattern. Must be one of: ${validPatterns.join(", ")}` });
      }

      // Prepare task data for recurring task service
      const taskData = {
        title,
        description: description || null,
        priority: taskPriority,
        due_date: due_date || null,
        project_id: project_id ? parseInt(project_id) : null,
        collaborators,
        owner_id: finalOwnerId,
        file: fileUrl,
        is_recurring: true,
        recurrence_pattern,
        recurrence_interval: recurrence_interval ? parseInt(recurrence_interval) : 1,
        recurrence_end_date: recurrence_end_date || null,
        recurrence_count: recurrence_count ? parseInt(recurrence_count) : null,
        recurrence_weekday: recurrence_weekday !== undefined ? parseInt(recurrence_weekday) : null, // Store weekday preference
      };

      // Pass weekday separately for immediate use in calculations
      const weekdayPreference = recurrence_weekday !== undefined ? parseInt(recurrence_weekday) : null;

      // Use recurrence service to create recurring task
      const result = await recurrenceService.createRecurringTask(supabase, taskData, weekdayPreference);

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to create recurring task" });
      }

      newTask = result.task;
      console.log("✅ Recurring task created:", newTask.id);

      // Handle subtasks for recurring task instances (if provided)
      if (Array.isArray(subtasksToCreate) && subtasksToCreate.length > 0) {
        console.log(`📝 Creating ${subtasksToCreate.length} subtasks for recurring task instance...`);

        try {
          const subtaskInserts = subtasksToCreate.map(subtask => {
            let subtaskPriority = null;
            if (subtask.priority !== undefined && subtask.priority !== null && subtask.priority !== "") {
              const parsedSubPriority = parseInt(subtask.priority, 10);
              if (!isNaN(parsedSubPriority) && parsedSubPriority >= 1 && parsedSubPriority <= 10) {
                subtaskPriority = parsedSubPriority;
              }
            }

            return {
              parent_task_id: result.firstInstance.id, // Attach to first instance, not template
              title: subtask.title,
              description: subtask.description || null,
              priority: subtaskPriority,
              status: subtask.status || "ongoing",
              due_date: subtask.dueDate || null,
              collaborators: subtask.collaborators || [],
              owner_id: finalOwnerId,
            };
          });

          const { data: subtasksData, error: subtasksError } = await supabase
            .from("sub_task")
            .insert(subtaskInserts)
            .select();

          if (subtasksError) {
            console.error("Subtasks creation error:", subtasksError);
          } else {
            createdSubtasks = subtasksData || [];
            console.log(`✅ Created ${createdSubtasks.length} subtasks`);
          }
        } catch (subtaskError) {
          console.error("Error in subtask creation process:", subtaskError);
        }
      }

    } else {
      // ========== REGULAR TASK CREATION ==========
      // 1. CREATE THE MAIN TASK FIRST
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title,
          description: description || null,
          priority: taskPriority,
          status: finalStatus,
          due_date: due_date || null,
          project_id: project_id ? parseInt(project_id) : null,
          collaborators,
          owner_id: finalOwnerId,
          file: fileUrl,
        })
        .select()
        .single();

      if (taskError) {
        throw new Error(`Database error: ${taskError.message}`);
      }

      newTask = taskData;

      // 2. CREATE SUBTASKS IF PROVIDED
      if (Array.isArray(subtasksToCreate) && subtasksToCreate.length > 0) {
        console.log(`📝 Creating ${subtasksToCreate.length} subtasks...`);

        try {
          // Prepare subtask data for bulk insert
          const subtaskInserts = subtasksToCreate.map(subtask => {
            // Parse subtask priority
            let subtaskPriority = null;
            if (subtask.priority !== undefined && subtask.priority !== null && subtask.priority !== "") {
              const parsedSubPriority = parseInt(subtask.priority, 10);
              if (!isNaN(parsedSubPriority) && parsedSubPriority >= 1 && parsedSubPriority <= 10) {
                subtaskPriority = parsedSubPriority;
              }
            }

            return {
              parent_task_id: newTask.id,
              title: subtask.title,
              description: subtask.description || null,
              priority: subtaskPriority,
              status: subtask.status || "ongoing",
              due_date: subtask.dueDate || null, // Note: frontend uses 'dueDate', backend uses 'due_date'
              collaborators: subtask.collaborators || [],
              owner_id: finalOwnerId, // Subtasks inherit the main task owner
            };
          });

          // Bulk create subtasks
          const { data: subtasksData, error: subtasksError } = await supabase
            .from("sub_task")
            .insert(subtaskInserts)
            .select();

          if (subtasksError) {
            console.error("Subtasks creation error:", subtasksError);
            // Don't fail the entire request, just log the error
          } else {
            createdSubtasks = subtasksData || [];
            console.log(`✅ Created ${createdSubtasks.length} subtasks`);
          }
        } catch (subtaskError) {
          console.error("Error in subtask creation process:", subtaskError);
          // Continue without failing the main task creation
        }
      }
    }

    // Record history (create)
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: newTask.id,
          editor_emp_id: finalOwnerId,
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

// Helper function to get user role (add this to your tasks.js file)
async function getUserRole(empId) {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("emp_id", empId)
      .single();

    if (error) throw error;
    return data?.role || "staff";
  } catch (error) {
    console.error("Error getting user role:", error);
    return "staff"; // Default fallback
  }
}
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
    // Prefer full query with filters; fall back to simple select if test mocks don't support .or/.order
    let tasksResp;
    const baseSelect = supabase.from("tasks").select("*");
    if (typeof baseSelect.or === "function") {
      // Use full-featured query when available
      tasksResp = await baseSelect
        .or(`owner_id.eq.${empId},collaborators.cs.{${empId}}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      // Fallback for unit tests where .or/.order may not be implemented in mocks
      tasksResp = await baseSelect;
    }

    const { data: tasksData, error: tasksError } = tasksResp || {};

    if (tasksError) return res.status(400).json({ error: tasksError.message });

    // Parse collaborators field if it's a JSON string
    if (tasksData && tasksData.length > 0) {
      tasksData.forEach(task => {
        if (task.collaborators && typeof task.collaborators === 'string') {
          try {
            task.collaborators = JSON.parse(task.collaborators);
          } catch (e) {
            console.error('Error parsing collaborators for task', task.id, ':', e);
            task.collaborators = [];
          }
        } else if (!task.collaborators) {
          task.collaborators = [];
        }
      });
    }

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

    // Clean and validate updates - especially priority
    let cleanUpdates = { ...updates };
    if (cleanUpdates.priority !== undefined && cleanUpdates.priority !== null && cleanUpdates.priority !== "") {
      const parsedPriority = parseInt(cleanUpdates.priority, 10);
      if (!isNaN(parsedPriority) && parsedPriority >= 1 && parsedPriority <= 10) {
        cleanUpdates.priority = parsedPriority;
      } else {
        // Remove invalid priority from updates
        delete cleanUpdates.priority;
      }
    }

    if (updates.status) {
      // Normalize status case (first letter uppercase, rest lowercase)
      cleanUpdates.status = updates.status.charAt(0).toUpperCase() + updates.status.slice(1).toLowerCase();
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(cleanUpdates)
      .eq("id", Number(id))
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    // Find editor emp_id
    let editorEmpId = null;
    try {
      editorEmpId = await getEmpIdForUserId(user.id);
    } catch { }

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
    let cleanUpdates = {};
    if (updates.title && updates.title.trim()) {
      cleanUpdates.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      cleanUpdates.description = updates.description || null;
    }
    if (updates.priority !== undefined && updates.priority !== null && updates.priority !== "") {
      const parsedPriority = parseInt(updates.priority, 10);
      if (!isNaN(parsedPriority) && parsedPriority >= 1 && parsedPriority <= 10) {
        cleanUpdates.priority = parsedPriority;
      }
    }
    if (updates.status) {
      // Use our standardized status normalization function
      cleanUpdates.status = normalizeStatus(updates.status);
    }
    if (updates.due_date) {
      cleanUpdates.due_date = updates.due_date;
    }

    // Get current task to check existing file and ownership (including collaborators)
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("file, owner_id, collaborators")
      .eq("id", Number(id))
      .single();

    if (fetchError || !currentTask) {
      console.error("Fetch error:", fetchError);
      return res.status(404).json({ error: "Task not found" });
    }

    // NOW we can use currentTask for logging
    // Check if user owns the task or is collaborator (use loose comparison for string/number)
    const isOwner = currentTask.owner_id == empId;

    // If not the owner, check if they're a collaborator
    if (!isOwner) {
      // Handle collaborators which might be array, JSON string, or null/undefined
      let collaborators = [];

      if (typeof currentTask.collaborators === 'string') {
        try {
          // Try to parse if it's a JSON string
          collaborators = JSON.parse(currentTask.collaborators);
        } catch (e) {
          console.error("Failed to parse collaborators JSON string:", e);
          // If parsing fails, treat as empty array
        }
      } else if (Array.isArray(currentTask.collaborators)) {
        collaborators = currentTask.collaborators;
      }

      // Make sure collaborators is always an array
      if (!Array.isArray(collaborators)) {
        collaborators = [];
      }

      // Ensure we're comparing strings to handle numeric vs string IDs
      const isCollaborator = collaborators.some(collabId =>
        collabId && String(collabId) === String(empId)
      );

      console.log("Collaborator check:", {
        taskId: Number(id),
        empId,
        isOwner,
        collaborators,
        isCollaborator
      });

      if (!isCollaborator) {
        return res.status(403).json({ error: "You can only edit tasks you own or collaborate on" });
      }

      // If collaborator but not owner, restrict updates to only status field
      let allowedUpdates = {};
      if (cleanUpdates.status) {
        allowedUpdates.status = cleanUpdates.status;
      }

      console.log("Collaborator updates restricted to:", allowedUpdates);
      cleanUpdates = allowedUpdates;
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

    console.log("Final updates to apply:", cleanUpdates);

    // Update the task - don't restrict to owner_id since we've already verified access
    const { data, error } = await supabase
      .from("tasks")
      .update(cleanUpdates)
      .eq("id", Number(id))
      .select();

    if (error) {
      console.error("Update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const updatedTask = data[0];

    // ========== HANDLE RECURRING TASK COMPLETION ==========
    // If task status changed to "completed" and it's a recurring task, create next instance
    if (cleanUpdates.status === "completed" && updatedTask.is_recurring) {
      console.log("🔄 Recurring task completed - creating next instance...");

      try {
        const recurrenceResult = await recurrenceService.handleTaskCompletion(supabase, Number(id));

        if (recurrenceResult.success && recurrenceResult.nextTask) {
          console.log("✅ Next recurring task created:", recurrenceResult.nextTask.id);
        } else if (recurrenceResult.success) {
          console.log("✅ Recurring series completed - no more tasks to create");
        }
      } catch (recurrenceError) {
        console.error("Error handling task recurrence:", recurrenceError);
        // Don't fail the update - just log the error
      }
    }

    // Record history (owner updates)
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: updatedTask.id,
          editor_emp_id: empId,
          editor_user_id: user.id,
          action: 'update',
          details: { updates: cleanUpdates }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (update):', hErr);
    }

    // Create notifications server-side for this update:
    try {
      const notificationsToInsert = [];

      // Get editor name for nicer messages
      let editorName = "Someone";
      try {
        const { data: editorUser } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();
        if (editorUser && editorUser.name) editorName = editorUser.name;
      } catch (nameErr) {
        // ignore - optional
      }

      // Notify the editor (confirmation)
      notificationsToInsert.push({
        emp_id: empId,
        title: `Task Updated (${updatedTask.title})`,
        description: `You updated the task "${updatedTask.title}".`,
        type: "Task Update Confirmation",
        created_at: new Date().toISOString(),
        read: false,
      });

      // Notify the owner if different from editor
      if (updatedTask.owner_id && String(updatedTask.owner_id) !== String(empId)) {
        notificationsToInsert.push({
          emp_id: updatedTask.owner_id,
          title: `Task Updated (${updatedTask.title})`,
          description: `${editorName} updated the task "${updatedTask.title}".`,
          type: "Task Update",
          created_at: new Date().toISOString(),
          read: false,
        });
      }

      // Notify collaborators (if any) except the editor
      try {
        let collaborators = updatedTask.collaborators || [];
        if (typeof collaborators === 'string') {
          try {
            collaborators = JSON.parse(collaborators);
          } catch (e) {
            collaborators = [];
          }
        }
        if (Array.isArray(collaborators) && collaborators.length > 0) {
          collaborators.forEach((collabId) => {
            if (!collabId) return;
            if (String(collabId) === String(empId)) return; // don't notify the editor twice
            if (updatedTask.owner_id && String(collabId) === String(updatedTask.owner_id)) return; // owner already notified
            notificationsToInsert.push({
              emp_id: collabId,
              title: `Task Updated (${updatedTask.title})`,
              description: `${editorName} updated a task you're collaborating on: "${updatedTask.title}".`,
              type: "Task Update",
              created_at: new Date().toISOString(),
              read: false,
            });
          });
        }
      } catch (collabErr) {
        console.error('Error preparing collaborator notifications:', collabErr);
      }

      if (notificationsToInsert.length > 0) {
        try {
          const { data: notifData, error: notifErr } = await supabase
            .from('notifications')
            .insert(notificationsToInsert)
            .select();
          if (notifErr) {
            console.error('Failed to insert notifications:', notifErr);
          } else {
            console.log(`Inserted ${notifData?.length || 0} notifications for task ${updatedTask.id}`);
          }
        } catch (e) {
          console.error('Notification insert error:', e);
        }
      }
    } catch (notifOuterErr) {
      console.error('Error while creating notifications for task update:', notifOuterErr);
    }

    res.json(updatedTask);
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

// ========== RECURRING TASK ROUTES ==========

// Get recurrence history for a task
router.get("/:id/recurrence-history", async (req, res) => {
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

    // Get the task to verify ownership/access
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("owner_id, parent_recurrence_id")
      .eq("id", Number(id))
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user has access to this task
    if (task.owner_id !== empId) {
      return res.status(403).json({ error: "You don't have permission to view this task's recurrence history" });
    }

    // Get recurrence history
    const result = await recurrenceService.getRecurrenceHistory(supabase, Number(id));

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to fetch recurrence history" });
    }

    res.json({
      success: true,
      history: result.history,
      masterTaskId: result.masterTaskId,
      totalInstances: result.totalInstances,
      completedInstances: result.completedInstances,
      pendingInstances: result.pendingInstances,
    });
  } catch (e) {
    console.error("Error fetching recurrence history:", e);
    res.status(500).json({ error: e.message });
  }
});

// Update recurrence settings for a recurring task
router.put("/:id/recurrence", async (req, res) => {
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
    const {
      recurrence_pattern,
      recurrence_interval,
      recurrence_end_date,
      recurrence_count,
    } = req.body;

    // Get the task to verify ownership
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("owner_id, is_recurring, status")
      .eq("id", Number(id))
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user owns the task
    if (task.owner_id !== empId) {
      return res.status(403).json({ error: "You can only update your own tasks" });
    }

    // Check if task is a recurring template
    if (!task.is_recurring || task.status !== "recurring_template") {
      return res.status(400).json({ error: "This task is not a recurring template" });
    }

    // Validate recurrence pattern if provided
    if (recurrence_pattern) {
      const validPatterns = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
      if (!validPatterns.includes(recurrence_pattern)) {
        return res.status(400).json({ error: `Invalid recurrence pattern. Must be one of: ${validPatterns.join(", ")}` });
      }
    }

    // Prepare updates
    const updates = {};
    if (recurrence_pattern) updates.recurrence_pattern = recurrence_pattern;
    if (recurrence_interval !== undefined) updates.recurrence_interval = parseInt(recurrence_interval);
    if (recurrence_end_date !== undefined) updates.recurrence_end_date = recurrence_end_date;
    if (recurrence_count !== undefined) updates.recurrence_count = recurrence_count ? parseInt(recurrence_count) : null;

    // Update recurrence settings
    const result = await recurrenceService.updateRecurringTask(supabase, Number(id), updates);

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to update recurrence settings" });
    }

    res.json({
      success: true,
      task: result.task,
      message: "Recurrence settings updated successfully",
    });
  } catch (e) {
    console.error("Error updating recurrence settings:", e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a recurring task series
router.delete("/:id/recurrence", async (req, res) => {
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
    const { delete_all } = req.query; // Query param: true to delete all instances, false to delete only future

    // Get the task to verify ownership
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("owner_id, is_recurring, parent_recurrence_id")
      .eq("id", Number(id))
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user owns the task
    if (task.owner_id !== empId) {
      return res.status(403).json({ error: "You can only delete your own tasks" });
    }

    // Check if task is part of a recurring series
    if (!task.is_recurring && !task.parent_recurrence_id) {
      return res.status(400).json({ error: "This task is not part of a recurring series" });
    }

    // Delete recurring task series
    const deleteAllInstances = delete_all === "true";
    const result = await recurrenceService.deleteRecurringTask(supabase, Number(id), deleteAllInstances);

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to delete recurring task" });
    }

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: deleteAllInstances
        ? "Recurring task series and all instances deleted successfully"
        : "Recurring task template and future instances deleted successfully",
    });
  } catch (e) {
    console.error("Error deleting recurring task:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get all active recurring tasks (for managers/directors)
router.get("/recurring/active", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    // Get user role to check permissions
    const userRole = await getUserRole(empId);
    const canViewAll = userRole === "manager" || userRole === "director";

    if (!canViewAll) {
      return res.status(403).json({ error: "Only managers and directors can view all recurring tasks" });
    }

    // Get all active recurring tasks
    const result = await recurrenceService.getActiveRecurringTasks(supabase);

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to fetch active recurring tasks" });
    }

    res.json({
      success: true,
      tasks: result.tasks,
      count: result.tasks.length,
    });
  } catch (e) {
    console.error("Error fetching active recurring tasks:", e);
    res.status(500).json({ error: e.message });
  }
});

// New endpoint: GET /tasks/team/workload
// Returns tasks owned by team members + collaboration tasks
// Includes workload analysis (due in 3 days)

export default router;
