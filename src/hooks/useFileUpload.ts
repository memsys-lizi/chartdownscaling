/**
 * 文件上传处理Hook
 */
import { useState } from 'react';
import { parseZipFile, type ZipContents } from '../services/zipHandler';
import type { AdofaiFile } from '../types';

export function useFileUpload() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [zipContents, setZipContents] = useState<ZipContents | null>(null);
  const [adofaiFiles, setAdofaiFiles] = useState<AdofaiFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadedFile(file);

    try {
      const contents = await parseZipFile(file);
      setZipContents(contents);

      // 转换为AdofaiFile数组
      const files: AdofaiFile[] = Array.from(contents.adofaiFiles.entries()).map(
        ([path, content]) => ({
          path,
          content,
          selected: true,
        })
      );

      setAdofaiFiles(files);
    } catch (error) {
      console.error('Error parsing ZIP:', error);
      alert('解析 ZIP 文件失败。请检查文件格式。');
      setUploadedFile(null);
      setZipContents(null);
      setAdofaiFiles([]);
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setUploadedFile(null);
    setZipContents(null);
    setAdofaiFiles([]);
    setIsUploading(false);
  };

  return {
    uploadedFile,
    zipContents,
    adofaiFiles,
    isUploading,
    handleFileUpload,
    reset,
  };
}

