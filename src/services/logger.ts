/**
 * 日志管理服务
 * 使用订阅模式，允许UI组件监听日志更新
 */
import type { LogMessage } from '../types';

type LogCallback = (log: LogMessage) => void;

class Logger {
  private subscribers: LogCallback[] = [];

  /**
   * 订阅日志更新
   */
  subscribe(callback: LogCallback): () => void {
    this.subscribers.push(callback);
    // 返回取消订阅函数
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /**
   * 发送日志消息
   */
  private log(message: string, type: LogMessage['type']): void {
    const logMessage: LogMessage = {
      id: Date.now().toString() + Math.random(),
      message,
      type,
      timestamp: new Date(),
    };

    this.subscribers.forEach((callback) => callback(logMessage));
  }

  /**
   * 信息日志
   */
  info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * 成功日志
   */
  success(message: string): void {
    this.log(message, 'success');
  }

  /**
   * 警告日志
   */
  warning(message: string): void {
    this.log(message, 'warning');
  }

  /**
   * 错误日志
   */
  error(message: string): void {
    this.log(message, 'error');
  }

  /**
   * 清空日志（清空订阅者）
   */
  clear(): void {
    // 不实际清空，只是通知UI（如果需要可以扩展）
  }
}

// 导出单例
export const logger = new Logger();

