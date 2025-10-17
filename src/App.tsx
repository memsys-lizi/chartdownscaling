/**
 * 主应用组件
 * ADOFAI Chart Downscaling Tool
 */
import { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { ChartSelector } from './components/ChartSelector';
import { ScalingInput } from './components/ScalingInput';
import { ProcessButton } from './components/ProcessButton';
import { LogViewer } from './components/LogViewer';
import { useFileUpload } from './hooks/useFileUpload';
import { useProcessor } from './hooks/useProcessor';
import { useLogs } from './hooks/useLogs';
import './App.css';

function App() {
  const [scalingFactor, setScalingFactor] = useState(2);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  const { uploadedFile, zipContents, adofaiFiles, isUploading, handleFileUpload, reset } =
    useFileUpload();

  const { isProcessing, process } = useProcessor();
  const { logs } = useLogs();

  const handleProcess = async () => {
    if (!zipContents || !uploadedFile) {
      alert('请先上传 ZIP 文件');
      return;
    }

    if (selectedPaths.length === 0) {
      alert('请至少选择一个 .adofai 文件进行处理');
      return;
    }

    if (scalingFactor < 2) {
      alert('缩放倍数必须至少为 2');
      return;
    }

    await process(zipContents, selectedPaths, scalingFactor, uploadedFile.name);
  };

  const handleNewFile = () => {
    if (confirm('上传新文件？当前进度将丢失。')) {
      reset();
      setSelectedPaths([]);
    }
  };

  const canProcess = !isUploading && !isProcessing && zipContents && selectedPaths.length > 0;

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-title">ADOFAI 谱面降分辨率工具</h1>
          <div className="app-divider"></div>
        </header>

        {/* File Upload */}
        <section className="section">
          {!uploadedFile ? (
            <FileUploader onFileSelect={handleFileUpload} disabled={isUploading || isProcessing} />
          ) : (
            <div className="uploaded-file-info">
              <div className="file-info-content">
                <div className="file-info-icon">✓</div>
                <div className="file-info-details">
                  <div className="file-info-name">{uploadedFile.name}</div>
                  <div className="file-info-meta">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • 找到 {adofaiFiles.length}{' '}
                    个 .adofai 文件
                  </div>
                </div>
              </div>
              {!isProcessing && (
                <button className="btn-change" onClick={handleNewFile}>
                  更换文件
                </button>
              )}
            </div>
          )}
        </section>

        {/* Chart Selector */}
        {adofaiFiles.length > 0 && (
          <section className="section">
            <ChartSelector files={adofaiFiles} onSelectionChange={setSelectedPaths} />
          </section>
        )}

        {/* Scaling Input */}
        {adofaiFiles.length > 0 && (
          <section className="section">
            <ScalingInput
              value={scalingFactor}
              onChange={setScalingFactor}
              disabled={isProcessing}
            />
          </section>
        )}

        {/* Process Button */}
        {adofaiFiles.length > 0 && (
          <section className="section">
            <ProcessButton onClick={handleProcess} disabled={!canProcess} loading={isProcessing} />
          </section>
        )}

        {/* Log Viewer */}
        <section className="section">
          <LogViewer logs={logs} />
        </section>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-text">
            基于 一块发霉的土豆 的技术文档开发
          </div>
          <div className="footer-text">
            作者：lizi
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
