import React, { useEffect, useState } from 'react';
import { useDeadlineNotifications } from '../utils/hooks/useDeadlineNotifications';

/**
 * Development component for manually managing deadline notifications
 * Shows current status and allows manual triggering of deadline checks
 */
const DeadlineNotificationManager = () => {
  const {
    loading,
    status,
    lastResult,
    triggerDeadlineCheck,
    getDeadlineStatus,
    isReadyForCheck,
  } = useDeadlineNotifications();

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Load initial status
    getDeadlineStatus().catch(console.error);
  }, []);

  const handleTriggerCheck = async (force = false) => {
    try {
      await triggerDeadlineCheck(force);
      // Refresh status after check
      await getDeadlineStatus();
    } catch (error) {
      console.error('Failed to trigger deadline check:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "immediately") return dateString;
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-blue-800">
            Deadline Notifications (Dev Mode)
          </h3>
          <p className="text-xs text-blue-600">
            {status?.lastCheck 
              ? `Last check: ${formatDate(status.lastCheck)}`
              : 'No checks performed yet'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleTriggerCheck(false)}
            disabled={loading || !isReadyForCheck()}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Check Deadlines'}
          </button>
          
          <button
            onClick={() => handleTriggerCheck(true)}
            disabled={loading}
            className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Force Check
          </button>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {!isReadyForCheck() && status && (
        <div className="mt-2 text-xs text-amber-600">
          Next check available: {formatDate(status.nextCheckAvailable)}
        </div>
      )}

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>Status:</strong>
              <pre className="mt-1 bg-blue-100 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(status, null, 2)}
              </pre>
            </div>
            
            {lastResult && (
              <div>
                <strong>Last Result:</strong>
                <pre className="mt-1 bg-blue-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlineNotificationManager;