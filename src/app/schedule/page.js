"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useUsers } from "@/utils/hooks/useUsers";
import TaskDetailsModal from "@/components/tasks/TaskDetailsModal";
import { useAuth } from "@/utils/hooks/useAuth";
import { useManagerTasks } from "@/utils/hooks/useManagerTasks";
import {
  startOfDay,
  addDays,
  isSameDay,
  getMonthGrid,
  getWeekGrid,
  groupTasksByDate,
  applyFilters,
} from "@/utils/calendarUtils";

export default function SchedulePage() {
  const [view, setView] = useState("month"); // month | week | day
  const [cursorDate, setCursorDate] = useState(() => startOfDay(new Date()));
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const { user, isStaff, userProfile, signOut } = useAuth();
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks(user);
  const { projects, loading: projectsLoading } = useProjects(user);
  const { users, fetchUsers } = useUsers();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const router = useRouter();

  // Manager/Director datasets
  const roleLower = (userProfile?.role || "").toLowerCase();
  const isManagerView = roleLower === "manager" || roleLower === "director";
  const {
    allTasks: managerAllTasks,
    allProjects: managerAllProjects,
    staffMembers,
    loading: managerLoading,
    error: managerError,
  } = useManagerTasks();

  // Load users for assignee filter only if not staff or manager/director
  useEffect(() => {
    if (!isStaff && !isManagerView) {
      fetchUsers({});
    }
  }, [fetchUsers, isStaff, isManagerView]);

  // For staff, auto-filter to self and hide the assignee filter
  useEffect(() => {
    const empId = userProfile?.emp_id;
    if (isStaff && empId) {
      setAssigneeFilter(String(empId));
    }
  }, [isStaff, userProfile?.emp_id]);

  // Build maps for quick lookups
  const projectList = useMemo(
    () => (isManagerView ? managerAllProjects || [] : projects || []),
    [isManagerView, managerAllProjects, projects]
  );
  const projectIdToTitle = useMemo(() => {
    const map = {};
    (projectList || []).forEach((p) => {
      map[p.id] = p.title;
    });
    return map;
  }, [projectList]);

  // Choose tasks by role
  const roleTasks = useMemo(
    () => (isManagerView ? managerAllTasks || [] : tasks || []),
    [isManagerView, managerAllTasks, tasks]
  );

  const memberIdToName = useMemo(() => {
    const map = {};
    const sourceUsers = isManagerView ? staffMembers || [] : users || [];

    (sourceUsers || []).forEach((u) => {
      const id = u.emp_id || u.id;
      if (id) map[id] = u.name || u.email || String(id);
    });

    (roleTasks || []).forEach((task) => {
      // Add owner names
      if (task.owner_id && task.owner_name) {
        map[task.owner_id] = task.owner_name;
      }
      if (task.manager?.id && task.manager?.name) {
        map[task.manager.id] = task.manager.name;
      }
      if (task.task_owner?.id && task.task_owner?.name) {
        map[task.task_owner.id] = task.task_owner.name;
      }

      // Add assignee names
      if (task.assignees && Array.isArray(task.assignees)) {
        task.assignees.forEach((assignee) => {
          if (assignee.id && assignee.name) {
            map[assignee.id] = assignee.name;
          }
          if (assignee.emp_id && assignee.name) {
            map[assignee.emp_id] = assignee.name;
          }
        });
      }

      // Add collaborator names if they're objects with name data
      if (task.collaborators && Array.isArray(task.collaborators)) {
        task.collaborators.forEach((collab) => {
          if (typeof collab === "object" && collab.id && collab.name) {
            map[collab.id] = collab.name;
          }
          if (typeof collab === "object" && collab.emp_id && collab.name) {
            map[collab.emp_id] = collab.name;
          }
        });
      }
    });

    return map;
  }, [users, staffMembers, isManagerView, roleTasks]);

  // Normalize and filter tasks: must have due_date
  const schedulableTasks = useMemo(() => {
    return applyFilters(roleTasks || [], {
      projectId: projectFilter,
      status: statusFilter,
      assigneeId: assigneeFilter,
      requireDueDate: true,
    });
  }, [roleTasks, projectFilter, statusFilter, assigneeFilter]);

  const daysGrid = useMemo(() => {
    if (view === "day") return [cursorDate];
    if (view === "week") return getWeekGrid(cursorDate);
    return getMonthGrid(cursorDate);
  }, [view, cursorDate]);

  const tasksByDay = useMemo(() => {
    return groupTasksByDate(schedulableTasks, daysGrid);
  }, [daysGrid, schedulableTasks]);

  const goPrev = () => {
    if (view === "day") setCursorDate(addDays(cursorDate, -1));
    else if (view === "week") setCursorDate(addDays(cursorDate, -7));
    else
      setCursorDate(
        new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1)
      );
  };
  const goNext = () => {
    if (view === "day") setCursorDate(addDays(cursorDate, 1));
    else if (view === "week") setCursorDate(addDays(cursorDate, 7));
    else
      setCursorDate(
        new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1)
      );
  };
  const goToday = () => setCursorDate(startOfDay(new Date()));

  const headerLabel = useMemo(() => {
    if (view === "day") return cursorDate.toLocaleDateString();
    if (view === "week") {
      const start = getWeekGrid(cursorDate)[0];
      const end = addDays(start, 6);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return cursorDate.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [view, cursorDate]);

  // Status options from existing usage in forms/modals
  const statusOptions = ["ongoing", "under review", "completed"];

  // UI helpers for color-coding
  const getStatusChipClasses = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "bg-green-50 text-green-700 border-green-200";
    if (s === "under review") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "ongoing") return "bg-amber-50 text-amber-700 border-amber-200";
    if (s === "unassigned") return "bg-gray-50 text-gray-700 border-gray-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getStatusDotClasses = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "bg-green-500";
    if (s === "under review") return "bg-blue-500";
    if (s === "ongoing") return "bg-amber-500";
    if (s === "unassigned") return "bg-gray-500";
    return "bg-gray-500";
  };

  const getPriorityBadgeClasses = (priority) => {
    const p = Number(priority);
    if (Number.isFinite(p)) {
      if (p >= 7) return "bg-red-50 text-red-700 border-red-200";
      if (p >= 4) return "bg-yellow-50 text-yellow-700 border-yellow-200";
      if (p >= 1) return "bg-green-50 text-green-700 border-green-200";
    }
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getProjectCode = (projectId) => {
    const title = projectIdToTitle[projectId];
    if (!title) return "—";
    const code = title
      .replace(/[^A-Za-z0-9]+/g, "")
      .slice(0, 3)
      .toUpperCase();
    return code || "—";
  };

  const openDetails = (task) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };
  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedTask(null);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar
          title="Schedule"
          user={user}
          userProfile={userProfile}
          roleLabel={userProfile?.role || "User"}
          roleColor="gray"
          onLogout={handleLogout}
        />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1 className="text-lg sm:text-xl font-semibold">Schedule</h1>
              <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
                {/* View mode buttons */}
                <div className="flex w-full sm:w-auto justify-between sm:justify-start rounded-md border border-gray-200 overflow-hidden text-sm">
                  {["day", "week", "month"].map((mode) => (
                    <button
                      key={mode}
                      className={`flex-1 px-3 py-1 ${
                        view === mode
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setView(mode)}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex w-full sm:w-auto justify-between sm:justify-start rounded-md border border-gray-200 overflow-hidden text-sm">
                  <button
                    className="flex-1 px-3 py-1 hover:bg-gray-100"
                    onClick={goPrev}
                    aria-label="Previous"
                  >
                    ◀
                  </button>
                  <button
                    className="flex-1 px-3 py-1 hover:bg-gray-100"
                    onClick={goToday}
                  >
                    Today
                  </button>
                  <button
                    className="flex-1 px-3 py-1 hover:bg-gray-100"
                    onClick={goNext}
                    aria-label="Next"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div
              className={`mt-4 grid grid-cols-1 ${
                isStaff ? "sm:grid-cols-2" : "sm:grid-cols-3"
              } gap-3`}
            >
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All projects</option>
                {(projectList || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {!isStaff && (
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All assignees</option>
                  {(isManagerView ? staffMembers || [] : users || []).map(
                    (u) => (
                      <option key={u.emp_id || u.id} value={u.emp_id || u.id}>
                        {u.name || u.email}
                      </option>
                    )
                  )}
                </select>
              )}
            </div>

            {/* Calendar header */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">
                {headerLabel}
              </div>
              {(isManagerView ? managerLoading : tasksLoading) ||
              projectsLoading ? (
                <div className="text-xs text-gray-500">Loading…</div>
              ) : null}
              {(isManagerView ? managerError : tasksError) ? (
                <div className="text-xs text-red-600">
                  {isManagerView ? managerError : tasksError}
                </div>
              ) : null}
            </div>

            {/* Calendar grid */}
            {view === "month" && (
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[600px] sm:min-w-full grid grid-cols-7 gap-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div
                        key={d}
                        className="text-xs font-semibold text-gray-600 px-2"
                      >
                        {d}
                      </div>
                    )
                  )}
                  {daysGrid.map((day, idx) => {
                    const dayTasks =
                      tasksByDay.get(startOfDay(day).getTime()) || [];
                    const isCurrentMonth =
                      day.getMonth() === cursorDate.getMonth();
                    const isTodayCell = isSameDay(day, new Date());
                    return (
                      <div
                        key={idx}
                        className={`border border-gray-200 rounded-md p-1 sm:p-2 min-h-[90px] sm:min-h-[110px] relative ${
                          isCurrentMonth ? "bg-white" : "bg-gray-50"
                        } ${isTodayCell ? "ring-2 ring-red-300" : ""}`}
                      >
                        <div className="text-[11px] font-medium text-gray-700 flex items-center">
                          {day.getDate()}
                          {isTodayCell && (
                            <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayTasks.length === 0 ? (
                            <div className="text-[11px] text-gray-400">
                              No tasks
                            </div>
                          ) : (
                            dayTasks.slice(0, 5).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => openDetails(t)}
                                className={`w-full text-left text-[10px] sm:text-[11px] px-2 py-1 rounded border truncate hover:opacity-95 ${getStatusChipClasses(
                                  t.status
                                )}`}
                                title={`${t.title}\nProject: ${
                                  projectIdToTitle[t.project_id] || "No project"
                                }\nStatus: ${t.status || "-"}\nPriority: ${
                                  t.priority ?? "-"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center min-w-0">
                                    {/* <span
                                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusDotClasses(
                                        t.status
                                      )}`}
                                    /> */}
                                    <span className="truncate">{t.title}</span>
                                  </div>

                                  {/* Hide priority badge on mobile */}
                                  <span
                                    className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${getPriorityBadgeClasses(
                                      t.priority
                                    )}`}
                                  >
                                    P{t.priority}
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                          {dayTasks.length > 5 && (
                            <div className="text-[11px] text-gray-500">
                              +{dayTasks.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === "week" && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-7 gap-2">
                {daysGrid.map((day, idx) => {
                  const dayTasks =
                    tasksByDay.get(startOfDay(day).getTime()) || [];
                  const isTodayCell = isSameDay(day, new Date());

                  return (
                    <div
                      key={idx}
                      className={`border border-gray-200 rounded-md p-2 sm:p-3 bg-white ${
                        isTodayCell ? "ring-2 ring-red-300" : ""
                      }`}
                    >
                      {/* Day header */}
                      <div className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center justify-between">
                        <span>
                          {day.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {isTodayCell && (
                          <span className="ml-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                        )}
                      </div>

                      {/* Task list */}
                      <ul className="mt-2 space-y-2">
                        {dayTasks.length === 0 ? (
                          <li className="text-[11px] text-gray-400">
                            No tasks
                          </li>
                        ) : (
                          dayTasks.map((t) => (
                            <li key={t.id}>
                              <button
                                onClick={() => openDetails(t)}
                                className={`w-full text-left rounded border p-2 sm:p-3 hover:opacity-95 ${getStatusChipClasses(
                                  t.status
                                )}`}
                                title={`${t.title}\nStatus: ${
                                  t.status || "-"
                                }\nPriority: ${t.priority ?? "-"}`}
                              >
                                <div className="flex items-start gap-2">
                                  {/* Status dot */}
                                  {/* <span
                                    className={`inline-block flex-shrink-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full mt-1 ${getStatusDotClasses(
                                      t.status
                                    )}`}
                                  /> */}

                                  {/* Task content */}
                                  <div className="flex-1 min-w-0">
                                    {/* Task title */}
                                    <div className="font-medium text-[12px] sm:text-[13px] truncate sm:whitespace-normal">
                                      {t.title}
                                    </div>

                                    {/* Description */}
                                    {t.description && (
                                      <div className="text-[11px] sm:text-[12px] text-gray-700 mt-0.5 line-clamp-2 sm:line-clamp-3">
                                        {t.description}
                                      </div>
                                    )}
                                  </div>

                                  {/* Priority badge */}
                                  {t.priority !== null &&
                                    t.priority !== undefined && (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] ${getPriorityBadgeClasses(
                                          t.priority
                                        )}`}
                                      >
                                        P{t.priority}
                                      </span>
                                    )}
                                </div>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <div className="mt-3 border border-gray-200 rounded-md p-3 bg-white">
                <div className="text-sm font-semibold text-gray-700 flex items-center">
                  {cursorDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {isSameDay(cursorDate, new Date()) && (
                    <span className="ml-2 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </div>

                <ul className="mt-2 space-y-2">
                  {(tasksByDay.get(startOfDay(cursorDate).getTime()) || [])
                    .length === 0 ? (
                    <li className="text-sm text-gray-500">
                      No tasks due today
                    </li>
                  ) : (
                    (
                      tasksByDay.get(startOfDay(cursorDate).getTime()) || []
                    ).map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => openDetails(t)}
                          className={`w-full text-left p-2 sm:p-3 border rounded-md hover:opacity-95 ${getStatusChipClasses(
                            t.status
                          )}`}
                          title={`${t.title}\nStatus: ${
                            t.status || "-"
                          }\nPriority: ${t.priority ?? "-"}`}
                        >
                          <div className="flex items-start gap-2">
                            {/* Status dot */}
                            {/* <span
                              className={`inline-block flex-shrink-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full mt-1 ${getStatusDotClasses(
                                t.status
                              )}`}
                            /> */}

                            {/* Task content */}
                            <div className="flex-1 min-w-0">
                              {/* Title */}
                              <div className="text-[13px] sm:text-[14px] font-medium truncate sm:whitespace-normal">
                                {t.title}
                              </div>

                              {/* Description */}
                              {t.description && (
                                <div className="text-[11px] sm:text-[12px] text-gray-700 mt-1 line-clamp-3 sm:line-clamp-4">
                                  {t.description}
                                </div>
                              )}
                            </div>

                            {/* Priority badge — same look as week view */}
                            {t.priority !== null &&
                              t.priority !== undefined && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] ${getPriorityBadgeClasses(
                                    t.priority
                                  )}`}
                                >
                                  P{t.priority}
                                </span>
                              )}
                          </div>

                          {/* Status text (desktop only) */}
                          <div className="hidden sm:flex justify-end mt-1 text-[11px] capitalize opacity-80">
                            {t.status}
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Ongoing
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Under
                Review
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Completed
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500" /> Unassigned
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
                  Low P1-3
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200">
                  Med P4-6
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                  High P7-10
                </span>
              </div>
            </div>

            {/* Details modal */}
            <TaskDetailsModal
              open={detailsOpen}
              task={selectedTask}
              onClose={closeDetails}
              memberNames={memberIdToName}
              projectNames={projectIdToTitle}
            />
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
