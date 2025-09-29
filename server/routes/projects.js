import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();

// Get projects where user is a member
router.get("/", async (req, res) => {
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

    // Get projects where user is owner or member
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .or(`owner_id.eq.${empId},members.cs.{${empId}}`);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Return projects directly (not wrapped in { projects: data })
    res.json(data || []);
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get project names (id and title mapping) - optimized for dropdown/references
router.get("/names", async (req, res) => {
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

    // Get only id and title for projects where user is owner or member
    const { data, error } = await supabase
      .from("projects")
      .select("id, title")
      .or(`owner_id.eq.${empId},members.cs.{${empId}}`);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Convert to object mapping: { 1: "Project Name", 2: "Another Project" }
    const projectNamesMap = {};
    (data || []).forEach((project) => {
      projectNamesMap[project.id] = project.title;
    });

    res.json(projectNamesMap);
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Create a new project
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

// Update a project
router.put("/:id", async (req, res) => {
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

    const projectId = req.params.id;
    const updates = req.body;

    // Add updated timestamp
    const projectUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Check if user owns the project before updating
    const { data: existingProject, error: checkError } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (checkError) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (existingProject.owner_id !== empId) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this project" });
    }

    const { data, error } = await supabase
      .from("projects")
      .update(projectUpdates)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      console.error("Update project error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a project
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

    const projectId = req.params.id;

    // Check if user owns the project before deleting
    const { data: existingProject, error: checkError } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (checkError) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (existingProject.owner_id !== empId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this project" });
    }

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

// Get project members by project ID (existing endpoint)
router.get("/:id/members", async (req, res) => {
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

    const projectId = req.params.id;

    // get current users emp_id
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(404).json({ error: "Employee ID not found" });
    }

    // Get project with members
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("members, owner_id, title")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.error("Project error:", projectError);
      return res.status(404).json({ error: "Project not found" });
    }

    // Get all member IDs including owner, but exclude current user
    const allMemberIds = [...(project.members || [])];
    if (project.owner_id && !allMemberIds.includes(project.owner_id)) {
      allMemberIds.push(project.owner_id);
    }

    // Remove current user from the list
    const collaboratorIds = allMemberIds.filter((id) => id !== empId);

    if (collaboratorIds.length === 0) {
      return res.json({ members: [] });
    }

    // Get user details for all members
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("emp_id, name, email")
      .in("emp_id", collaboratorIds);

    if (usersError) {
      console.error("Users error:", usersError);
      return res.status(500).json({ error: usersError.message });
    }

    res.json({ members: users || [] });
  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
