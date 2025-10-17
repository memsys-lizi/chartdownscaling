// 基础类型定义
export interface AdofaiFile {
  path: string;
  content: string;
  selected: boolean;
}

export interface ProcessedFile {
  path: string;
  content: string;
}

export interface ImageFile {
  path: string;
  data: ArrayBuffer;
}

export interface ProcessOptions {
  scalingFactor: number;
  selectedFiles: string[];
}

export interface LogMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

export interface ProcessResult {
  success: boolean;
  message: string;
  processedFiles: number;
  processedImages: number;
}

