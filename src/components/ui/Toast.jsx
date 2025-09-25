"use client";

export default function Toast({ type = "info", message = "", onClose }) {
  if (!message) return null;

  const styles = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    warning: "bg-yellow-600",
  };

  const bg = styles[type] || styles.info;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`${bg} text-white shadow-lg rounded px-4 py-3 text-sm flex items-center gap-3`}> 
        <span>{message}</span>
        {onClose && (
          <button
            aria-label="Close"
            onClick={onClose}
            className="ml-2 text-white/80 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}


