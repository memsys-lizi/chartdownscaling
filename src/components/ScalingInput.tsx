/**
 * 缩放倍数输入组件
 * 带验证，只允许大于1的整数
 */
import { useState } from 'react';

interface ScalingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ScalingInput({ value, onChange, disabled = false }: ScalingInputProps) {
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // 空值
    if (inputValue === '') {
      setError('');
      return;
    }

    // 尝试解析
    const num = parseInt(inputValue, 10);

    // 验证
    if (isNaN(num)) {
      setError('必须是有效的整数');
      return;
    }

    if (num < 2) {
      setError('必须至少为 2');
      return;
    }

    if (num > 100) {
      setError('必须最多为 100');
      return;
    }

    // 验证通过
    setError('');
    onChange(num);
  };

  return (
    <div className="scaling-input">
      <div className="input-header">
        <label htmlFor="scaling-factor">⚙️ 缩放倍数</label>
        <div className="input-hint">
          图片将缩小至原尺寸的 1/{value}
        </div>
      </div>
      <div className="input-wrapper">
        <input
          id="scaling-factor"
          type="number"
          min="2"
          max="100"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={error ? 'error' : ''}
        />
        {error && <div className="error-message">{error}</div>}
      </div>
      <div className="input-info">(必须是 ≥ 2 的整数)</div>
    </div>
  );
}

