import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();
const DEBUG_ACCESS = process.env.SUBTASKS_DEBUG === 'true';
const debugAccess = (...args) => {
  if (DEBUG_ACCESS) console.log('[subtasks-access]', ...args);
};

// GET /subtasks/task/:taskId - fetch subtasks for a task if user has access to the parent task
router.get("/task/:taskId", async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: "emp_id not found" });

    const taskId = Number(req.params.taskId);
    if (!Number.isFinite(taskId)) {
      return res.status(400).json({ error: "Invalid task id" });
    }
    debugAccess('request', { userId: user.id, empId, taskId });

    // Load the parent task and validate access in Node to avoid complex PostgREST filters
    const { data: parentTask, error: parentErr } = await supabase
      .from("tasks")
      .select("id, owner_id, collaborators")
      .eq("id", taskId)
      .single();

    if (parentErr) return res.status(400).json({ error: parentErr.message });
    if (!parentTask) return res.status(404).json({ error: "Parent task not found" });
    debugAccess('parentTask', { owner_id: parentTask.owner_id, collaboratorsLen: Array.isArray(parentTask.collaborators) ? parentTask.collaborators.length : 0 });

    const isOwner = String(parentTask.owner_id) === String(empId);
    const collaboratorsArray = Array.isArray(parentTask.collaborators) ? parentTask.collaborators : [];
    const isCollaboratorByEmpId = collaboratorsArray.map(String).includes(String(empId));
    const isCollaboratorByUserId = collaboratorsArray.map(String).includes(String(user.id));

    // Manager/Director role can view subtasks for any task
    let isManagerOrDirector = false;
    let requesterDept = null;
    try {
      let requester = null;
      let reqErr = null;
      const byId = await supabase
        .from("users")
        .select("role, department, emp_id")
        .eq("id", user.id)
        .single();
      requester = byId.data; reqErr = byId.error;

      if (reqErr || !requester) {
        // Fallback: try lookup by emp_id mapping
        const byEmp = await supabase
          .from("users")
          .select("role, department, emp_id")
          .eq("emp_id", empId)
          .single();
        requester = byEmp.data; reqErr = byEmp.error;
      }

    if (requester && !reqErr) {
      const role = (requester.role || "").toLowerCase();
      requesterDept = requester.department || null;
      isManagerOrDirector = role === "manager" || role === "director";
      debugAccess('requester', { role, department: requesterDept });
    }
    } catch {}

    // If requester is manager, restrict to same-department owners; directors can see all
    debugAccess('basicAccessChecks', { isOwner, isCollaboratorByEmpId, isCollaboratorByUserId, isManagerOrDirector });
    if (!isOwner && !isCollaboratorByEmpId && !isCollaboratorByUserId) {
      if (isManagerOrDirector) {
        // If director, allow; if manager, allow only for same-department owner
        let allow = false;
        try {
          const { data: ownerUser, error: ownerErr } = await supabase
            .from("users")
            .select("emp_id, department")
            .eq("emp_id", parentTask.owner_id)
            .single();
          if (!ownerErr && ownerUser) {
            // Directors: allowed for any
            // Managers: only if same department
            // Note: if requesterDept missing, default deny for managers
            const role = (await (async () => {
              try {
                const { data } = await supabase
                  .from("users")
                  .select("role")
                  .eq("emp_id", empId)
                  .single();
                return (data?.role || "").toLowerCase();
              } catch { return ""; }
            })());
            if (role === "director") {
              allow = true;
            } else if (role === "manager" && requesterDept && ownerUser?.department) {
              allow = String(requesterDept).toLowerCase() === String(ownerUser.department).toLowerCase();
            }
            debugAccess('managerOrDirectorDecision', { requesterRole: role, requesterDept, ownerDept: ownerUser?.department, allow });
          }
        } catch {}
        if (!allow) {
          debugAccess('deny', { reason: 'manager/director rule not satisfied' });
          return res.status(403).json({ error: "Forbidden: no access to this task" });
        }
      } else {
        debugAccess('deny', { reason: 'not owner/collaborator and not manager/director' });
        return res.status(403).json({ error: "Forbidden: no access to this task" });
      }
    }

    // Fetch subtasks
    const { data: subtasks, error: subErr } = await supabase
      .from("sub_task")
      .select("id, parent_task_id, title, description, priority, status, due_date, collaborators, owner_id")
      .eq("parent_task_id", taskId)
      .order("priority", { ascending: false });

    if (subErr) return res.status(400).json({ error: subErr.message });
    return res.json({ subtasks: subtasks || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /subtasks - create a new subtask under a task (only if requester owns the parent task)
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

    const {
      parent_task_id,
      title,
      description = null,
      priority = null,
      status = "ongoing",
      due_date = null,
      collaborators = [],
    } = req.body || {};

    if (!parent_task_id || !title || !String(title).trim()) {
      return res.status(400).json({ error: "parent_task_id and title are required" });
    }

    // Verify requester owns the parent task
    const { data: parent, error: parentErr } = await supabase
      .from("tasks")
      .select("id, owner_id")
      .eq("id", Number(parent_task_id))
      .single();
    if (parentErr || !parent) return res.status(404).json({ error: "Parent task not found" });
    if (String(parent.owner_id) !== String(empId)) {
      return res.status(403).json({ error: "Only the task owner can add subtasks" });
    }

    // Normalize priority if valid 1-10
    let normalizedPriority = null;
    if (priority !== null && priority !== undefined && priority !== "") {
      const p = parseInt(priority, 10);
      if (!isNaN(p) && p >= 1 && p <= 10) normalizedPriority = p;
    }

    const { data, error } = await supabase
      .from("sub_task")
      .insert({
        parent_task_id: Number(parent_task_id),
        title: String(title).trim(),
        description: description || null,
        priority: normalizedPriority,
        status: status || "ongoing",
        due_date: due_date || null,
        collaborators: Array.isArray(collaborators) ? collaborators : [],
        owner_id: parent.owner_id,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    // Write task history for subtask creation
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: Number(parent_task_id),
          editor_emp_id: empId,
          editor_user_id: user.id,
          action: 'subtask_create',
          details: { subtask_id: data.id, title: data.title, priority: data.priority, status: data.status, due_date: data.due_date }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (subtask create):', hErr);
    }
    return res.status(201).json({ subtask: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// PUT /subtasks/:id - update a subtask (only if requester owns the parent task)
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

    const subtaskId = Number(req.params.id);
    if (!Number.isFinite(subtaskId)) return res.status(400).json({ error: "Invalid id" });

    // Load subtask with parent info
    const { data: subtask, error: stErr } = await supabase
      .from("sub_task")
      .select("id, parent_task_id")
      .eq("id", subtaskId)
      .single();
    if (stErr || !subtask) return res.status(404).json({ error: "Subtask not found" });

    // Verify requester owns the parent task
    const { data: parent, error: parentErr } = await supabase
      .from("tasks")
      .select("id, owner_id")
      .eq("id", subtask.parent_task_id)
      .single();
    if (parentErr || !parent) return res.status(404).json({ error: "Parent task not found" });
    if (String(parent.owner_id) !== String(empId)) {
      return res.status(403).json({ error: "Only the task owner can edit subtasks" });
    }

    const updates = { ...req.body };
    // Normalize priority
    if (updates.priority !== undefined) {
      const p = parseInt(updates.priority, 10);
      if (!isNaN(p) && p >= 1 && p <= 10) updates.priority = p; else delete updates.priority;
    }
    // Normalize title/description
    if (updates.title !== undefined) updates.title = String(updates.title || "").trim();
    if (updates.title === "") delete updates.title;
    if (updates.description === "") updates.description = null;

    const { data, error } = await supabase
      .from("sub_task")
      .update(updates)
      .eq("id", subtaskId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    // Write task history for subtask update
    try {
      await supabase
        .from('task_edit_history')
        .insert([{
          task_id: subtask.parent_task_id,
          editor_emp_id: empId,
          editor_user_id: user.id,
          action: 'subtask_update',
          details: { subtask_id: subtaskId, updates }
        }]);
    } catch (hErr) {
      console.error('Failed to write task history (subtask update):', hErr);
    }
    return res.json({ subtask: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /subtasks/:id - delete a subtask (only if requester owns the parent task)
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

    const subtaskId = Number(req.params.id);
    if (!Number.isFinite(subtaskId)) return res.status(400).json({ error: "Invalid id" });

    // Load subtask and verify ownership via parent task
    const { data: subtask, error: stErr } = await supabase
      .from("sub_task")
      .select("id, parent_task_id")
      .eq("id", subtaskId)
      .single();
    if (stErr || !subtask) return res.status(404).json({ error: "Subtask not found" });

    const { data: parent, error: parentErr } = await supabase
      .from("tasks")
      .select("id, owner_id")
      .eq("id", subtask.parent_task_id)
      .single();
    if (parentErr || !parent) return res.status(404).json({ error: "Parent task not found" });
    if (String(parent.owner_id) !== String(empId)) {
      return res.status(403).json({ error: "Only the task owner can delete subtasks" });
    }

    const { error } = await supabase
      .from("sub_task")
      .delete()
      .eq("id", subtaskId);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;


