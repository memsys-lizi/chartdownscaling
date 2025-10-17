/**
 * 事件处理器 - 处理各种ADOFAI事件
 * 严格按照文档算法实现
 */
import { get, parseArray, parseTags } from './parser';
import { TagSystem } from './tagSystem';
import type { ProcessedEvent } from '../types/adofai';

export class EventProcessor {
  private tagSystem: TagSystem;

  constructor(tagSystem: TagSystem) {
    this.tagSystem = tagSystem;
  }

  /**
   * 第一遍扫描：收集标签信息
   */
  collectTags(line: string): void {
    const eventType = get(line, 'eventType');

    // 收集装饰标签（需要缩放）
    if (eventType === '"AddDecoration"') {
      const tagStr = get(line, 'tag');
      if (tagStr) {
        const tags = parseTags(tagStr);
        tags.forEach((tag) => this.tagSystem.addTag(tag));
      }
    }

    // 收集对象/文本标签（需要重命名以避免冲突）
    if (eventType === '"AddText"' || eventType === '"AddObject"') {
      const tagStr = get(line, 'tag');
      if (tagStr) {
        const tags = parseTags(tagStr);
        tags.forEach((tag) => this.tagSystem.addBadTag(tag));
      }
    }
  }

  /**
   * 处理AddDecoration事件
   */
  processAddDecoration(line: string, lnum: number): ProcessedEvent {
    const scaleStr = get(line, 'scale');
    if (!scaleStr) {
      return { line, needsPivotProcess: false };
    }

    // 解析scale值
    const [xStr, yStr] = parseArray(scaleStr);

    // 应用缩放因子（文档算法：scale × lnum）
    const newX = xStr.trim() === 'null' ? 'null' : (parseFloat(xStr) * lnum).toString();
    const newY = yStr.trim() === 'null' ? 'null' : (parseFloat(yStr) * lnum).toString();

    // 字符串分割-修改-重组
    const scalePos = line.indexOf('"scale"');
    const head = line.substring(0, scalePos);
    const rest = line.substring(scalePos);

    // 找到scale字段的结束位置
    const scaleEnd = rest.indexOf(']') + 1;
    const back = rest.substring(scaleEnd);

    const newLine = `${head}"scale":[${newX},${newY}]${back}`;

    return {
      line: newLine,
      needsPivotProcess: true, // AddDecoration需要处理pivotOffset
    };
  }

  /**
   * 处理MoveDecorations事件（有scale）
   * 注意：返回数组，因为需要拆分多标签
   */
  processMoveDecorations(line: string, lnum: number): ProcessedEvent[] {
    const tagStr = get(line, 'tag');
    const scaleStr = get(line, 'scale');

    if (!tagStr) {
      return [{ line, needsPivotProcess: false }];
    }

    const tags = parseTags(tagStr);
    const results: ProcessedEvent[] = [];

    // 解析scale值（如果存在）
    let xStr = '',
      yStr = '';
    let hasScale = false;

    if (scaleStr) {
      [xStr, yStr] = parseArray(scaleStr);
      hasScale = true;
    }

    // 为每个标签生成独立事件
    for (const tag of tags) {
      let newLine = line;
      let needsPivot = false;

      // 替换tag字段为单个标签
      const tagPos = line.indexOf('"tag"');
      const head = line.substring(0, tagPos);
      const rest = line.substring(tagPos);
      
      // 找到tag值的开始和结束引号
      const colonPos = rest.indexOf(':');
      const valueStart = rest.indexOf('"', colonPos) + 1; // tag值的开始引号后
      const valueEnd = rest.indexOf('"', valueStart); // tag值的结束引号
      const afterTag = rest.substring(valueEnd + 1); // 跳过结束引号

      // 判断是否是装饰标签（需要缩放）
      if (this.tagSystem.hasTag(tag)) {
        needsPivot = true;

        if (hasScale) {
          // 应用缩放
          const newX = xStr.trim() === 'null' ? 'null' : (parseFloat(xStr) * lnum).toString();
          const newY = yStr.trim() === 'null' ? 'null' : (parseFloat(yStr) * lnum).toString();

          // 重组：修改tag和scale
          const scalePos = afterTag.indexOf('"scale"');
          if (scalePos !== -1) {
            const beforeScale = afterTag.substring(0, scalePos);
            const scaleRest = afterTag.substring(scalePos);
            const scaleEnd = scaleRest.indexOf(']') + 1;
            const afterScale = scaleRest.substring(scaleEnd);

            newLine = `${head}"tag":"${tag}"${beforeScale}"scale":[${newX},${newY}]${afterScale}`;
          } else {
            newLine = `${head}"tag":"${tag}"${afterTag}`;
          }
        } else {
          newLine = `${head}"tag":"${tag}"${afterTag}`;
        }
      } else {
        // 不是装饰标签，不缩放scale
        newLine = `${head}"tag":"${tag}"${afterTag}`;
      }

      results.push({ line: newLine, needsPivotProcess: needsPivot });

      // 处理重名对象标签
      if (this.tagSystem.hasBadTag(tag)) {
        const mappedTag = this.tagSystem.getMappedTag(tag);
        const badLine = `${head}"tag":"${mappedTag}"${afterTag}`;
        results.push({ line: badLine, needsPivotProcess: false });
      }
    }

    return results;
  }

  /**
   * 处理MoveDecorations事件（无scale）
   */
  processMoveDecorationsNoScale(line: string): ProcessedEvent[] {
    const tagStr = get(line, 'tag');

    if (!tagStr) {
      return [{ line, needsPivotProcess: false }];
    }

    const tags = parseTags(tagStr);
    const results: ProcessedEvent[] = [];

    // 为每个标签生成独立事件
    for (const tag of tags) {
      const tagPos = line.indexOf('"tag"');
      const head = line.substring(0, tagPos);
      const rest = line.substring(tagPos);
      
      // 找到tag值的开始和结束引号
      const colonPos = rest.indexOf(':');
      const valueStart = rest.indexOf('"', colonPos) + 1;
      const valueEnd = rest.indexOf('"', valueStart);
      const afterTag = rest.substring(valueEnd + 1);

      const needsPivot = this.tagSystem.hasTag(tag);
      const newLine = `${head}"tag":"${tag}"${afterTag}`;

      results.push({ line: newLine, needsPivotProcess: needsPivot });

      // 处理重名对象标签
      if (this.tagSystem.hasBadTag(tag)) {
        const mappedTag = this.tagSystem.getMappedTag(tag);
        const badLine = `${head}"tag":"${mappedTag}"${afterTag}`;
        results.push({ line: badLine, needsPivotProcess: false });
      }
    }

    return results;
  }

  /**
   * 处理AddText/AddObject/SetText/SetObject事件
   * 需要重命名标签
   */
  processTextOrObject(line: string): ProcessedEvent {
    const tagStr = get(line, 'tag');

    if (!tagStr) {
      return { line, needsPivotProcess: false };
    }

    const tags = parseTags(tagStr);
    const newTags: string[] = [];

    // 检查每个标签是否需要重命名
    for (const tag of tags) {
      if (this.tagSystem.hasBadTag(tag)) {
        newTags.push(this.tagSystem.getMappedTag(tag));
      } else {
        newTags.push(tag);
      }
    }

    // 重组tag字段
    const tagPos = line.indexOf('"tag"');
    const head = line.substring(0, tagPos);
    const rest = line.substring(tagPos);
    
    // 找到tag值的开始和结束引号
    const colonPos = rest.indexOf(':');
    const valueStart = rest.indexOf('"', colonPos) + 1;
    const valueEnd = rest.indexOf('"', valueStart);
    const afterTag = rest.substring(valueEnd + 1);

    const newLine = `${head}"tag":"${newTags.join(' ')}"${afterTag}`;

    return { line: newLine, needsPivotProcess: false };
  }

  /**
   * 处理CustomBackground事件
   */
  processCustomBackground(line: string, lnum: number): ProcessedEvent {
    const bgDisplayMode = get(line, 'bgDisplayMode');

    // 只处理非FitToScreen模式
    if (bgDisplayMode === '"FitToScreen"') {
      return { line, needsPivotProcess: false };
    }

    const scalingRatioStr = get(line, 'scalingRatio');
    if (!scalingRatioStr) {
      return { line, needsPivotProcess: false };
    }

    // 应用缩放
    const newRatio = parseFloat(scalingRatioStr) * lnum;

    // 字符串分割-修改-重组
    const ratioPos = line.indexOf('"scalingRatio"');
    const head = line.substring(0, ratioPos);
    const rest = line.substring(ratioPos);

    // 找到字段结束位置
    const colonPos = rest.indexOf(':');
    const afterColon = rest.substring(colonPos + 1).trimStart();
    let valueEnd = 0;
    while (
      valueEnd < afterColon.length &&
      (afterColon[valueEnd] >= '0' && afterColon[valueEnd] <= '9') ||
      afterColon[valueEnd] === '.'
    ) {
      valueEnd++;
    }
    const back = afterColon.substring(valueEnd);

    const newLine = `${head}"scalingRatio": ${newRatio}${back}`;

    return { line: newLine, needsPivotProcess: false };
  }
}

