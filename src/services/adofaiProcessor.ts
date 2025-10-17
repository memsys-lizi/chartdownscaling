/**
 * ADOFAI谱面处理器 - 主处理流程
 * 严格按照文档的三遍扫描算法实现
 */
import { get, mergeMultilineEvent } from '../core/parser';
import { TagSystem } from '../core/tagSystem';
import { EventProcessor } from '../core/eventProcessor';
import { processPivotOffset } from '../core/pivotOffsetProcessor';
import { logger } from './logger';
import type { ProcessedEvent } from '../types/adofai';

/**
 * 处理单个.adofai文件
 * @param content 文件内容
 * @param lnum 缩放倍数
 * @returns 处理后的内容
 */
export function processAdofaiFile(content: string, lnum: number): string {
  logger.info('正在处理 .adofai 文件...');

  // 分割成行
  const lines = content.split('\n');

  // 初始化标签系统和事件处理器
  const tagSystem = new TagSystem();
  const eventProcessor = new EventProcessor(tagSystem);

  // ===== 第一遍扫描：收集标签信息 =====
  logger.info('第一遍扫描：收集标签...');

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    let line = lines[lineIndex];

    // 检查是否是事件行，并处理多行事件
    if (get(line, 'eventType') !== '') {
      const { merged, endIndex } = mergeMultilineEvent(lines, lineIndex);
      line = merged;
      lineIndex = endIndex;

      // 收集标签
      eventProcessor.collectTags(line);
    }

    lineIndex++;
  }

  logger.info(
    `已收集装饰标签（需要缩放）：${tagSystem.tag.trim().split(' ').filter(Boolean).length} 个`
  );
  logger.info(
    `已收集对象标签（需要重命名）：${tagSystem.bad_tag.trim().split(' ').filter(Boolean).length} 个`
  );

  // ===== 第二遍扫描：处理事件 =====
  logger.info('第二遍扫描：处理事件...');

  const outputLines: string[] = [];
  const processedEvents: ProcessedEvent[] = [];

  lineIndex = 0;
  let eventCount = 0;

  while (lineIndex < lines.length) {
    let line = lines[lineIndex];
    const eventType = get(line, 'eventType');

    // 不是事件行，直接输出
    if (eventType === '') {
      outputLines.push(line);
      lineIndex++;
      continue;
    }

    // 合并多行事件
    const { merged, endIndex } = mergeMultilineEvent(lines, lineIndex);
    line = merged;
    lineIndex = endIndex + 1;

    // 根据事件类型处理
    let results: ProcessedEvent[] = [];

    if (eventType === '"AddDecoration"') {
      results = [eventProcessor.processAddDecoration(line, lnum)];
      eventCount++;
    } else if (eventType === '"MoveDecorations"') {
      const scaleStr = get(line, 'scale');
      if (scaleStr) {
        results = eventProcessor.processMoveDecorations(line, lnum);
      } else {
        results = eventProcessor.processMoveDecorationsNoScale(line);
      }
      eventCount++;
    } else if (
      eventType === '"AddText"' ||
      eventType === '"AddObject"' ||
      eventType === '"SetText"' ||
      eventType === '"SetObject"'
    ) {
      results = [eventProcessor.processTextOrObject(line)];
      eventCount++;
    } else if (eventType === '"CustomBackground"') {
      results = [eventProcessor.processCustomBackground(line, lnum)];
      eventCount++;
    } else {
      // 其他事件类型，不处理
      results = [{ line, needsPivotProcess: false }];
    }

    // 收集处理后的事件
    results.forEach((result) => {
      processedEvents.push(result);
      outputLines.push(result.line);
    });
  }

  logger.info(`已处理 ${eventCount} 个事件`);

  // ===== 第三遍：处理pivotOffset反向缩放 =====
  logger.info('第三遍扫描：处理 pivotOffset...');

  let pivotCount = 0;
  for (let i = 0; i < outputLines.length; i++) {
    const line = outputLines[i];
    const eventType = get(line, 'eventType');

    if (eventType !== '') {
      // 查找对应的ProcessedEvent
      const eventIndex = processedEvents.findIndex(
        (pe) => pe.line === line && processedEvents.indexOf(pe) >= 0
      );

      if (eventIndex !== -1 && processedEvents[eventIndex].needsPivotProcess) {
        const processedLine = processPivotOffset(line, lnum);
        if (processedLine !== line) {
          outputLines[i] = processedLine;
          pivotCount++;
        }
        // 标记为已处理，避免重复
        processedEvents[eventIndex].needsPivotProcess = false;
      }
    }
  }

  logger.info(`已处理 ${pivotCount} 个 pivotOffset 值`);
  logger.success('.adofai 文件处理完成');

  // 重组内容
  return outputLines.join('\n');
}

/**
 * 批量处理多个.adofai文件
 */
export async function processAdofaiFiles(
  files: Map<string, string>,
  selectedPaths: string[],
  lnum: number
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  logger.info(`正在处理 ${selectedPaths.length} 个已选 .adofai 文件...`);

  for (let index = 0; index < selectedPaths.length; index++) {
    const path = selectedPaths[index];
    logger.info(`[${index + 1}/${selectedPaths.length}] 正在处理：${path}`);

    const content = files.get(path);
    if (!content) {
      logger.error(`文件未找到：${path}`);
      continue;
    }

    try {
      const processedContent = processAdofaiFile(content, lnum);
      result.set(path, processedContent);
      logger.success(`成功处理：${path}`);
      
      // 每处理一个文件后让出控制权，防止页面卡死
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      logger.error(
        `处理出错 ${path}：${error instanceof Error ? error.message : '未知错误'}`
      );
      // 保留原始内容
      result.set(path, content);
    }
  }

  // 未选择的文件保持原样
  files.forEach((content, path) => {
    if (!selectedPaths.includes(path)) {
      result.set(path, content);
    }
  });

  return result;
}

