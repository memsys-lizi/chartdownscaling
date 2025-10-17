/**
 * 日志管理Hook
 */
import { useState, useEffect } from 'react';
import { logger } from '../services/logger';
import type { LogMessage } from '../types';

export function useLogs() {
  const [logs, setLogs] = useState<LogMessage[]>([]);

  useEffect(() => {
    // 订阅日志更新
    const unsubscribe = logger.subscribe((log) => {
      setLogs((prev) => [...prev, log]);
    });

    // 清理
    return () => {
      unsubscribe();
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  return {
    logs,
    clearLogs,
  };
}

