/**
 * ZIP文件处理服务
 * 使用JSZip进行ZIP文件的解压和压缩
 */
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { logger } from './logger';
import { isImageFile } from './imageResizer';

export interface ZipContents {
  adofaiFiles: Map<string, string>; // path -> content
  imageFiles: Map<string, ArrayBuffer>; // path -> data
  otherFiles: Map<string, ArrayBuffer>; // path -> data
}

/**
 * 解析上传的ZIP文件
 */
export async function parseZipFile(file: File): Promise<ZipContents> {
  logger.info(`正在解压 ZIP 文件：${file.name}...`);

  const zip = new JSZip();
  const zipData = await zip.loadAsync(file);

  const adofaiFiles = new Map<string, string>();
  const imageFiles = new Map<string, ArrayBuffer>();
  const otherFiles = new Map<string, ArrayBuffer>();

  // 遍历ZIP中的所有文件
  const filePromises: Promise<void>[] = [];

  zipData.forEach((relativePath, zipEntry) => {
    // 跳过目录
    if (zipEntry.dir) return;

    // 跳过macOS的隐藏文件
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) {
      return;
    }

    const promise = (async () => {
      if (relativePath.toLowerCase().endsWith('.adofai')) {
        // ADOFAI谱面文件
        const content = await zipEntry.async('text');
        adofaiFiles.set(relativePath, content);
        logger.info(`找到 .adofai 文件：${relativePath}`);
      } else if (isImageFile(relativePath)) {
        // 图片文件
        const data = await zipEntry.async('arraybuffer');
        imageFiles.set(relativePath, data);
      } else {
        // 其他文件（保留原样）
        const data = await zipEntry.async('arraybuffer');
        otherFiles.set(relativePath, data);
      }
    })();

    filePromises.push(promise);
  });

  await Promise.all(filePromises);

  logger.success(
    `已解压 ${adofaiFiles.size} 个 .adofai 文件，${imageFiles.size} 张图片，${otherFiles.size} 个其他文件`
  );

  return { adofaiFiles, imageFiles, otherFiles };
}

/**
 * 创建并下载处理后的ZIP文件
 */
export async function createAndDownloadZip(
  adofaiFiles: Map<string, string>,
  imageFiles: Map<string, Blob>,
  otherFiles: Map<string, ArrayBuffer>,
  originalFilename: string
): Promise<void> {
  logger.info('正在创建输出 ZIP 文件...');

  const zip = new JSZip();

  // 添加处理后的.adofai文件
  adofaiFiles.forEach((content, path) => {
    zip.file(path, content);
  });

  // 添加处理后的图片
  imageFiles.forEach((blob, path) => {
    zip.file(path, blob);
  });

  // 添加其他文件（未修改）
  otherFiles.forEach((data, path) => {
    zip.file(path, data);
  });

  logger.info('正在压缩文件...');

  // 生成ZIP
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9, // 最大压缩
      },
    },
    (metadata) => {
      // 进度回调
      if (metadata.percent % 10 === 0) {
        logger.info(`压缩进度：${metadata.percent.toFixed(0)}%`);
      }
    }
  );

  // 生成输出文件名
  const outputFilename = originalFilename.replace(/\.zip$/i, '_processed.zip');

  logger.success('ZIP 文件已创建，开始下载...');

  // 触发下载
  saveAs(zipBlob, outputFilename);

  logger.success(`下载已开始：${outputFilename}`);
}

