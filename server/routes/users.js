import { Router } from "express";
import { getServiceClient, getUserFromToken } from "../lib/supabase.js";

const router = Router();

// Search users by name
router.get("/search", async (req, res) => {
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

    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("users")
      .select("emp_id, name, email")
      .ilike("name", `%${q.trim()}%`)
      .limit(10);

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

// Get multiple users by emp_ids
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

    const { emp_ids } = req.body;
    if (!emp_ids || !Array.isArray(emp_ids)) {
      return res.status(400).json({ error: "emp_ids array is required" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("emp_id, name, email")
      .in("emp_id", emp_ids);

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

router.get("/profile/:empId", async (req, res) => {
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

    const { empId } = req.params;

    const { data, error } = await supabase
      .from("users")
      .select("emp_id, name, email")
      .eq("emp_id", empId)
      .single();

    if (error) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: error.message });
  }
});
export default router;
