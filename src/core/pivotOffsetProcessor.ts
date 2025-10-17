/**
 * PivotOffset反向缩放处理器
 * 按照文档数学原理：pivotOffset_new = pivotOffset_old / lnum
 */
import { get, parseArray } from './parser';

/**
 * 处理pivotOffset反向缩放
 * 只处理标记为需要处理的事件
 */
export function processPivotOffset(line: string, lnum: number): string {
  const pivotOffsetStr = get(line, 'pivotOffset');

  // 条件1：pivotOffset字段必须存在
  if (!pivotOffsetStr) {
    return line;
  }

  // 条件2：不是null值
  if (pivotOffsetStr === '[null,null]') {
    return line;
  }

  // 解析X, Y值
  const [xStr, yStr] = parseArray(pivotOffsetStr);

  // 反向缩放计算（注意：这里是除法！）
  const newX =
    xStr.trim() === 'null' ? 'null' : (parseFloat(xStr) / lnum).toString();
  const newY =
    yStr.trim() === 'null' ? 'null' : (parseFloat(yStr) / lnum).toString();

  // 字符串分割-修改-重组
  const pivotPos = line.indexOf('"pivotOffset"');
  const head = line.substring(0, pivotPos);
  const rest = line.substring(pivotPos);

  // 找到pivotOffset字段的结束位置
  const pivotEnd = rest.indexOf(']') + 1;
  const back = rest.substring(pivotEnd);

  return `${head}"pivotOffset":[${newX},${newY}]${back}`;
}

