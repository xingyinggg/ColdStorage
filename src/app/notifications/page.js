"use client";

import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import { useAuth } from "@/utils/hooks/useAuth";
import { useNotification } from "@/utils/hooks/useNotification";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import TaskDetailsModal from "@/components/tasks/TaskDetailsModal";

export default function NotificationPage() {
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();
  const {
    notification = [],
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    unreadCount,
  } = useNotification();

  const [filter, setFilter] = useState("all"); // all, unread, read
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const result = await markAsRead(notificationId);
      if (!result.success) {
        console.error("Failed to mark notification as read:", result.error);
      } else {
        console.log(
          `✅ Successfully marked notification ${notificationId} as read`
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllAsRead();
      if (!result.success) {
        console.error(
          "Failed to mark all notifications as read:",
          result.error
        );
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleNotificationClick = async (n) => {
    if (!n?.task_id) {
      console.log("Notification has no task_id to open");
      return;
    }

    // Mark as read immediately (optimistic) so UX reflects the click right away
    try {
      // fire-and-forget; errors are handled inside the hook
      markAsRead(n.id).catch((err) => console.warn('markAsRead failed (optimistic):', err));
    } catch (e) {
      // ignore
    }

    try {
      setLoadingTask(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/tasks/${n.task_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }

      const body = await res.json();
      // Compose selectedTask including helper maps
      const composedTask = { ...(body.task || {}) };
      composedTask.memberNames = body.memberNames || {};
      composedTask.projectNames = body.projectNames || {};
      composedTask.subtasks = body.subtasks || [];

      setSelectedTask(composedTask);
      setTaskModalOpen(true);
    } catch (err) {
      console.error("Failed to load task for notification:", err);
    } finally {
      setLoadingTask(false);
    }
  };

  // Filter notifications based on selected filter
  const filteredNotifications = notification.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case "Shared Task":
        return "👥";
      case "Task Assignment Confirmation":
        return "✅";
      case "Task Creation":
        return "📝";
      case "Project Update":
        return "🚀";
      case "Upcoming Deadline":
        return "⏱️";
      case "Deadline Missed":
        return "❗";
      default:
        return "📬";
    }
  };

  const getTypeColor = (type, isRead) => {
    const baseColors = {
      "Task Assignment": isRead
        ? "bg-blue-50 text-blue-600 border-blue-200"
        : "bg-blue-100 text-blue-700 border-blue-300",
      "Task Assignment Confirmation": isRead
        ? "bg-green-50 text-green-600 border-green-200"
        : "bg-green-100 text-green-700 border-green-300",
      "Task Creation": isRead
        ? "bg-purple-50 text-purple-600 border-purple-200"
        : "bg-purple-100 text-purple-700 border-purple-300",
      "Shared Task": isRead
        ? "bg-indigo-50 text-indigo-600 border-indigo-200"
        : "bg-indigo-100 text-indigo-700 border-indigo-300",
      "Project Update": isRead
        ? "bg-orange-50 text-orange-600 border-orange-200"
        : "bg-orange-100 text-orange-700 border-orange-300",
      System: isRead
        ? "bg-gray-50 text-gray-600 border-gray-200"
        : "bg-gray-100 text-gray-700 border-gray-300",
    };
    return (
      baseColors[type] ||
      (isRead
        ? "bg-gray-50 text-gray-600 border-gray-200"
        : "bg-gray-100 text-gray-700 border-gray-300")
    );
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <SidebarLayout>
      <div className="bg-gray-50 min-h-screen">
        <HeaderBar
          title={
            <>
              <div className="flex items-center space-x-3">
                <span>Notifications</span>
                {/* <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Logout
              </button> */}
              </div>
            </>
          }
          user={user}
          userProfile={userProfile}
          roleLabel={userProfile?.role || "User"}
          roleColor="gray"
          onLogout={handleLogout}
        />

        {/* Main Content with padding */}
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-full bg-blue-100 mr-3 sm:mr-4">
                  <span className="text-lg sm:text-xl">📬</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Total
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {notification.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-full bg-red-100 mr-3 sm:mr-4">
                  <span className="text-lg sm:text-xl">🔴</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Unread
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">
                    {unreadCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-full bg-green-100 mr-3 sm:mr-4">
                  <span className="text-lg sm:text-xl">✅</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Read
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">
                    {notification.length - unreadCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-lg shadow">
            {/* Card Header with Controls */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <div className="flex flex-col gap-4">
                {/* Title and Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg font-medium text-gray-900">
                    All Notifications
                  </h2>

                  {/* Right side controls - Filter Buttons + Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Filter Buttons */}
                    <div className="flex border border-gray-300 rounded-md overflow-hidden">
                      {[
                        {
                          key: "all",
                          label: "All",
                          count: notification.length,
                        },
                        { key: "unread", label: "Unread", count: unreadCount },
                        {
                          key: "read",
                          label: "Read",
                          count: notification.length - unreadCount,
                        },
                      ].map((tab, index, array) => (
                        <button
                          key={tab.key}
                          onClick={() => setFilter(tab.key)}
                          className={`px-3 py-2 text-xs sm:text-sm font-medium flex-1 sm:flex-none ${filter === tab.key
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                            } ${index !== array.length - 1
                              ? "border-r border-gray-300"
                              : ""
                            }`}
                        >
                          <span className="hidden sm:inline">
                            {tab.label} ({tab.count})
                          </span>
                          <span className="sm:hidden">{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                        >
                          <span className="hidden sm:inline">
                            Mark all as read
                          </span>
                          <span className="sm:hidden">Mark all</span>
                        </button>
                      )}

                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-indigo-700 text-xs sm:text-sm font-medium flex-1 sm:flex-none ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                      >
                        {isRefreshing ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4 sm:p-6">
              {/* Loading State */}
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3"></div>
                    <span className="text-gray-600 text-sm sm:text-base">
                      Loading notifications...
                    </span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-red-400">⚠️</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Error loading notifications
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty States */}
              {!loading && !error && filteredNotifications.length === 0 && (
                <div className="text-center py-8 sm:py-12">
                  <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-xl sm:text-2xl">
                      {filter === "unread"
                        ? "🎉"
                        : filter === "read"
                          ? "📭"
                          : "📬"}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    {filter === "unread"
                      ? "All caught up!"
                      : filter === "read"
                        ? "No read notifications"
                        : "No notifications yet"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter === "unread"
                      ? "You have no unread notifications."
                      : filter === "read"
                        ? "No notifications have been read yet."
                        : "New notifications will appear here."}
                  </p>
                </div>
              )}

              {/* Notifications List */}
              {!loading && !error && filteredNotifications.length > 0 && (
                <div className="space-y-3">
                  {filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(n); }}
                      className={`cursor-pointer border rounded-lg p-3 sm:p-4 transition-all duration-200 ${n.read
                        ? "border-gray-200 bg-white hover:bg-gray-50"
                        : "border-l-4 border-l-indigo-500 border-gray-200 bg-indigo-50/50 hover:bg-indigo-50"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div
                            className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${n.read ? "bg-gray-100" : "bg-indigo-100"
                              }`}
                          >
                            <span className="text-sm sm:text-lg">
                              {getNotificationIcon(n.type)}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`font-medium text-sm sm:text-base truncate ${n.read ? "text-gray-700" : "text-gray-900"
                                  }`}
                              >
                                {n.title}
                              </h3>
                              {!n.read && (
                                <span className="inline-flex items-center justify-center w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>

                            <p
                              className={`text-xs sm:text-sm mb-2 ${n.read ? "text-gray-500" : "text-gray-700"
                                }`}
                            >
                              {n.description}
                            </p>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <span
                                className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium border w-fit ${getTypeColor(
                                  n.type,
                                  n.read
                                )}`}
                              >
                                {n.type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(n.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions - Always visible */}
                        <div className="flex-shrink-0">
                          {!n.read ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(n.id);
                              }}
                              className="bg-indigo-600 text-white px-2 sm:px-3 py-1 rounded-md hover:bg-indigo-700 text-xs font-medium"
                            >
                              <span className="hidden sm:inline">
                                Mark as read
                              </span>
                              <span className="sm:hidden">Read</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              <span className="hidden sm:inline">Read</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task details modal - opens when user clicks a notification with a task_id */}
      {selectedTask && (
        <TaskDetailsModal
          open={taskModalOpen}
          task={selectedTask}
          memberNames={selectedTask.memberNames || {}}
          projectNames={selectedTask.projectNames || {}}
          subtasks={selectedTask.subtasks || []}
          loadingSubtasks={loadingTask}
          onClose={() => { setTaskModalOpen(false); setSelectedTask(null); }}
        />
      )}

    </SidebarLayout>
  );
}
