/**
 * .adofai文件选择器组件
 * 显示所有找到的谱面文件，允许用户选择要处理的文件
 */
import { useState, useEffect } from 'react';
import type { AdofaiFile } from '../types';

interface ChartSelectorProps {
  files: AdofaiFile[];
  onSelectionChange: (selectedPaths: string[]) => void;
}

export function ChartSelector({ files, onSelectionChange }: ChartSelectorProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // 初始化时全选
  useEffect(() => {
    const allPaths = new Set(files.map((f) => f.path));
    setSelectedFiles(allPaths);
    onSelectionChange(Array.from(allPaths));
  }, [files, onSelectionChange]);

  const handleToggle = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    const allPaths = new Set(files.map((f) => f.path));
    setSelectedFiles(allPaths);
    onSelectionChange(Array.from(allPaths));
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
    onSelectionChange([]);
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="chart-selector">
      <div className="selector-header">
        <div className="selector-title">📂 选择要处理的谱面</div>
        <div className="selector-actions">
          <button onClick={handleSelectAll} className="btn-text">
            全选
          </button>
          <button onClick={handleDeselectAll} className="btn-text">
            全不选
          </button>
        </div>
      </div>
      <div className="file-list">
        {files.map((file) => (
          <div
            key={file.path}
            className={`file-item ${selectedFiles.has(file.path) ? 'selected' : ''}`}
            onClick={() => handleToggle(file.path)}
          >
            <div className="checkbox">
              {selectedFiles.has(file.path) ? '☑' : '☐'}
            </div>
            <div className="file-path">{file.path}</div>
          </div>
        ))}
      </div>
      <div className="selector-footer">
        已选择 {selectedFiles.size} / {files.length} 个文件
      </div>
    </div>
  );
}

