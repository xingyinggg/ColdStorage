"use client";

import { useState, useEffect } from "react";

export default function RecurrenceHistoryModal({ 
  isOpen, 
  onClose, 
  taskId,
  taskTitle 
}) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchRecurrenceHistory();
    }
  }, [isOpen, taskId]);

  const fetchRecurrenceHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/tasks/${taskId}/recurrence-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch recurrence history");
      }

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error("Error fetching recurrence history:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: "bg-green-100 text-green-800 border-green-200",
      ongoing: "bg-blue-100 text-blue-800 border-blue-200",
      "under review": "bg-yellow-100 text-yellow-800 border-yellow-200",
      pending: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[status] || statusConfig.pending}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                🔄 Recurrence History
              </h2>
              <p className="text-sm text-gray-600 mt-1">{taskTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading history...</span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && history && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">
                      {history.totalInstances || 0}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">Total Instances</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {history.completedInstances || 0}
                    </div>
                    <div className="text-xs text-green-600 mt-1">Completed</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-700">
                      {history.pendingInstances || 0}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Pending</div>
                  </div>
                </div>

                {/* History List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Instance History</h3>
                  
                  {history.history && history.history.length > 0 ? (
                    <div className="space-y-2">
                      {history.history.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              #{item.instance_number}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-gray-900">
                                  Scheduled: {formatDate(item.scheduled_date)}
                                </span>
                                {getStatusBadge(item.status)}
                              </div>
                              {item.completed_date && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Completed: {formatDate(item.completed_date)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No history records found
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
