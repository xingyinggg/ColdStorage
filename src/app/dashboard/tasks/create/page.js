"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useNotification } from "@/utils/hooks/useNotification";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import { useUsers } from "@/utils/hooks/useUsers";
import TaskForm from "@/components/tasks/TaskForm";

export default function CreateTaskPage() {
  const router = useRouter();
  const { createTask } = useTasks();
  const { createNotification } = useNotification();
  const {
    projects,
    loading: loadingProjects,
    getProjectMembers
  } = useProjects();
  const { userProfile } = useAuth();
  const { fetchUsers, getAssignableUsers } = useUsers();

  // States
  const [selectedProject, setSelectedProject] = useState("");
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allStaff, setAllStaff] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Role permissions
  const canAssignTasks = userProfile?.role === "manager" || userProfile?.role === "director";

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.emp_id) return;

      try {
        // Fetch all staff for standalone tasks
        const allUsersResult = await fetchUsers({ excludeSelf: true });
        if (allUsersResult.success) {
          setAllStaff(allUsersResult.users);
        }

        // Fetch assignable staff for managers/directors
        if (canAssignTasks && userProfile?.role) {
          const assignableResult = await getAssignableUsers(userProfile.role);
          if (assignableResult.success) {
            setAvailableStaff(assignableResult.users);
          }
        }
      } catch (error) {
        setError("Failed to load user data");
      }
    };

    fetchData();
  }, [userProfile?.emp_id, userProfile?.role, canAssignTasks]);

  // Fetch project members when project changes
  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!selectedProject) {
        setProjectMembers([]);
        return;
      }

      try {
        setLoadingMembers(true);
        const data = await getProjectMembers(selectedProject);

        // Filter out current user from project members
        const filteredMembers = (data.members || []).filter(
          (member) => member.emp_id !== userProfile?.emp_id
        );

        setProjectMembers(filteredMembers);
      } catch (error) {
        console.error("Error fetching project members:", error);
        setError("Failed to load project members");
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchProjectMembers();
  }, [selectedProject, userProfile?.emp_id]);

  const getCollaboratorOptions = () => {
    return selectedProject ? projectMembers : allStaff;
  };

  const handleTaskSubmit = async (taskData) => {
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();

      // Add task fields (including subtasks if present)
      // Skip fields that are handled separately (status, assignTo, dueDate)
      Object.keys(taskData).forEach(key => {
        if (key === 'collaborators') {
          formData.append('collaborators', JSON.stringify(taskData[key]));
        } else if (key === 'subtasks') {
          formData.append('subtasks', JSON.stringify(taskData[key]));
        } else if (key === 'status') {
          // Skip status here - we'll handle it in assignment logic below
          return;
        } else if (key === 'assignTo') {
          // Skip assignTo - it's only used for logic, not sent to backend
          return;
        } else if (taskData[key] !== null && taskData[key] !== '') {
          formData.append(key, taskData[key]);
        }
      });

      // Handle assignment logic
      if (canAssignTasks) {
        if (taskData.assignTo && taskData.assignTo !== "") {
          formData.append("status", "ongoing");
          formData.append("owner_id", taskData.assignTo);
        } else if (taskData.status === "unassigned") {
          formData.append("status", "unassigned");
        } else {
          formData.append("status", taskData.status);
        }
      } else {
        formData.append("status", taskData.status);
      }

      // Ensure due date is properly formatted
      if (taskData.dueDate) {
        formData.append("due_date", taskData.dueDate);
      }

      // Add project if selected
      if (selectedProject) {
        formData.append("project_id", selectedProject);
      }

      // Add file if selected
      if (file && file instanceof File) {
        formData.append("file", file);
      }

      const result = await createTask(formData);

      if (result.success) {
        const task = result.task;
        const isAssigning = task.owner_id && task.owner_id !== userProfile.emp_id;

        // Case 1: User assigns to someone else
        if (isAssigning) {
          // Notify the assignee
          const assigneeNotification = {
            emp_id: task.owner_id,
            title: `New Task Assigned (${task.title})`,
            description: task.description || "You have been assigned a new task.",
            type: "Task Assignment",
            created_at: new Date().toISOString(),
          };
          await createNotification(assigneeNotification);

          // Notify the assigner
          const assignerNotification = {
            emp_id: userProfile.emp_id,
            title: `Task Assigned Successfully`,
            description: `You assigned '${task.title}' to employee #${task.owner_id}.`,
            type: "Task Assignment Confirmation",
            created_at: new Date().toISOString(),
          };
          await createNotification(assignerNotification);
        }
        // Case 2: User creates for themselves
        else {
          const creatorNotification = {
            emp_id: userProfile.emp_id,
            title: `New Task Created (${task.title})`,
            description: task.description || "No description provided",
            type: "Task Creation",
            created_at: new Date().toISOString(),
          };
          await createNotification(creatorNotification);
        }

        router.push("/dashboard");
      } else {
        setError(result.error || "Failed to create task");
      }
    } catch (error) {
      setError(error.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Create Task</h1>
          <Link href="/dashboard/tasks" className="text-blue-600 hover:text-blue-800 text-sm">
            Back to tasks
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          {/* Role indicator */}
          <div className="bg-blue-50 p-3 rounded-md mb-6">
            <p className="text-sm text-blue-700">
              Creating as: <span className="font-medium capitalize">{userProfile?.role}</span>
              {canAssignTasks && " (Can assign tasks to others)"}
            </p>
          </div>

          {/* Task Form with integrated Subtask Manager */}
          <TaskForm
            onSubmit={handleTaskSubmit}
            onCancel={() => router.push("/dashboard/tasks")}
            canAssignTasks={canAssignTasks}
            availableStaff={availableStaff}
            availableCollaborators={getCollaboratorOptions()}
            loading={submitting}
            error={error}
            selectedProject={selectedProject}
            projects={projects}
            loadingProjects={loadingProjects}
            loadingMembers={loadingMembers}
            onProjectChange={setSelectedProject}
            file={file}
            onFileChange={setFile}
          />
        </div>
      </main>
    </div>
  );
}