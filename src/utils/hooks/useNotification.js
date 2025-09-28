// utils/hooks/useNotification.js
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DebugToken() {
    const supabase = createClient();

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            console.log("JWT:", session?.access_token);   // <- copy this from DevTools console
        })();
    }, [supabase]);

    return <div>Open the console. Log in first if needed.</div>;
}

export const useNotification = async () => {
    const [notification, setNotification] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    console.log("ACCESS TOKEN:", session?.access_token);

    // Fetch all notifications via Express API
    const fetchNotification = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data: { session }, error: sessErr } = await supabase.auth.getSession();
            if (sessErr) throw sessErr;
            if (!session?.access_token) throw new Error("Not authenticated");

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
            const res = await fetch(`${apiUrl}/notification`, {
                headers: {
                    Authorization: `Bearer ${session?.access_token || ""}`,
                    Accept: "application/json",
                },
            });

            const text = await res.text();
            const body = text ? JSON.parse(text) : []; // your API returns an array
            if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);

            setNotification(Array.isArray(body) ? body : []); // <-- expect array
        } catch (err) {
            console.error("Error in fetchNotification:", err);
            setError(err.message || String(err));
            setNotification([]);
        } finally {
            setLoading(false);
        }
    }, [supabase]);


    useEffect(() => {
        fetchNotification();
    }, [fetchNotification]);

    return {
        notification,
        loading,
        error,
        refresh: fetchNotification,
        // activeTasks: getActiveTasks(),
        // completedTasks: getCompletedTasks(),
        // overdueTasks: getOverdueTasks(),
        // fetchTasks,
        // createTask,
        // updateTask,
        // deleteTask,
        // toggleTaskComplete,
        // getTasksByPriority,
    };
};