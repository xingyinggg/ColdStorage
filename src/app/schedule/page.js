"use client";

import { useMemo, useState, useEffect } from "react";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useUsers } from "@/utils/hooks/useUsers";
import TaskDetailsModal from "@/components/tasks/TaskDetailsModal";
import { useAuth } from "@/utils/hooks/useAuth";

// Utilities for calendar calculations
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const getMonthGrid = (cursor) => {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekDay = firstOfMonth.getDay(); // 0=Sun
  const gridStart = addDays(firstOfMonth, -startWeekDay);
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  return cells;
};

const getWeekGrid = (cursor) => {
  const start = addDays(cursor, -cursor.getDay());
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};

export default function SchedulePage() {
  const [view, setView] = useState("month"); // month | week | day
  const [cursorDate, setCursorDate] = useState(() => startOfDay(new Date()));
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const { tasks, loading: tasksLoading, error: tasksError, fetchTasks } = useTasks();
  const { projects, loading: projectsLoading } = useProjects();
  const { users, fetchUsers } = useUsers();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const { isStaff, userProfile, loading: authLoading } = useAuth();

  // Load users for assignee filter only if not staff
  useEffect(() => {
    if (!isStaff) {
      fetchUsers({});
    }
  }, [fetchUsers, isStaff]);

  // For staff, auto-filter to self and hide the assignee filter
  useEffect(() => {
    const empId = userProfile?.emp_id;
    if (isStaff && empId) {
      setAssigneeFilter(String(empId));
    }
  }, [isStaff, userProfile?.emp_id]);

  // Build maps for quick lookups
  const projectIdToTitle = useMemo(() => {
    const map = {};
    (projects || []).forEach((p) => {
      map[p.id] = p.title;
    });
    return map;
  }, [projects]);

  const memberIdToName = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => {
      const id = u.emp_id || u.id;
      if (id) map[id] = u.name || u.email || String(id);
    });
    return map;
  }, [users]);

  // Normalize and filter tasks: must have due_date
  const schedulableTasks = useMemo(() => {
    return (tasks || [])
      .filter((t) => !!t.due_date)
      .filter((t) => (projectFilter ? String(t.project_id || "") === String(projectFilter) : true))
      .filter((t) => (statusFilter ? String(t.status || "") === String(statusFilter) : true))
      .filter((t) => {
        if (!assigneeFilter) return true;
        // Owner or collaborators or assignees
        if (String(t.owner_id || "") === String(assigneeFilter)) return true;
        if (Array.isArray(t.collaborators) && t.collaborators.map(String).includes(String(assigneeFilter))) return true;
        if (Array.isArray(t.assignees)) {
          const ids = t.assignees.map((u) => String(u?.emp_id || u?.id || "")).filter(Boolean);
          if (ids.includes(String(assigneeFilter))) return true;
        }
        return false;
      })
      .map((t) => ({
        ...t,
        due: startOfDay(new Date(t.due_date)),
      }));
  }, [tasks, projectFilter, statusFilter, assigneeFilter]);

  const daysGrid = useMemo(() => {
    if (view === "day") return [cursorDate];
    if (view === "week") return getWeekGrid(cursorDate);
    return getMonthGrid(cursorDate);
  }, [view, cursorDate]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    daysGrid.forEach((d) => map.set(startOfDay(d).getTime(), []));
    schedulableTasks.forEach((t) => {
      const key = startOfDay(t.due).getTime();
      if (map.has(key)) map.get(key).push(t);
    });
    return map;
  }, [daysGrid, schedulableTasks]);

  const goPrev = () => {
    if (view === "day") setCursorDate(addDays(cursorDate, -1));
    else if (view === "week") setCursorDate(addDays(cursorDate, -7));
    else setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "day") setCursorDate(addDays(cursorDate, 1));
    else if (view === "week") setCursorDate(addDays(cursorDate, 7));
    else setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1));
  };
  const goToday = () => setCursorDate(startOfDay(new Date()));

  const headerLabel = useMemo(() => {
    if (view === "day") return cursorDate.toLocaleDateString();
    if (view === "week") {
      const start = getWeekGrid(cursorDate)[0];
      const end = addDays(start, 6);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return cursorDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [view, cursorDate]);

  // Status options from existing usage in forms/modals
  const statusOptions = ["ongoing", "under review", "completed", "unassigned"];

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
    const code = title.replace(/[^A-Za-z0-9]+/g, "").slice(0, 3).toUpperCase();
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

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-lg sm:text-xl font-semibold">Schedule</h1>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                    <button className={`px-3 py-1 text-sm ${view === "day" ? "bg-gray-900 text-white" : "bg-white"}`} onClick={() => setView("day")}>Day</button>
                    <button className={`px-3 py-1 text-sm ${view === "week" ? "bg-gray-900 text-white" : "bg-white"}`} onClick={() => setView("week")}>Week</button>
                    <button className={`px-3 py-1 text-sm ${view === "month" ? "bg-gray-900 text-white" : "bg-white"}`} onClick={() => setView("month")}>Month</button>
                  </div>
                  <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                    <button className="px-3 py-1 text-sm" onClick={goPrev} aria-label="Previous">◀</button>
                    <button className="px-3 py-1 text-sm" onClick={goToday}>Today</button>
                    <button className="px-3 py-1 text-sm" onClick={goNext} aria-label="Next">▶</button>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className={`mt-4 grid grid-cols-1 ${isStaff ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-3`}>
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="">All projects</option>
                  {(projects || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {!isStaff && (
                  <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">All assignees</option>
                    {(users || []).map((u) => (
                      <option key={u.emp_id || u.id} value={u.emp_id || u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Calendar header */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">{headerLabel}</div>
                {(tasksLoading || projectsLoading) && (
                  <div className="text-xs text-gray-500">Loading…</div>
                )}
                {tasksError && (
                  <div className="text-xs text-red-600">{tasksError}</div>
                )}
              </div>

              {/* Calendar grid */}
              {view === "month" && (
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <div key={d} className="text-xs font-semibold text-gray-600 px-2">{d}</div>
                  ))}
                  {daysGrid.map((day, idx) => {
                    const dayTasks = tasksByDay.get(startOfDay(day).getTime()) || [];
                    const isCurrentMonth = day.getMonth() === cursorDate.getMonth();
                    const isTodayCell = isSameDay(day, new Date());
                    return (
                      <div key={idx} className={`border border-gray-200 rounded-md p-2 min-h-[110px] relative ${isCurrentMonth ? "bg-white" : "bg-gray-50"} ${isTodayCell ? "ring-2 ring-red-300" : ""}`}>
                        <div className="text-[11px] font-medium text-gray-700 flex items-center">
                          {day.getDate()}
                          {isTodayCell && <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayTasks.length === 0 ? (
                            <div className="text-[11px] text-gray-400">No tasks</div>
                          ) : (
                            dayTasks.slice(0, 5).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => openDetails(t)}
                                className={`w-full text-left text-[11px] px-2 py-1 rounded border truncate hover:opacity-95 ${getStatusChipClasses(t.status)}`}
                                title={`${t.title}\nProject: ${projectIdToTitle[t.project_id] || "No project"}\nStatus: ${t.status || "-"}\nPriority: ${t.priority ?? "-"}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center min-w-0">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusDotClasses(t.status)}`} />
                                    <span className="truncate">{t.title}</span>
                                  </div>
                                  {t.priority !== null && t.priority !== undefined && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${getPriorityBadgeClasses(t.priority)}`}>P{t.priority}</span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                          {dayTasks.length > 5 && (
                            <div className="text-[11px] text-gray-500">+{dayTasks.length - 5} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "week" && (
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {daysGrid.map((day, idx) => {
                    const dayTasks = tasksByDay.get(startOfDay(day).getTime()) || [];
                    const isTodayCell = isSameDay(day, new Date());
                    return (
                      <div key={idx} className={`border border-gray-200 rounded-md p-2 bg-white ${isTodayCell ? "ring-2 ring-red-300" : ""}`}>
                        <div className="text-xs font-semibold text-gray-700 flex items-center">
                          {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          {isTodayCell && <span className="ml-2 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {dayTasks.length === 0 ? (
                            <li className="text-[11px] text-gray-400">No tasks</li>
                          ) : (
                            dayTasks.map((t) => (
                              <li key={t.id}>
                                <button
                                  onClick={() => openDetails(t)}
                                  className={`w-full text-left rounded border px-2 py-1 hover:opacity-95 ${getStatusChipClasses(t.status)}`}
                                  title={`${t.title}\nProject: ${projectIdToTitle[t.project_id] || "No project"}\nStatus: ${t.status || "-"}\nPriority: ${t.priority ?? "-"}`}
                                >
                                  <div className="flex items-center">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusDotClasses(t.status)}`} />
                                    <span className="font-medium truncate mr-2">{t.title}</span>
                                    <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-gray-50 text-gray-700 border-gray-200">{getProjectCode(t.project_id)}</span>
                                      {t.priority !== null && t.priority !== undefined && (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${getPriorityBadgeClasses(t.priority)}`}>P{t.priority}</span>
                                      )}
                                    </span>
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
                    {cursorDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {isSameDay(cursorDate, new Date()) && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full" />}
                  </div>
                  <ul className="mt-2 space-y-2">
                    {(tasksByDay.get(startOfDay(cursorDate).getTime()) || []).length === 0 ? (
                      <li className="text-sm text-gray-500">No tasks due today</li>
                    ) : (
                      (tasksByDay.get(startOfDay(cursorDate).getTime()) || []).map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={() => openDetails(t)}
                            className={`w-full text-left p-2 border rounded-md hover:opacity-95 ${getStatusChipClasses(t.status)}`}
                            title={`${t.title}\nProject: ${projectIdToTitle[t.project_id] || "No project"}\nStatus: ${t.status || "-"}\nPriority: ${t.priority ?? "-"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center">
                                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusDotClasses(t.status)}`} />
                                  <span className="text-sm font-medium truncate">{t.title}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-current/80 flex items-center gap-2">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-white/60">{projectIdToTitle[t.project_id] || "No project"}</span>
                                  {t.priority !== null && t.priority !== undefined && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${getPriorityBadgeClasses(t.priority)}`}>Priority {t.priority}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] opacity-80 capitalize hidden sm:inline">{t.status}</span>
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
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Ongoing</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Under Review</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> Unassigned</div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">Low P1-3</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200">Med P4-6</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">High P7-10</span>
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
      </div>
    </SidebarLayout>
  );
}