"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import SidebarLayout from "@/components/layout/SidebarLayout";
import HrTasksView from "../components/HrTasksView";

export default function HrTasksPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    loading: authLoading,
    isHR,
    signOut,
  } = useAuth();
  
  const {
    tasks = [],
    loading: tasksLoading,
    error: tasksError,
    toggleTaskComplete,
  } = useTasks();

  useEffect(() => {
    // Redirect non-HR users
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && !isHR) {
      router.push("/dashboard");
    }
  }, [user, authLoading, isHR, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (authLoading || tasksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !isHR) return null;

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasksError ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded">
            Error loading tasks: {tasksError}
          </div>
        ) : (
          <HrTasksView tasks={tasks} onLogout={handleLogout} />
        )}
      </div>
    </SidebarLayout>
  );
}