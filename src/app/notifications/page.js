"use client";

import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import { useAuth } from "@/utils/hooks/useAuth";
import { useNotification } from "@/utils/hooks/useNotification";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotificationPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const { notification = [], loading, error, refresh } = useNotification();

    const pill = (read) =>
        read
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800";

    return (
        <SidebarLayout>
            <div className="min-h-screen bg-gray-50">
                <HeaderBar />
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-xl font-semibold">Notifications</h1>
                            <button onClick={refresh} className="text-sm text-blue-600 hover:underline">
                                <u>Refresh</u>
                            </button>
                        </div>

                        {loading && (
                            <div className="bg-white shadow rounded-lg p-6">Loading...</div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
                                {error}
                            </div>
                        )}

                        {!loading && !error && notification.length === 0 && (
                            <div className="bg-white shadow rounded-lg p-6 text-gray-600">
                                No notifications yet.
                            </div>
                        )}

                        <div className="space-y-5">
                            {notification.map((n) => (
                                <div key={n.id} className="relative bg-white border rounded-xl p-5 shadow-sm">
                                    <div className="font-semibold mb-1">{n.title}</div>
                                    <div className="text-sm text-gray-600 mb-2">{n.description}</div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-medium">
                                            {n.type}
                                        </span>
                                        <span> 📅 Received on: {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {new Date(n.created_at).toLocaleDateString()}  </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}


