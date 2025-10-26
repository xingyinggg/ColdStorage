"use client";

import { Badge } from "@/components/ui/Badge";

export default function HeaderBar({ title, user, userProfile, roleLabel, roleColor = "gray", onLogout }) {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {userProfile?.name || user?.email}</span>
            <Badge color={roleColor}>{roleLabel}</Badge>
            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


