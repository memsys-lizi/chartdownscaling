/**
 * 处理按钮组件
 * 带loading状态和禁用状态
 */
interface ProcessButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ProcessButton({ onClick, disabled = false, loading = false }: ProcessButtonProps) {
  return (
    <button
      className={`process-button ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="spinner"></span>
          处理中...
        </>
      ) : (
        '开始处理并下载'
      )}
    </button>
  );
}

