"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import HrTasksView from "../components/HRTasksView";
import Toast from "@/components/ui/Toast";
import TaskCard from "@/components/tasks/TaskCard";

export default function HrTasksPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, isHR, signOut } = useAuth();

  const {
    tasks = [],
    loading: tasksLoading,
    error: tasksError,
    fetchTasks,
    toggleTaskComplete,
    updateTask,
  } = useTasks(user);

  const [hrTasks, setHrTasks] = useState([]);

  useEffect(() => {
    if (user && userProfile && isHR) fetchTasks();
  }, [user, userProfile, isHR, fetchTasks]);

  useEffect(() => {
    if (userProfile?.role === "hr") {
      if (Array.isArray(tasks)) {
        const valid = tasks.filter((t) => t && t.id);
        setHrTasks(valid);
      } else {
        setHrTasks([]);
      }
    } else setHrTasks([]);
  }, [tasks, userProfile]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    else if (!authLoading && user && !isHR) router.push("/dashboard");
  }, [user, authLoading, isHR, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (!user && authLoading) {
    return (
      <SidebarLayout>
        <HeaderBar
          title="My Tasks"
          user={user}
          userProfile={userProfile}
          roleLabel="HR"
          roleColor="purple"
          onLogout={handleLogout}
        />
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!user || !isHR) return null;

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar
          title={<span>My Tasks</span>}
          user={user}
          userProfile={userProfile}
          roleLabel="HR"
          roleColor="purple"
          onLogout={handleLogout}
        />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0 space-y-6">
            {/* 🔹 Create Task Button (Responsive) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                HR Task Overview
              </h2>
              <Link
                href="/dashboard/tasks/create"
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="whitespace-nowrap">Create Task</span>
              </Link>
            </div>

            {/* 🔹 Main Task Section */}
            {tasksError ? (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded">
                  <h3 className="font-semibold mb-2">Error loading tasks</h3>
                  <p className="mb-2">{tasksError}</p>
                  <button
                    onClick={() => fetchTasks()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Retry loading tasks
                  </button>
                </div>
                <HrTasksView tasks={[]} onLogout={handleLogout} />
              </div>
            ) : (
              <>
                <HrTasksView tasks={hrTasks} onLogout={handleLogout} />
                <AllTasksSection
                  tasks={hrTasks}
                  onMarkComplete={toggleTaskComplete}
                  currentUserEmpId={userProfile?.emp_id}
                  onEditTask={updateTask}
                  isHR={true}
                  userProfile={userProfile}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </SidebarLayout>
  );
}

/* ------------------ ALL TASKS SECTION (unchanged) ------------------ */
function AllTasksSection({
  tasks = [],
  onMarkComplete,
  currentUserEmpId,
  onEditTask,
  isHR = false,
  userProfile,
}) {
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [hrStaff, setHrStaff] = useState([]);

  useEffect(() => {
    if (isHR) {
      const fetchHrStaff = async () => {
        try {
          const res = await fetch("/api/hr/staff", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            setHrStaff(data.hrStaff || []);
          }
        } catch (err) {
          console.error("Error fetching HR staff:", err);
        }
      };
      fetchHrStaff();
    }
  }, [isHR]);

  useEffect(() => {
    if (!feedback.message) return;
    const id = setTimeout(() => setFeedback({ type: "", message: "" }), 2500);
    return () => clearTimeout(id);
  }, [feedback]);
}
