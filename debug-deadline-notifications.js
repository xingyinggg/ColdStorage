// Debug script to test deadline notifications
// Run this in your browser console to debug the issue

const debugDeadlineNotifications = async () => {
  console.log("🔍 DEBUG: Starting deadline notification debugging...");

  // Get your auth token (adjust the key based on how you store it)
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token");

  if (!token) {
    console.error("❌ No auth token found. Please log in first.");
    console.log("💡 Try checking: localStorage, sessionStorage, or cookies");
    return;
  }

  console.log("✅ Found auth token");

  try {
    // 1. Check current date and task deadlines we're looking for
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    console.log("📅 Today:", today.toISOString().split("T")[0]);
    console.log(
      "📅 Tomorrow (1 day before):",
      tomorrow.toISOString().split("T")[0]
    );
    console.log("📅 Your task due date: 2025-10-22");
    console.log(
      "📅 Days until due:",
      Math.ceil((new Date("2025-10-22") - today) / (1000 * 60 * 60 * 24))
    );

    // 2. Force trigger deadline check
    console.log("🚀 Forcing deadline check...");
    const checkResponse = await fetch("/api/notifications/check-deadlines", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ force: true }),
    });

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.error(
        "❌ Deadline check failed:",
        checkResponse.status,
        errorText
      );
      console.log("💡 Check if your server is running and the endpoint exists");
      return;
    }

    const checkResult = await checkResponse.json();
    console.log(
      "✅ Deadline check result:",
      JSON.stringify(checkResult, null, 2)
    );

    // 3. Get all notifications
    console.log("📬 Fetching notifications...");
    const notifResponse = await fetch("/api/notifications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!notifResponse.ok) {
      const errorText = await notifResponse.text();
      console.error(
        "❌ Failed to fetch notifications:",
        notifResponse.status,
        errorText
      );
      return;
    }

    const notifications = await notifResponse.json();
    console.log("📋 All notifications:", notifications);

    // 4. Filter for deadline notifications
    const deadlineNotifs = notifications.filter(
      (n) =>
        n.type === "upcoming_deadline" ||
        n.notification_category === "deadline" ||
        n.title?.includes("days before") ||
        n.title?.includes("Overdue")
    );

    console.log("⏰ Deadline notifications found:", deadlineNotifs);

    // 5. Check notification structure
    if (notifications.length > 0) {
      console.log(
        "📝 Sample notification structure:",
        Object.keys(notifications[0])
      );
    }

    // 6. Check if notification number/count is working
    const unreadCount = notifications.filter((n) => !n.read).length;
    console.log("🔢 Unread notification count:", unreadCount);

    // 7. Summary
    console.log("\n📊 SUMMARY:");
    console.log(`- Total notifications: ${notifications.length}`);
    console.log(`- Unread notifications: ${unreadCount}`);
    console.log(`- Deadline notifications: ${deadlineNotifs.length}`);
    console.log(
      `- Check result: ${
        checkResult?.totalNotifications || 0
      } new notifications created`
    );

    if (deadlineNotifs.length === 0 && checkResult?.totalNotifications === 0) {
      console.log("\n🤔 POSSIBLE ISSUES TO CHECK:");
      console.log(
        "1. ❓ Is your task assigned to the correct user (assignee_id = your emp_id)?"
      );
      console.log('2. ❓ Is your task status NOT "completed"?');
      console.log('3. ❓ Does your task have exactly deadline "2025-10-22"?');
      console.log(
        "4. ❓ Are you logged in as the same user the task is assigned to?"
      );
      console.log("\n🔧 DEBUG QUERIES TO RUN IN SUPABASE:");
      console.log("-- Check your tasks:");
      console.log(
        "SELECT id, title, deadline, assignee_id, status FROM tasks WHERE deadline = '2025-10-22';"
      );
      console.log("\n-- Check your emp_id:");
      console.log(
        "SELECT emp_id FROM employees WHERE user_id = 'YOUR_USER_UUID';"
      );
      console.log("\n-- Check existing notifications:");
      console.log(
        "SELECT * FROM notifications WHERE type = 'upcoming_deadline' ORDER BY created_at DESC;"
      );
    }
  } catch (error) {
    console.error("❌ Debug failed:", error);
    console.log("💡 Make sure your server is running on the correct port");
  }
};

// Run the debug
debugDeadlineNotifications();
