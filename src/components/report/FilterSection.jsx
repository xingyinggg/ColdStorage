"use client";

export default function FilterSection({
  title,
  filterLabel,
  filterValue,
  onFilterChange,
  options,
  disabled = false,
  bgColor = "bg-gray-50",
  titleColor = "text-gray-900",
  labelColor = "text-gray-600"
}) {
  return (
    <div className={`${bgColor} p-4 rounded-lg`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-medium ${titleColor}`}>{title}</h3>
        <div className="flex items-center space-x-2">
          <label className={`text-sm ${labelColor}`}>
            {filterLabel}:
          </label>
          <select
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={disabled}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}