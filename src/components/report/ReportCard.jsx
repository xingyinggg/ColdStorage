"use client";

export default function ReportCard({
  title,
  description,
  details,
  buttonText = "Generate Report",
  buttonColor = "bg-blue-600 hover:bg-blue-700",
  onClick,
  disabled = false,
  loading = false
}) {
  return (
    <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-grow">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
          {details && (
            <div className="mt-2 text-xs text-gray-500">{details}</div>
          )}
        </div>
        
        <button
          onClick={onClick}
          className={`px-4 py-2 rounded-lg transition-colors ml-4 ${
            !disabled && !loading
              ? `${buttonColor} text-white`
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          disabled={disabled || loading}
        >
          {loading ? 'Loading...' : buttonText}
        </button>
      </div>
    </div>
  );
}