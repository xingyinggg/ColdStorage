"use client";

/**
 * RecurrenceStatus Component
 * Displays recurrence information based on the end condition:
 * - Shows "X of Y" if count-based
 * - Shows end date if date-based
 * - Shows both if both conditions are set
 */
export default function RecurrenceStatus({ task, variant = "compact" }) {
  if (!task?.is_recurring) return null;

  const hasCountLimit = task.recurrence_max_count !== null && task.recurrence_max_count !== undefined;
  const hasEndDate = task.recurrence_end_date !== null && task.recurrence_end_date !== undefined;
  const currentCount = task.recurrence_count || 1;
  const maxCount = task.recurrence_max_count;

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Format pattern for display
  const formatPattern = (pattern) => {
    if (!pattern) return "recurring";
    const patterns = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'biweekly': 'Bi-weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'yearly': 'Yearly'
    };
    return patterns[pattern.toLowerCase()] || pattern;
  };

  // Compact variant (for TaskCard badge)
  if (variant === "compact") {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Recurring task">
        🔄 {formatPattern(task.recurrence_pattern)}
        {hasCountLimit && ` (${currentCount}/${maxCount})`}
      </div>
    );
  }

  // Detailed variant (for TaskDetailsModal)
  if (variant === "detailed") {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">🔄 Recurring Task</h4>
            
            {/* Pattern */}
            <div className="space-y-2 text-sm text-purple-700">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Pattern:</span>
                <span className="px-2 py-0.5 bg-purple-100 rounded text-purple-800 font-semibold">
                  {formatPattern(task.recurrence_pattern)}
                </span>
                {task.recurrence_interval && task.recurrence_interval > 1 && (
                  <span className="text-purple-600">
                    (Every {task.recurrence_interval} {task.recurrence_pattern === 'daily' ? 'days' : 
                      task.recurrence_pattern === 'weekly' ? 'weeks' : 
                      task.recurrence_pattern === 'monthly' ? 'months' : 'periods'})
                  </span>
                )}
              </div>

              {/* Weekday preference for weekly/biweekly */}
              {(task.recurrence_pattern === 'weekly' || task.recurrence_pattern === 'biweekly') && 
               task.recurrence_weekday !== null && task.recurrence_weekday !== undefined && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Day:</span>
                  <span className="text-purple-800 font-semibold">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][task.recurrence_weekday]}
                  </span>
                </div>
              )}

              {/* Count-based end condition */}
              {hasCountLimit && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Occurrences:</span>
                  <span className="px-2 py-0.5 bg-purple-100 rounded text-purple-800 font-bold">
                    {currentCount} of {maxCount}
                  </span>
                  {currentCount < maxCount && (
                    <span className="text-purple-600">
                      ({maxCount - currentCount} remaining)
                    </span>
                  )}
                  {currentCount >= maxCount && (
                    <span className="text-purple-600 font-semibold">
                      (Final occurrence)
                    </span>
                  )}
                </div>
              )}

              {/* Date-based end condition */}
              {hasEndDate && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Ends by:</span>
                  <span className="px-2 py-0.5 bg-purple-100 rounded text-purple-800 font-semibold">
                    {formatDate(task.recurrence_end_date)}
                  </span>
                </div>
              )}

              {/* If no end condition */}
              {!hasCountLimit && !hasEndDate && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">End condition:</span>
                  <span className="text-purple-600 italic">
                    Continues indefinitely
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (for task lists)
  return (
    <div className="flex items-center space-x-2 text-xs text-purple-700">
      <span className="font-medium">🔄 {formatPattern(task.recurrence_pattern)}</span>
      {hasCountLimit && (
        <span className="px-1.5 py-0.5 bg-purple-100 rounded font-semibold">
          {currentCount}/{maxCount}
        </span>
      )}
      {hasEndDate && (
        <span className="text-purple-600">
          until {formatDate(task.recurrence_end_date)}
        </span>
      )}
    </div>
  );
}
