/**
 * 图片缩放服务
 * 使用Canvas API实现高质量图片缩放
 */
import { logger } from './logger';

/**
 * 支持的图片格式
 */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

/**
 * 检查是否是图片文件
 */
export function isImageFile(filename: string): boolean {
  const lowerFilename = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext));
}

/**
 * 缩放图片
 * @param imageData 原始图片数据
 * @param lnum 缩放倍数（图片尺寸会缩小到 1/lnum）
 * @returns 缩放后的图片Blob
 */
export async function resizeImage(
  imageData: ArrayBuffer,
  lnum: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([imageData]);
    const img = new Image();

    img.onload = () => {
      try {
        // 跳过1×1图片（文档要求）
        if (img.width === 1 && img.height === 1) {
          resolve(blob);
          return;
        }

        // 计算新尺寸，确保至少为1像素（文档边界保护）
        const newWidth = Math.max(1, Math.floor(img.width / lnum));
        const newHeight = Math.max(1, Math.floor(img.height / lnum));

        // 创建Canvas进行高质量缩放
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // 使用高质量插值（类似Lanczos）
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 绘制缩放后的图片
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // 转换为Blob
        canvas.toBlob(
          (resultBlob) => {
            if (resultBlob) {
              resolve(resultBlob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      } catch (error) {
        reject(error);
      } finally {
        // 清理对象URL
        URL.revokeObjectURL(img.src);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // 加载图片
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * 批量缩放图片
 */
export async function resizeImages(
  images: Map<string, ArrayBuffer>,
  lnum: number,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();
  const imageEntries = Array.from(images.entries());
  const total = imageEntries.length;

  logger.info(`开始缩放 ${total} 张图片...`);

  for (let i = 0; i < imageEntries.length; i++) {
    const [path, data] = imageEntries[i];

    try {
      const resizedBlob = await resizeImage(data, lnum);
      result.set(path, resizedBlob);

      if (onProgress) {
        onProgress(i + 1, total);
      }

      if ((i + 1) % 10 === 0 || i + 1 === total) {
        logger.info(`已缩放 ${i + 1}/${total} 张图片`);
      }
    } catch (error) {
      logger.error(
        `缩放图片出错 ${path}：${error instanceof Error ? error.message : '未知错误'}`
      );
      // 使用原始数据
      result.set(path, new Blob([data]));
    }
  }

  logger.success(`成功缩放 ${total} 张图片`);
  return result;
}

