// Test script to demonstrate the new deadline notification system
// You can run this in your browser console or as a Node.js script

const testDeadlineNotifications = async () => {
  const baseUrl = "http://localhost:3001"; // Adjust port as needed
  const token = "your-auth-token-here"; // Replace with actual token

  try {
    // 1. Trigger deadline check manually
    console.log("🔄 Triggering deadline check...");
    const checkResponse = await fetch(
      `${baseUrl}/api/notifications/check-deadlines`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ force: true }),
      }
    );

    const checkResult = await checkResponse.json();
    console.log("📋 Deadline check result:", checkResult);

    // 2. Get current notifications
    console.log("📬 Fetching notifications...");
    const notifResponse = await fetch(`${baseUrl}/api/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const notifications = await notifResponse.json();
    console.log("🔔 Current notifications:", notifications);

    // 3. Filter deadline notifications
    const deadlineNotifications = notifications.filter(
      (n) =>
        n.type === "upcoming_deadline" || n.notification_category === "deadline"
    );
    console.log("⏰ Deadline notifications:", deadlineNotifications);

    // 4. Get service status
    console.log("📊 Getting service status...");
    const statusResponse = await fetch(
      `${baseUrl}/api/notifications/deadline-status`
    );
    const status = await statusResponse.json();
    console.log("🔧 Service status:", status);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
};

// Run the test
testDeadlineNotifications();
