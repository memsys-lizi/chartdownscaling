/**
 * 处理流程Hook
 */
import { useState, useCallback } from 'react';
import { processAdofaiFiles } from '../services/adofaiProcessor';
import { resizeImages } from '../services/imageResizer';
import { createAndDownloadZip, type ZipContents } from '../services/zipHandler';
import { logger } from '../services/logger';
import type { ProcessResult } from '../types';

export function useProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const process = useCallback(
    async (
      zipContents: ZipContents,
      selectedFiles: string[],
      scalingFactor: number,
      originalFilename: string
    ): Promise<ProcessResult> => {
      setIsProcessing(true);
      setProgress(0);

      try {
        logger.info('=== 开始处理 ===');
        logger.info(`缩放倍数：${scalingFactor}`);
        logger.info(`选中文件：${selectedFiles.length} 个`);

        // 步骤1: 处理.adofai文件
        setProgress(10);
        const processedAdofai = processAdofaiFiles(
          zipContents.adofaiFiles,
          selectedFiles,
          scalingFactor
        );

        // 步骤2: 处理图片
        setProgress(30);
        const processedImages = await resizeImages(
          zipContents.imageFiles,
          scalingFactor,
          (current, total) => {
            const imageProgress = 30 + (current / total) * 50;
            setProgress(imageProgress);
          }
        );

        // 步骤3: 创建并下载ZIP
        setProgress(85);
        await createAndDownloadZip(
          processedAdofai,
          processedImages,
          zipContents.otherFiles,
          originalFilename
        );

        setProgress(100);
        logger.success('=== 处理完成！===');

        return {
          success: true,
          message: '处理成功完成',
          processedFiles: processedAdofai.size,
          processedImages: processedImages.size,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '发生未知错误';
        logger.error(`处理失败：${errorMessage}`);

        return {
          success: false,
          message: errorMessage,
          processedFiles: 0,
          processedImages: 0,
        };
      } finally {
        setIsProcessing(false);
        setTimeout(() => setProgress(0), 2000);
      }
    },
    []
  );

  return {
    isProcessing,
    progress,
    process,
  };
}

