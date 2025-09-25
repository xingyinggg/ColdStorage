"use client";

export function Th({ children, align = "left" }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider ${align === "center" ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left" }) {
  return (
    <td
      className={`px-4 py-2 whitespace-nowrap text-sm text-gray-700 ${align === "center" ? "text-center" : "text-left"}`}
    >
      {children}
    </td>
  );
}


