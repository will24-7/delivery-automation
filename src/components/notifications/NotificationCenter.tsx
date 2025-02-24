"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationService } from "../../services/notifications/NotificationService";
import { INotification } from "../../models/Notification";
import { useState } from "react";

const NotificationBadge = ({ type }: { type: INotification["type"] }) => {
  const colors = {
    critical: "badge-error",
    warning: "badge-warning",
    info: "badge-info",
  };

  return (
    <div className={`badge ${colors[type]} gap-2 text-xs font-medium`}>
      {type.toUpperCase()}
    </div>
  );
};

const NotificationItem = ({
  notification,
  onRead,
}: {
  notification: INotification;
  onRead: (id: string) => void;
}) => {
  return (
    <div className="flex items-start gap-4 p-4 bg-base-200 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <NotificationBadge type={notification.type} />
          <span className="text-xs text-base-content/70">
            {new Date(notification.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-base-content">{notification.message}</p>
      </div>
      {!notification.read && (
        <button
          onClick={() => onRead(notification._id.toString())}
          className="btn btn-ghost btn-xs"
        >
          Mark as read
        </button>
      )}
    </div>
  );
};

export default function NotificationCenter() {
  const [showAll, setShowAll] = useState(false);

  const { data: notifications = [], refetch } = useQuery<INotification[]>({
    queryKey: ["notifications"],
    queryFn: () =>
      showAll
        ? notificationService.getUnreadNotifications(50)
        : notificationService.getCriticalNotifications(10),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    refetch();
  };

  const criticalCount = notifications.filter(
    (n: INotification) => n.type === "critical" && !n.read
  ).length;
  const warningCount = notifications.filter(
    (n: INotification) => n.type === "warning" && !n.read
  ).length;

  return (
    <div className="flex flex-col gap-4 p-4 bg-base-100 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="badge badge-error gap-2">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="badge badge-warning gap-2">
              {warningCount} Warning
            </span>
          )}
          <button
            onClick={() => setShowAll(!showAll)}
            className="btn btn-ghost btn-sm"
          >
            {showAll ? "Show Critical Only" : "Show All"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {notifications.length === 0 ? (
          <div className="text-center text-base-content/70 py-8">
            No unread notifications
          </div>
        ) : (
          notifications.map((notification: INotification) => (
            <NotificationItem
              key={notification._id.toString()}
              notification={notification}
              onRead={handleMarkAsRead}
            />
          ))
        )}
      </div>
    </div>
  );
}
