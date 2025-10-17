// ADOFAI相关类型定义
export interface AdofaiEvent {
  eventType: string;
  [key: string]: string | number | boolean | null | undefined | unknown;
}

export interface TagSystem {
  tag: string;           // 需要缩放的装饰标签（空格分隔）
  bad_tag: string;       // 需要重命名的对象/文本标签
  tag_map: Map<string, string>;  // 标签映射表
}

export interface ProcessedEvent {
  line: string;
  needsPivotProcess: boolean;  // 对应文档中的 if_p[] 数组
}

