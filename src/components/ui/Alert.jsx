"use client";

export default function Alert({ type = "info", children }) {
  const styles = {
    success: "bg-green-50 border border-green-200 text-green-700",
    error: "bg-red-50 border border-red-200 text-red-600",
    warning: "bg-yellow-50 border border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border border-blue-200 text-blue-700",
  };

  const classes = styles[type] || styles.info;

  return (
    <div className={`${classes} px-4 py-3 rounded`}>
      {children}
    </div>
  );
}


