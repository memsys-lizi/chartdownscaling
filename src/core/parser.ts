/**
 * 核心解析函数 - 从ADOFAI行中提取指定字段的值
 * 严格按照文档算法实现，处理嵌套结构和边界检测
 */
export function get(line: string, targetField: string): string {
  // Step 1: 预处理 - 清理行尾无用字符
  let processedLine = line.trimEnd();
  while (
    processedLine.endsWith(',') ||
    processedLine.endsWith(' ') ||
    processedLine.endsWith('}')
  ) {
    processedLine = processedLine.slice(0, -1);
  }
  processedLine += ','; // 统一格式，便于后续处理

  // Step 2: 定位目标字段
  const fieldPattern = `"${targetField}":`;
  const startIdx = processedLine.indexOf(fieldPattern);
  if (startIdx === -1) return ''; // 字段不存在

  // Step 3: 提取冒号后的值
  const colonIdx = processedLine.indexOf(':', startIdx);
  let valuePart = processedLine.substring(colonIdx + 1);

  // Step 4: 去除前导空格
  valuePart = valuePart.trimStart();

  // Step 5: 智能边界检测（文档核心算法）
  // 使用计数器追踪嵌套结构
  let end = 0;
  let bracketCount = 0; // 方括号计数器 []
  let quoteCount = 0;   // 引号计数器 ""

  // 只有当遇到逗号且不在数组内且不在字符串内时，才认为值结束
  while (end < valuePart.length) {
    const char = valuePart[end];

    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (char === '"') quoteCount++;

    // 边界条件：逗号 && 不在数组内 && 不在字符串内
    if (char === ',' && bracketCount === 0 && quoteCount % 2 === 0) {
      break;
    }

    end++;
  }

  return valuePart.substring(0, end).trim();
}

/**
 * 解析标签列表（空格分隔）
 */
export function parseTags(tagString: string): string[] {
  // 移除引号
  let tags = tagString.trim();
  if (tags.startsWith('"')) tags = tags.slice(1);
  if (tags.endsWith('"')) tags = tags.slice(0, -1);

  // 按空格分割
  return tags.split(/\s+/).filter((tag) => tag.length > 0);
}

/**
 * 解析数组值 [x, y]
 */
export function parseArray(arrayString: string): [string, string] {
  const cleaned = arrayString.trim();
  if (!cleaned.startsWith('[') || !cleaned.endsWith(']')) {
    return ['', ''];
  }

  const content = cleaned.slice(1, -1);
  const parts = content.split(',').map((p) => p.trim());

  return [parts[0] || '', parts[1] || ''];
}

/**
 * 合并多行事件（处理换行的JSON）
 */
export function mergeMultilineEvent(lines: string[], startIndex: number): {
  merged: string;
  endIndex: number;
} {
  let merged = lines[startIndex];
  let i = startIndex;

  // 检查是否是事件行且未结束
  while (
    i < lines.length &&
    get(merged, 'eventType') !== '' &&
    !merged.trimEnd().endsWith(',') &&
    !merged.trimEnd().endsWith('}')
  ) {
    i++;
    if (i >= lines.length) break;
    merged += '\n' + lines[i];
    // 清理末尾空白
    merged = merged.trimEnd();
  }

  return { merged, endIndex: i };
}

