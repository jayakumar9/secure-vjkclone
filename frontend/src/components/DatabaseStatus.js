import React, { useState, useEffect } from 'react';

const DatabaseStatus = () => {
  const [status, setStatus] = useState({
    isConnected: false,
    host: '',
    lastChecked: null
  });

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setStatus({
        isConnected: data.database.status === 'Connected',
        host: data.database.host,
        lastChecked: new Date(data.timestamp)
      });
    } catch (error) {
      console.error('Health check error:', error);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastChecked: new Date()
      }));
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg ${
      status.isConnected ? 'bg-green-100' : 'bg-red-100'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          status.isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <span className="text-sm font-medium">
          Database: {status.isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {status.host && (
        <div className="text-xs text-gray-600 mt-1">
          Host: {status.host}
        </div>
      )}
      {status.lastChecked && (
        <div className="text-xs text-gray-500 mt-1">
          Last checked: {status.lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default DatabaseStatus; 