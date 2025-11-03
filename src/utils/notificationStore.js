// utils/notificationStore.js
"use client";

class NotificationStore {
  constructor() {
    this.listeners = new Set();
    this.unreadCount = 0;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setUnreadCount(count) {
    if (this.unreadCount !== count) {
      this.unreadCount = count;
      this.notifyListeners();
    }
  }

  getUnreadCount() {
    return this.unreadCount;
  }

  notifyListeners() {
    this.listeners.forEach((callback) => callback(this.unreadCount));
  }
}

export const notificationStore = new NotificationStore();
