"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";

export default function ProjectsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    members: [],
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [memberNames, setMemberNames] = useState({});
  const [projectTasks, setProjectTasks] = useState({}); // New state for tasks
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({}); // New state for collapsed/expanded
  const router = useRouter();
  const supabase = createClient();

  // Use centralized auth hook
  const { user, userProfile, loading: authLoading, signOut } = useAuth();

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    createProject,
  } = useProjects();

  useEffect(() => {
    if (projects && projects.length > 0) {
      fetchMemberNames(projects);
      fetchProjectTasks();
    }
  }, [projects]);

  // Toggle project expansion
  const toggleProjectExpansion = (projectId) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Expand all projects
  const expandAllProjects = () => {
    const expanded = {};
    projects.forEach((project) => {
      expanded[project.id] = true;
    });
    setExpandedProjects(expanded);
  };

  // Collapse all projects
  const collapseAllProjects = () => {
    setExpandedProjects({});
  };

  const fetchProjectTasks = async () => {
    if (!projects || projects.length === 0) return;

    try {
      setLoadingTasks(true);
      const projectIds = projects.map((project) => project.id);

      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tasks/bulk`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ project_ids: projectIds }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch tasks");
      const tasks = await response.json();

      // Group tasks by project_id
      const tasksGrouped = {};
      projects.forEach((project) => {
        tasksGrouped[project.id] =
          tasks.filter((task) => task.project_id === project.id) || [];
      });

      setProjectTasks(tasksGrouped);
    } catch (error) {
      console.error("Error fetching project tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Add helper function to get auth token
  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Replace fetchMemberNames function:
  const fetchMemberNames = async (projectsList) => {
    if (!projectsList || projectsList.length === 0) return;

    const allEmpIds = new Set();
    projectsList.forEach((project) => {
      if (project.members && Array.isArray(project.members)) {
        project.members.forEach((empId) => allEmpIds.add(empId));
      }
    });

    if (allEmpIds.size === 0) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/bulk`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emp_ids: Array.from(allEmpIds) }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch users");
      const usersData = await response.json();

      const namesMap = {};
      usersData.forEach((user) => {
        namesMap[user.emp_id] = user.name;
      });
      setMemberNames(namesMap);
    } catch (error) {
      console.error("Error fetching member names:", error);
    }
  };

  // Replace searchUsers function:
  const searchUsers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const token = await getAuthToken();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(
          searchTerm
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to search users");
      const data = await response.json();

      // Filter out already selected members
      const filteredResults = data.filter(
        (user) =>
          !newProject.members.some((member) => member.emp_id === user.emp_id)
      );

      setSearchResults(filteredResults);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Count tasks by status for a project
  const getTaskCounts = (tasks) => {
    const counts = { pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach((task) => {
      if (counts.hasOwnProperty(task.status)) {
        counts[task.status]++;
      }
    });
    return counts;
  };

  // Update the form reset to include current user
  const resetForm = async () => {
    if (userProfile) {
      setNewProject({
        name: "",
        description: "",
        members: [
          {
            emp_id: userProfile.emp_id,
            name: userProfile.name,
            email: user.email,
          },
        ],
      });
    } else {
      setNewProject({
        name: "",
        description: "",
        members: [],
      });
    }
    setMemberSearch("");
    setSearchResults([]);
  };

  // Update create form button handler
  const handleShowCreateForm = async () => {
    if (!showCreateForm) {
      // When opening form, auto-add current user
      await resetForm();
    }
    setShowCreateForm(!showCreateForm);
  };

  // Update cancel button handler
  const handleCancelForm = () => {
    setShowCreateForm(false);
    setNewProject({
      name: "",
      description: "",
      members: [],
    });
    setMemberSearch("");
    setSearchResults([]);
  };

  // Handle member search input
  const handleMemberSearchChange = (e) => {
    const value = e.target.value;
    setMemberSearch(value);
    searchUsers(value);
  };

  // Add member to project
  const addMember = (user) => {
    setNewProject((prev) => ({
      ...prev,
      members: [...prev.members, user],
    }));
    setMemberSearch("");
    setSearchResults([]);
  };

  // Remove member from project
  const removeMember = (empId) => {
    setNewProject((prev) => ({
      ...prev,
      members: prev.members.filter((member) => member.emp_id !== empId),
    }));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      // Extract just the emp_ids for the database
      const memberIds = newProject.members.map((member) => member.emp_id);

      const projectData = {
        name: newProject.name,
        description: newProject.description,
        members: memberIds,
      };

      await createProject(projectData);
      setNewProject({ name: "", description: "", members: [] });
      setShowCreateForm(false);
      setMemberSearch("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

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

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  console.log("Projects data:", projects);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-12 sm:h-16 items-center">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
              >
                ← Dashboard
              </Link>
              <h1 className="text-lg sm:text-xl font-semibold">Projects</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-gray-700 text-xs sm:text-sm hidden sm:block">
                Welcome, {userProfile?.name || user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-2 py-1 sm:px-3 rounded hover:bg-red-600 text-xs sm:text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-2 sm:py-6 px-2 sm:px-6 lg:px-8">
        <div className="px-2 py-3 sm:px-4 sm:py-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-2 py-3 sm:px-4 sm:py-5 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-3 sm:space-y-0">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  Your Projects
                </h3>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  {projects.length > 0 && (
                    <div className="flex space-x-2">
                      <button
                        onClick={expandAllProjects}
                        className="flex-1 sm:flex-none px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={collapseAllProjects}
                        className="flex-1 sm:flex-none px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Collapse All
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleShowCreateForm}
                    className="inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create New Project
                  </button>
                </div>
              </div>

              {/* Create Project Form*/}
              {showCreateForm && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <form onSubmit={handleCreateProject}>
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newProject.name}
                        onChange={(e) =>
                          setNewProject({ ...newProject, name: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={newProject.description}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Members Section */}
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add Members
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={memberSearch}
                          onChange={handleMemberSearchChange}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {searchLoading ? (
                              <div className="px-3 py-2 text-gray-500 text-sm">
                                Searching...
                              </div>
                            ) : (
                              searchResults.map((user) => (
                                <button
                                  key={user.emp_id}
                                  type="button"
                                  onClick={() => addMember(user)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                >
                                  <div className="font-medium text-sm">
                                    {user.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {user.email}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected Members*/}
                      {newProject.members.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Selected Members:
                          </div>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {newProject.members.map((member) => (
                              <span
                                key={member.emp_id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm bg-blue-100 text-blue-800"
                              >
                                <span className="truncate max-w-24 sm:max-w-none">
                                  {member.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeMember(member.emp_id)}
                                  className="ml-1 text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Create Project
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewProject({
                            name: "",
                            description: "",
                            members: [],
                          });
                          setMemberSearch("");
                          setSearchResults([]);
                        }}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Projects List with Tasks  */}
              {projectsLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading projects...</div>
                </div>
              ) : projectsError ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">
                    Error loading projects
                  </div>
                  <div className="text-sm text-gray-500">{projectsError}</div>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">No projects yet</div>
                  <p className="text-sm text-gray-400">
                    Click "Create New Project" to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {projects.map((project) => {
                    const tasks = projectTasks[project.id] || [];
                    const taskCounts = getTaskCounts(tasks);
                    const isExpanded = expandedProjects[project.id];

                    return (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Project Header */}
                        <div className="bg-gray-50 px-3 py-3 sm:px-6 sm:py-4 border-b border-gray-200">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <button
                                  onClick={() =>
                                    toggleProjectExpansion(project.id)
                                  }
                                  className="mr-2 sm:mr-3 p-1 rounded hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  aria-label={
                                    isExpanded
                                      ? "Collapse project"
                                      : "Expand project"
                                  }
                                >
                                  <svg
                                    className={`w-4 h-4 sm:w-5 sm:h-5 transform transition-transform duration-200 ease-in-out ${
                                      isExpanded ? "rotate-90" : "rotate-0"
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                                <h4 className="text-lg sm:text-xl font-semibold text-gray-900">
                                  {project.title}
                                </h4>
                              </div>
                              {project.description && (
                                <p className="text-gray-600 mb-3 ml-6 sm:ml-8 text-sm sm:text-base">
                                  {project.description}
                                </p>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-500 ml-6 sm:ml-8">
                                <span>Status: {project.status}</span>
                                {project.members &&
                                  project.members.length > 0 && (
                                    <span className="break-words">
                                      Team:{" "}
                                      {project.members.map((empId, index) => (
                                        <span
                                          key={empId}
                                          className="text-blue-600"
                                        >
                                          {memberNames[empId] || `ID: ${empId}`}
                                          {index < project.members.length - 1
                                            ? ", "
                                            : ""}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                <span>
                                  Created:{" "}
                                  {new Date(
                                    project.created_at
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Task Summary */}
                            <div className="sm:ml-6 text-left sm:text-right">
                              <div className="text-xs sm:text-sm text-gray-500 mb-1">
                                Tasks Summary
                              </div>
                              <div className="grid grid-cols-3 sm:flex sm:space-x-4 gap-2 sm:gap-0 text-xs sm:text-sm">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-400 rounded-full mr-1"></div>
                                  <span className="text-xs">
                                    To-do: {taskCounts.pending}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full mr-1"></div>
                                  <span className="text-xs">
                                    Progress: {taskCounts.in_progress}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full mr-1"></div>
                                  <span className="text-xs">
                                    Done: {taskCounts.completed}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Tasks Section  */}
                        {isExpanded && (
                          <div className="p-3 sm:p-6">
                            {loadingTasks ? (
                              <div className="text-center py-4 text-gray-500">
                                Loading tasks...
                              </div>
                            ) : tasks.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <div className="text-base sm:text-lg mb-2">
                                  No tasks yet
                                </div>
                                <p className="text-sm">
                                  Tasks will appear here once created
                                </p>
                              </div>
                            ) : (
                              <div>
                                <h5 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">
                                  Project Tasks ({tasks.length})
                                </h5>

                                {/* Task Columns  */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                  {/* TO DO Column */}
                                  <div className="bg-yellow-50 rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center mb-3">
                                      <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
                                      <h6 className="font-medium text-gray-900 text-sm sm:text-base">
                                        To-do
                                      </h6>
                                      <span className="ml-2 bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                        {taskCounts.pending}
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {tasks
                                        .filter(
                                          (task) => task.status === "pending"
                                        )
                                        .map((task) => (
                                          <div
                                            key={task.id}
                                            className="bg-white p-2 sm:p-3 rounded border border-yellow-200 shadow-sm"
                                          >
                                            {/* Task Title */}
                                            <div className="font-medium text-xs sm:text-sm text-gray-900 mb-2">
                                              {task.title}
                                            </div>

                                            {/* Task Description */}
                                            {task.description && (
                                              <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                {task.description}
                                              </div>
                                            )}

                                            {/* Due Date and Priority */}
                                            <div className="flex items-center justify-between mb-2">
                                              <div>
                                                {task.due_date && (
                                                  <span className="text-xs text-gray-500">
                                                    Due:{" "}
                                                    {new Date(
                                                      task.due_date
                                                    ).toLocaleDateString()}
                                                  </span>
                                                )}
                                              </div>
                                              <div>
                                                {task.priority && (
                                                  <span
                                                    className={`text-xs px-2 py-1 rounded-full ${
                                                      task.priority === "high"
                                                        ? "bg-red-100 text-red-800"
                                                        : task.priority ===
                                                          "medium"
                                                        ? "bg-orange-100 text-orange-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                                  >
                                                    {task.priority
                                                      .charAt(0)
                                                      .toUpperCase() +
                                                      task.priority.slice(1)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>

                                  {/* IN PROGRESS Column */}
                                  <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center mb-3">
                                      <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
                                      <h6 className="font-medium text-gray-900 text-sm sm:text-base">
                                        In Progress
                                      </h6>
                                      <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full">
                                        {taskCounts.in_progress}
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {tasks
                                        .filter(
                                          (task) =>
                                            task.status === "in_progress"
                                        )
                                        .map((task) => (
                                          <div
                                            key={task.id}
                                            className="bg-white p-2 sm:p-3 rounded border border-blue-200 shadow-sm"
                                          >
                                            <div className="font-medium text-xs sm:text-sm text-gray-900 mb-2">
                                              {task.title}
                                            </div>
                                            {task.description && (
                                              <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                {task.description}
                                              </div>
                                            )}
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 mb-2">
                                              {task.due_date && (
                                                <span className="text-xs text-gray-500">
                                                  Due:{" "}
                                                  {new Date(
                                                    task.due_date
                                                  ).toLocaleDateString()}
                                                </span>
                                              )}
                                              {task.priority && (
                                                <span
                                                  className={`text-xs px-2 py-1 rounded-full self-start sm:self-auto ${
                                                    task.priority === "high"
                                                      ? "bg-red-100 text-red-800"
                                                      : task.priority ===
                                                        "medium"
                                                      ? "bg-orange-100 text-orange-800"
                                                      : "bg-gray-100 text-gray-800"
                                                  }`}
                                                >
                                                  {task.priority
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    task.priority.slice(1)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>

                                  {/* DONE Column */}
                                  <div className="bg-green-50 rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center mb-3">
                                      <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                                      <h6 className="font-medium text-gray-900 text-sm sm:text-base">
                                        Done
                                      </h6>
                                      <span className="ml-2 bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                                        {taskCounts.completed}
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {tasks
                                        .filter(
                                          (task) => task.status === "completed"
                                        )
                                        .map((task) => (
                                          <div
                                            key={task.id}
                                            className="bg-white p-2 sm:p-3 rounded border border-green-200 shadow-sm"
                                          >
                                            <div className="font-medium text-xs sm:text-sm text-gray-900 mb-2">
                                              {task.title}
                                            </div>
                                            {task.description && (
                                              <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                {task.description}
                                              </div>
                                            )}
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 mb-2">
                                              {task.due_date && (
                                                <span className="text-xs text-gray-500">
                                                  Due:{" "}
                                                  {new Date(
                                                    task.due_date
                                                  ).toLocaleDateString()}
                                                </span>
                                              )}
                                              {task.priority && (
                                                <span
                                                  className={`text-xs px-2 py-1 rounded-full self-start sm:self-auto ${
                                                    task.priority === "high"
                                                      ? "bg-red-100 text-red-800"
                                                      : task.priority ===
                                                        "medium"
                                                      ? "bg-orange-100 text-orange-800"
                                                      : "bg-gray-100 text-gray-800"
                                                  }`}
                                                >
                                                  {task.priority
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    task.priority.slice(1)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
