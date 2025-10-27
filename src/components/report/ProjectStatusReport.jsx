"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ProjectStatusReport({ project }) {
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project?.id) {
      fetchProjectData();
    }
  }, [project?.id]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the current session token
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Authentication required. Please sign in.");
      }

      const token = session.access_token;

      // Fetch tasks for this project
      const tasksResponse = await fetch(
        `http://localhost:4000/tasks/project/${project.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!tasksResponse.ok) {
        const errorData = await tasksResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch tasks (${tasksResponse.status})`);
      }

      const tasksData = await tasksResponse.json();

      // Fetch team member details
      const membersResponse = await fetch(
        `http://localhost:4000/projects/${project.id}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!membersResponse.ok) {
        const errorData = await membersResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch team members (${membersResponse.status})`);
      }

      const membersData = await membersResponse.json();
      const membersList = membersData.members || [];

      // Fetch additional user details for all members including owner
      const allMemberIds = [...(project.members || [])];
      if (project.owner_id && !allMemberIds.includes(project.owner_id)) {
        allMemberIds.push(project.owner_id);
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("emp_id, name, role, department")
        .in("emp_id", allMemberIds);

      if (usersError) {
        console.error("Error fetching user details:", usersError);
      }

      // Enrich tasks with owner names
      const enrichedTasks = await enrichTasksWithNames(tasksData, supabase);

      setTasks(enrichedTasks);
      setTeamMembers(usersData || []);
    } catch (err) {
      console.error("Error fetching project data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const enrichTasksWithNames = async (tasks, supabase) => {
    const ownerIds = [...new Set(tasks.map((t) => t.owner_id).filter(Boolean))];

    if (ownerIds.length === 0) return tasks;

    const { data: ownersData } = await supabase
      .from("users")
      .select("emp_id, name")
      .in("emp_id", ownerIds);

    const ownerMap = {};
    (ownersData || []).forEach((owner) => {
      ownerMap[owner.emp_id] = owner.name;
    });

    return tasks.map((task) => ({
      ...task,
      owner_name: ownerMap[task.owner_id] || "Unknown",
    }));
  };

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "ongoing":
        return "bg-blue-100 text-blue-800";
      case "under review":
        return "bg-yellow-100 text-yellow-800";
      case "unassigned":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority) => {
    if (priority >= 8) return "text-red-600 font-bold";
    if (priority >= 5) return "text-orange-600 font-semibold";
    return "text-gray-600";
  };

  const getProjectStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(
      (t) => t.status?.toLowerCase() === "completed"
    ).length;
    const ongoing = tasks.filter(
      (t) => t.status?.toLowerCase() === "ongoing"
    ).length;
    const underReview = tasks.filter(
      (t) => t.status?.toLowerCase() === "under review"
    ).length;
    const overdue = tasks.filter(
      (t) =>
        t.due_date &&
        new Date(t.due_date) < new Date() &&
        t.status?.toLowerCase() !== "completed"
    ).length;

    return { total, completed, ongoing, underReview, overdue };
  };

  const getTasksByStatus = () => {
    const completed = tasks.filter(
      (t) => t.status?.toLowerCase() === "completed"
    );
    const underReview = tasks.filter(
      (t) => t.status?.toLowerCase() === "under review"
    );
    const ongoing = tasks.filter((t) => t.status?.toLowerCase() === "ongoing");
    const unassigned = tasks.filter(
      (t) => t.status?.toLowerCase() === "unassigned"
    );

    return { completed, underReview, ongoing, unassigned };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "No due date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = (task) => {
    if (!task.due_date || task.status?.toLowerCase() === "completed")
      return false;
    return new Date(task.due_date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading project details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading project data: {error}</p>
      </div>
    );
  }

  const stats = getProjectStats();
  const tasksByStatus = getTasksByStatus();
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {project.title}
        </h2>
        <p className="text-gray-700 mb-4">
          {project.description || "No description provided"}
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>
            <div className="font-semibold text-gray-900 capitalize">
              {project.status}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Created:</span>
            <div className="font-semibold text-gray-900">
              {formatDate(project.created_at)}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Last Updated:</span>
            <div className="font-semibold text-gray-900">
              {formatDate(project.updated_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Tasks</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-700">
            {stats.completed}
          </div>
          <div className="text-sm text-gray-600 mt-1">Completed</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-700">
            {stats.ongoing}
          </div>
          <div className="text-sm text-gray-600 mt-1">Ongoing</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">
            {stats.underReview}
          </div>
          <div className="text-sm text-gray-600 mt-1">Under Review</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center" suppressHydrationWarning>
          <div className="text-3xl font-bold text-red-700">
            {stats.overdue}
          </div>
          <div className="text-sm text-gray-600 mt-1">Overdue</div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Team Members ({teamMembers.length})
        </h3>
        {teamMembers.length === 0 ? (
          <p className="text-gray-500 text-sm">No team members found</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {teamMembers.map((member) => (
              <div
                key={member.emp_id}
                className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold mr-3">
                  {member.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{member.name}</div>
                  <div className="text-xs text-gray-600">
                    {member.role}
                    {project.owner_id === member.emp_id && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{member.department}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== COMMENTED OUT: ORIGINAL TIMELINE (CREATED FROM SCRATCH) ========== */}
      {/* 
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Task Timeline (Sorted by Due Date)
        </h3>
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No tasks found for this project
          </p>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              {sortedTasks.map((task, index) => (
                <div key={task.id} className="relative pb-8 last:pb-0">
                  {index < sortedTasks.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300"></div>
                  )}

                  <div className="relative flex items-start group">
                    <div
                      className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full border-4 border-white ${
                        task.status?.toLowerCase() === "completed"
                          ? "bg-green-500"
                          : isOverdue(task)
                          ? "bg-red-500"
                          : task.status?.toLowerCase() === "under review"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                    >
                      {task.status?.toLowerCase() === "completed" && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="ml-12 flex-1 bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900">
                              {task.title}
                            </h4>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                                task.status
                              )}`}
                            >
                              {task.status}
                            </span>
                            {isOverdue(task) && (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                Overdue
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              {task.owner_name}
                            </div>
                            <div className="flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span
                                className={
                                  isOverdue(task) ? "text-red-600 font-semibold" : ""
                                }
                              >
                                {formatDate(task.due_date)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                                />
                              </svg>
                              <span className={getPriorityColor(task.priority)}>
                                Priority: {task.priority || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      */}
      {/* ========== END COMMENTED TIMELINE ========== */}

      {/* NEW: Task Schedule/Calendar View (Grouped by Date) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Task Timeline
        </h3>
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No tasks found for this project
          </p>
        ) : (
          <div className="space-y-4">
            {/* Group tasks by date */}
            {(() => {
              // Group tasks by due date
              const tasksByDate = new Map();
              const noDateTasks = [];

              tasks.forEach(task => {
                if (task.due_date) {
                  const dateKey = new Date(task.due_date).toDateString();
                  if (!tasksByDate.has(dateKey)) {
                    tasksByDate.set(dateKey, []);
                  }
                  tasksByDate.get(dateKey).push(task);
                } else {
                  noDateTasks.push(task);
                }
              });

              // Sort dates
              const sortedDates = Array.from(tasksByDate.keys()).sort(
                (a, b) => new Date(a) - new Date(b)
              );

              return (
                <>
                  {sortedDates.map((dateKey) => {
                    const tasksForDate = tasksByDate.get(dateKey);
                    const date = new Date(dateKey);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isPast = date < new Date() && !isToday;

                    return (
                      <div key={dateKey} className="border-l-4 border-blue-500 pl-4" suppressHydrationWarning>
                        <div className="flex items-center gap-2 mb-3" suppressHydrationWarning>
                          <h4 className={`font-semibold ${isPast ? 'text-red-700' : isToday ? 'text-blue-700' : 'text-gray-900'}`} suppressHydrationWarning>
                            {formatDate(dateKey)}
                          </h4>
                          {isToday && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full" suppressHydrationWarning>
                              Today
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full" suppressHydrationWarning>
                              Past Due
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            ({tasksForDate.length} {tasksForDate.length === 1 ? 'task' : 'tasks'})
                          </span>
                        </div>

                        <div className="space-y-2">
                          {tasksForDate.map((task) => (
                            <div
                              key={task.id}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-gray-900">
                                      {task.title}
                                    </h5>
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                                        task.status
                                      )}`}
                                    >
                                      {task.status}
                                    </span>
                                  </div>
                                  {task.description && (
                                    <p className="text-sm text-gray-600 mb-2">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <div className="flex items-center">
                                      <svg
                                        className="w-3 h-3 mr-1"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                      </svg>
                                      {task.owner_name}
                                    </div>
                                    <div className={getPriorityColor(task.priority)}>
                                      Priority: {task.priority || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Tasks without due dates */}
                  {noDateTasks.length > 0 && (
                    <div className="border-l-4 border-gray-400 pl-4">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-semibold text-gray-700">
                          No Due Date
                        </h4>
                        <span className="text-sm text-gray-500">
                          ({noDateTasks.length} {noDateTasks.length === 1 ? 'task' : 'tasks'})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {noDateTasks.map((task) => (
                          <div
                            key={task.id}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium text-gray-900">
                                {task.title}
                              </h5>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                                  task.status
                                )}`}
                              >
                                {task.status}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <div className="flex items-center">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {task.owner_name}
                              </div>
                              <div className={getPriorityColor(task.priority)}>
                                Priority: {task.priority || "N/A"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Task Breakdown by Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Task Breakdown by Status
        </h3>
        <div className="space-y-4">
          {/* Completed Tasks */}
          {tasksByStatus.completed.length > 0 && (
            <div>
              <h4 className="font-medium text-green-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Completed Tasks ({tasksByStatus.completed.length})
              </h4>
              <div className="pl-5 space-y-1">
                {tasksByStatus.completed.map((task) => (
                  <div
                    key={task.id}
                    className="text-sm text-gray-600 flex items-center justify-between"
                  >
                    <span>• {task.title}</span>
                    <span className="text-xs text-gray-500">
                      {task.owner_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Under Review Tasks */}
          {tasksByStatus.underReview.length > 0 && (
            <div>
              <h4 className="font-medium text-yellow-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                Under Review ({tasksByStatus.underReview.length})
              </h4>
              <div className="pl-5 space-y-1">
                {tasksByStatus.underReview.map((task) => (
                  <div
                    key={task.id}
                    className="text-sm text-gray-600 flex items-center justify-between"
                  >
                    <span>• {task.title}</span>
                    <span className="text-xs text-gray-500">
                      {task.owner_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ongoing Tasks */}
          {tasksByStatus.ongoing.length > 0 && (
            <div>
              <h4 className="font-medium text-blue-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Ongoing ({tasksByStatus.ongoing.length})
              </h4>
              <div className="pl-5 space-y-1">
                {tasksByStatus.ongoing.map((task) => (
                  <div
                    key={task.id}
                    className="text-sm text-gray-600 flex items-center justify-between"
                  >
                    <span>• {task.title}</span>
                    <span className="text-xs text-gray-500">
                      {task.owner_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned Tasks */}
          {tasksByStatus.unassigned.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
                Unassigned ({tasksByStatus.unassigned.length})
              </h4>
              <div className="pl-5 space-y-1">
                {tasksByStatus.unassigned.map((task) => (
                  <div
                    key={task.id}
                    className="text-sm text-gray-600 flex items-center justify-between"
                  >
                    <span>• {task.title}</span>
                    <span className="text-xs text-gray-500">
                      {task.owner_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
