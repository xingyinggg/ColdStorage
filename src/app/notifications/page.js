"use client";

import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import { useAuth } from "@/utils/hooks/useAuth";
import { useNotification } from "@/utils/hooks/useNotification";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotificationsPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const { notification, loading, error, refresh } = useNotification();

    // useEffect(() => {
    //     // Redirect to login if not authenticated
    //     if (!authLoading && !user) {
    //         router.push("/login");
    //     }
    // }, [user, authLoading, router]);

    // const handleLogout = async () => {
    //     await signOut();
    //     router.push("/login");
    // };

    // // Show loading state
    // if (authLoading) {
    //     return (
    //         <div className="min-h-screen flex items-center justify-center">
    //             <div className="text-lg">Loading...</div>
    //         </div>
    //     );
    // }


    return (
        <SidebarLayout>
            <div className="min-h-screen bg-gray-50">
                <HeaderBar />
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-xl font-semibold">Notifications</h1>
                            <button onClick={refresh} className="text-sm text-blue-600 hover:underline">
                                Refresh →
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
                                    <div className="absolute right-4 top-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pill(n.read)}`}>
                                            {n.read ? "Read" : "Unread"}
                                        </span>
                                    </div>

                                    <div className="font-semibold mb-1">{n.title}</div>
                                    <div className="text-sm text-gray-600">{n.message}</div>

                                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <span>📅</span>
                                            <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                        </div>
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


