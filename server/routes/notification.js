import { Router } from "express";
import {
    getServiceClient,
    getUserFromToken,
    getEmpIdForUserId,
} from "../lib/supabase.js";

const router = Router();


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

        const { title, description, type, emp_id, created_at } = req.body;

        if (!title || !description || !type || !emp_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data, error } = await supabase
            .from("notifications")
            .insert([{ title, description, type, emp_id, created_at }])
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        res.type("application/json");
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
            return res.status(401).json({ error: "Employee ID not found for user" })
        };

        const { data, error } = await supabase
            .from("notifications")
            .select("id, type, title, description, created_at")
            .eq("emp_id", empId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Supabase error:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data || []);
    } catch (e) {
        console.error("Error fetching notifications:", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;