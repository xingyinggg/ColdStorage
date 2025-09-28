"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import { useUsers } from "@/utils/hooks/useUsers";

export default function CreateTaskPage() {
  const router = useRouter();

  const { createTask } = useTasks();
  const {
    projects,
    loading: loadingProjects,
    getProjectMembers,
  } = useProjects();
  const { userProfile, isStaff, loading:authLoading } = useAuth();
  const { users, loading: loadingUsers, getAllStaff, getAssignableUsers, fetchUsers} = useUsers(); 

  // Basic form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("on going");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Project and collaboration states
  const [selectedProject, setSelectedProject] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allStaff, setAllStaff] = useState([]);

  // Assignment states (for managers/directors)
  const [assignTo, setAssignTo] = useState("");
  const [availableStaff, setAvailableStaff] = useState([]);

  // Role-based permissions
  const canAssignTasks = userProfile?.role === "manager" || userProfile?.role === "director";
  const isDirector = userProfile?.role === "director";
  const isManager = userProfile?.role === "manager";

  // Fetch available staff for assignment (managers/directors only)
  useEffect(() => {
    const fetchStaffForAssignment = async () => {
      if (!canAssignTasks || !userProfile?.role) return;

      const result = await getAssignableUsers(userProfile.role);
      if (result.success) {
        setAvailableStaff(result.users);
      } else {
        setError("Failed to load available staff");
      }
    };

    fetchStaffForAssignment();
  }, [canAssignTasks, userProfile?.role, getAssignableUsers]);

  useEffect(() => {
    if (canAssignTasks) {
      setStatus("unassigned"); // Managers/Directors default to unassigned
    } else {
      setStatus("on going"); // Staff create tasks for themselves
    }
  }, [canAssignTasks]);

  useEffect(() => {
  const fetchAllUsers = async () => {
    if (!userProfile?.emp_id) return;
    
    // Fetch ALL users (no role filter) for standalone task collaborators
    const result = await fetchUsers({ excludeSelf: true }); // No roles parameter
    if (result.success) {
      setAllStaff(result.users); // Contains all users, not just staff
    }
  };

  fetchAllUsers();
}, [userProfile?.emp_id, fetchUsers]); // Use fetchUsers instead of getAllStaff

  // fetch project members
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

        // Clear collaborators when project changes
        setCollaborators([]);
      } catch (error) {
        console.error("Error fetching project members:", error);
        setError("Failed to load project members");
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchProjectMembers();
  }, [selectedProject, userProfile?.emp_id]);

  const handleCollaboratorToggle = (empId) => {
    setCollaborators((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
  };
  
  // Get appropriate collaborator list
  const getCollaboratorOptions = () => {
    if (selectedProject) {
      return projectMembers; // Only project members
    } else {
      return allStaff; // All staff for standalone tasks
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();

      // Add all form fields to FormData
      formData.append("title", title);
      formData.append("description", description);
      formData.append("priority", priority);

      // Handle status and assignment logic
      // Handle status and assignment logic
      if (canAssignTasks) {
        if (assignTo && assignTo !== "") {
          // Status "unassigned" + someone selected = assign to them, status becomes "on going"
          formData.append("status", "on going");
          formData.append("owner_id", assignTo);
          console.log("🎯 Assigning to someone:", assignTo);
        } else if (status === "unassigned") {
          // Status "unassigned" + no one selected = remains your task but status stays unassigned
          formData.append("status", "unassigned");
          // owner_id will be set to current user in backend (you own it but it's unassigned status)
          console.log("🎯 Creating unassigned task for yourself");
        } else {
          // Any other status selection (on going, under review, etc.) = assign to yourself
          formData.append("status", status);
          // owner_id will be set to current user in backend
          console.log("🎯 Assigning to self with status:", status);
        }
      } else {
        // Staff always create tasks for themselves
        formData.append("status", status);
        console.log("🎯 Staff creating task for self");
      }

      

      if (selectedProject) {
        formData.append("project_id", selectedProject);
      }

      if (dueDate && dueDate.trim() !== "") {
        formData.append("due_date", dueDate);
      }

      if (collaborators.length > 0) {
        formData.append("collaborators", JSON.stringify(collaborators));
      }

      if (file && file instanceof File) {
        console.log("📎 Adding file to FormData:", file.name);
        formData.append("file", file);
      }

      // Send FormData instead of regular object
      const result = await createTask(formData);

      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error || "Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
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
          <Link
            href="/dashboard/tasks"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Back to tasks
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={onSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Role indicator */}
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-700">
                Creating as: <span className="font-medium capitalize">{userProfile?.role}</span>
                {canAssignTasks && " (Can assign tasks to others)"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g. Prepare weekly report"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Optional details about the task"
              />
            </div>

            {/* Assignment section for managers/directors */}
            {canAssignTasks && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Task To
                </label>
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting || loadingUsers}
                >
                  <option value="">Assign to myself</option>
                  {loadingUsers ? (
                    <option value="">Loading staff...</option>
                  ) : (
                    availableStaff.map((staff) => (
                      <option key={staff.emp_id} value={staff.emp_id}>
                        {staff.name} ({staff.role}) - {staff.department || 'No department'}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to assign to yourself
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="on going">On Going</option>
                  <option value="under review">Under Review</option>
                  <option value="completed">Completed</option>
                  {canAssignTasks && <option value="unassigned">Unassigned</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Attachment (PDF)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  PDF files only, max 10MB
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={submitting || loadingProjects}
                >
                  {loadingProjects ? (
                    <option value="">Loading projects...</option>
                  ) : projects.length === 0 ? (
                    <option value="">No projects available</option>
                  ) : (
                    <>
                      <option value="">Select a project (optional)</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {projects.length === 0 && !loadingProjects && (
                  <p className="mt-1 text-xs text-gray-500">
                    You are not part of any projects yet.
                  </p>
                )}
              </div>

               <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Collaborators</label>
                {selectedProject ? (
                  loadingMembers ? (
                    <div className="text-gray-500">Loading project members...</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                      {projectMembers.length > 0 ? (
                        projectMembers.map((member) => (
                          <label key={member.emp_id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={collaborators.includes(member.emp_id)}
                              onChange={() => handleCollaboratorToggle(member.emp_id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{member.name} ({member.email})</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No other project members</p>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {loadingUsers ? (
                      <div className="text-gray-500">Loading staff members...</div>
                    ) : allStaff.length > 0 ? (
                      allStaff.map((staff) => (
                        <label key={staff.emp_id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={collaborators.includes(staff.emp_id)}
                            onChange={() => handleCollaboratorToggle(staff.emp_id)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{staff.name} ({staff.role}) - {staff.email}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No users available</p>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {selectedProject ? "Select from project team members" : "Select from all staff members"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                href="/dashboard/tasks"
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
