"use client";

export function Badge({ color = "gray", variant = "soft", bordered = false, children }) {
  const colorMap = {
    red: {
      soft: "bg-red-100 text-red-800",
      solid: "bg-red-600 text-white",
      border: "border-red-200",
    },
    green: {
      soft: "bg-green-100 text-green-800",
      solid: "bg-green-600 text-white",
      border: "border-green-200",
    },
    yellow: {
      soft: "bg-yellow-100 text-yellow-800",
      solid: "bg-yellow-500 text-white",
      border: "border-yellow-200",
    },
    blue: {
      soft: "bg-blue-100 text-blue-800",
      solid: "bg-blue-600 text-white",
      border: "border-blue-200",
    },
    purple: {
      soft: "bg-purple-100 text-purple-800",
      solid: "bg-purple-600 text-white",
      border: "border-purple-200",
    },
    gray: {
      soft: "bg-gray-100 text-gray-800",
      solid: "bg-gray-600 text-white",
      border: "border-gray-200",
    },
  };

  const chosen = colorMap[color] || colorMap.gray;
  const base = variant === "solid" ? chosen.solid : chosen.soft;
  const border = bordered ? `border ${chosen.border}` : "";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${base} ${border}`}>
      {children}
    </span>
  );
}


