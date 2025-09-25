"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import Link from "next/link";

// import ManagerDashboard from "./ManagerDashboard";
// import HrDashboard from "./HrDashboard";

// ---- move these OUTSIDE the page component
const statusOrder = ["unassigned", "todo", "in_progress", "done"];
const statusLabels = {
    unassigned: "Unassigned",
    todo: "To-do",
    in_progress: "In Progress",
    done: "Done",
};
const statusColors = {
    unassigned: "bg-gray-50",
    todo: "bg-yellow-50",
    in_progress: "bg-blue-50",
    done: "bg-green-50",
};

// ✅ Named (not default) Staff dashboard component
function StaffDashboard({
    tasks = [],
    onLogout,
}) {
    const grouped = statusOrder.reduce((acc, status) => {
        acc[status] = tasks.filter((t) => t.status === status);
        return acc;
    }, {});

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold">My Tasks</h1>
                <button
                    onClick={onLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            </div>

            <div className="flex gap-6">
                {statusOrder.map((status) => (
                    <div
                        key={status}
                        className={`flex-1 rounded-lg shadow p-4 ${statusColors[status]}`}
                    >
                        <div className="flex items-center mb-2">
                            <span
                                className={`w-3 h-3 rounded-full mr-2 ${status === "todo"
                                    ? "bg-yellow-400"
                                    : status === "in_progress"
                                        ? "bg-blue-400"
                                        : status === "done"
                                            ? "bg-green-400"
                                            : "bg-gray-400"
                                    }`}
                            />
                            <span className="font-semibold">
                                {statusLabels[status]}{" "}
                                <span className="bg-white rounded-full px-2 py-0.5 text-xs ml-1 border">
                                    {grouped[status]?.length || 0}
                                </span>
                            </span>
                        </div>

                        <div className="space-y-3">
                            {grouped[status]?.map((task) => (
                                <div key={task.id} className="bg-white border rounded-lg p-3 shadow-sm">
                                    <div className="font-medium">{task.title}</div>
                                    <div className="text-sm text-gray-500">{task.description}</div>
                                    {task.due_date && (
                                        <div className="text-xs text-gray-400">
                                            Due: {new Date(task.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                    {task.priority && (
                                        <span
                                            className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${task.priority === "High"
                                                ? "bg-red-100 text-red-800"
                                                : task.priority === "Medium"
                                                    ? "bg-orange-100 text-orange-800"
                                                    : "bg-blue-100 text-blue-800"
                                                }`}
                                        >
                                            {task.priority}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ✅ Single default export (the page)
export default function DashboardPage() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading, isManager, isStaff, isHR, signOut } = useAuth();
    const { activeTasks = [], overdueTasks = [] } = useTasks(); // adapt to your hook
    const { projects } = useProjects(); // keep if you actually use it

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    if (!user) return null;

    if (isManager) {
        return <ManagerDashboard user={user} userProfile={userProfile} onLogout={handleLogout} />;
    }

    if (isHR) {
        return <HrDashboard user={user} userProfile={userProfile} onLogout={handleLogout} />;
    }

    if (isStaff) {
        // combine whatever lists your hook gives you
        const allTasks = [...activeTasks, ...overdueTasks];
        return <StaffDashboard tasks={allTasks} onLogout={handleLogout} />;
    }

    // Fallback for unknown role
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600 mb-4">Your role is not recognized.</p>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
