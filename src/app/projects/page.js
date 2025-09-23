"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProjects } from "@/utils/hooks/useProjects";

export default function ProjectsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    members: [],
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    createProject,
    deleteProject,
  } = useProjects();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);

      // Auto-add current user to members when they open the form
      if (user && showCreateForm) {
        // Get user details from users table
        const { data: userData, error } = await supabase
          .from("users")
          .select("emp_id, name, email")
          .eq("id", user.id)
          .single();

        if (!error && userData) {
          setNewProject((prev) => ({
            ...prev,
            members: [userData],
          }));
        }
      }
    };

    getUser();
  }, [supabase.auth, showCreateForm]);

  // Update the form reset to include current user
  const resetForm = async () => {
    // Get current user details to auto-add to members
    const { data: userData, error } = await supabase
      .from("users")
      .select("emp_id, name, email, id")
      .eq("id", user.id)
      .single();

    setNewProject({
      name: "",
      description: "",
      members: userData && !error ? [userData] : [],
    });
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

  // Search for users
  const searchUsers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      console.log("Searching for:", searchTerm);

      const { data, error } = await supabase
        .from("users")
        .select("emp_id, name, email")
        .ilike("name", `%${searchTerm}%`)
        .limit(10);

      console.log("Search results:", data);
      console.log("Search error:", error);

      if (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
        return;
      }

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

  const handleDeleteProject = async (id) => {
    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(id);
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-semibold">Projects</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Your Projects
                </h3>
                <button
                  onClick={handleShowCreateForm}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create New Project
                </button>
              </div>

              {/* Create Project Form */}
              {showCreateForm && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <form onSubmit={handleCreateProject}>
                    <div className="mb-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="mb-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Members Section */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add Members
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={memberSearch}
                          onChange={handleMemberSearchChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                            {searchLoading ? (
                              <div className="px-3 py-2 text-gray-500">
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
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-sm text-gray-500">
                                    {user.email}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected Members */}
                      {newProject.members.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Selected Members:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {newProject.members.map((member) => (
                              <span
                                key={member.emp_id}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                              >
                                {member.name}
                                <button
                                  type="button"
                                  onClick={() => removeMember(member.emp_id)}
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Projects List */}
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
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 mb-2">
                            {project.title}
                          </h4>
                          {project.description && (
                            <p className="text-gray-600 mb-2">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Status: {project.status}</span>
                            <span>
                              Created:{" "}
                              {new Date(
                                project.created_at
                              ).toLocaleDateString()}
                            </span>
                            {project.members && project.members.length > 0 && (
                              <span>Members: {project.members.length}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
