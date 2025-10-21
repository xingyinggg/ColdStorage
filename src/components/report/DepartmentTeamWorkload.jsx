"use client";

export default function TeamWorkloadReportContent({ teamWorkload = {}, departmentTeams = [] }) {
  const entries = Object.entries(teamWorkload);
  if (entries.length === 0) {
    return <div className="text-gray-500 text-center py-8 text-base">No team members found</div>;
  }

  // Summary
  const totalMembers = entries.length;
  const totalTasks   = entries.reduce((s, [, m]) => s + (m.total_tasks || 0), 0);
  const totalOverdue = entries.reduce((s, [, m]) => s + (m.overdue_count || 0), 0);
  const totalSoon    = entries.reduce((s, [, m]) => s + (m.due_soon_count || 0), 0);

  const level = (n) => (n >= 15 ? "high" : n >= 8 ? "medium" : "low");

  return (
    <div className="space-y-6">
      {/* Title */}
      <h4 className="text-xl font-semibold text-gray-900">Team Workload Overview</h4>

      {/* Team names (if any) */}
      {departmentTeams.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h5 className="text-lg font-medium text-gray-900 mb-2">Team Name:</h5>
          <div className="text-base text-gray-700 space-y-1">
            {departmentTeams.map((t) => (
              <div key={t.id}>• {t.team_name}</div>
            ))}
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-sm text-gray-500">Team Members</p>
          <p className="text-3xl font-bold text-gray-800">{totalMembers}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm text-green-900">Total Tasks</p>
          <p className="text-3xl font-bold text-green-700">{totalTasks}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-sm text-yellow-900">Due Soon (≤3 days)</p>
          <p className="text-3xl font-bold text-yellow-700">{totalSoon}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-sm text-red-900">Overdue</p>
          <p className="text-3xl font-bold text-red-700">{totalOverdue}</p>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white shadow rounded-lg p-6">
        <h5 className="text-lg font-medium text-gray-900 mb-4">Member Workload</h5>
        <div className="space-y-4">
          {entries.map(([empId, m]) => {
            const info = m.member_info || {};
            const lvl  = level(m.total_tasks || 0);

            return (
              <div key={empId} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-semibold">
                        {info?.name?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-base font-medium text-gray-900">
                        {info?.name || `Employee ${empId}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {info?.department || "Unknown"} • {info?.role || "Unknown"}
                      </p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-semibold
                    ${lvl === "high" ? "bg-red-100 text-red-800" :
                      lvl === "medium" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"}`}>
                    {lvl.toUpperCase()} LOAD
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-600">Total Tasks:</span> <span className="font-medium">{m.total_tasks}</span></div>
                  <div><span className="text-gray-600">Owned:</span> <span className="font-medium">{m.owned_tasks?.length || 0}</span></div>
                  <div><span className="text-gray-600">Collaborating:</span> <span className="font-medium">{m.collaboration_tasks?.length || 0}</span></div>
                  <div><span className="text-gray-600">Due Soon:</span> <span className="font-medium text-yellow-700">{m.due_soon_count}</span></div>
                </div>

                {/* Overdue alert */}
                {m.overdue_count > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <span className="text-red-700 font-medium">⚠ {m.overdue_count} overdue task{m.overdue_count > 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Status breakdown */}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                  <span>Under Review: <span className="font-medium">{m.task_status_breakdown?.["under review"] ?? 0}</span></span>
                  <span>Ongoing: <span className="font-medium">{m.task_status_breakdown?.ongoing ?? 0}</span></span>
                  <span>Completed: <span className="font-medium">{m.task_status_breakdown?.completed ?? 0}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
