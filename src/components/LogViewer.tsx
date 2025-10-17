/**
 * 日志查看器组件
 * 显示处理过程中的日志信息，自动滚动到底部
 */
import { useEffect, useRef } from 'react';
import type { LogMessage } from '../types';

interface LogViewerProps {
  logs: LogMessage[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (type: LogMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return '>';
    }
  };

  return (
    <div className="log-viewer">
      <div className="log-header">━━━━━━━ 处理日志 ━━━━━━━</div>
      <div className="log-content" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="log-empty">暂无日志。上传文件以开始。</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-line log-${log.type}`}>
              <span className="log-icon">{getLogIcon(log.type)}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

