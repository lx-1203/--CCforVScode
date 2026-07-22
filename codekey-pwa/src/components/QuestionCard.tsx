import { useState } from 'react';

export interface QuestionOption { label: string; description?: string; }

// AskUserQuestion 选项卡片。onSubmit 回传选中的 label（multiSelect 时用逗号连接）。
export function QuestionCard(props: {
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  onSubmit: (label: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(label: string) {
    if (props.multiSelect) {
      setSelected((prev) => prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]);
    } else {
      setSelected([label]);
    }
  }

  return (
    <div className="question-card">
      <div className="question-title">{props.question}</div>
      <div className="question-options">
        {props.options.map((opt) => (
          <button
            key={opt.label}
            className={'question-opt' + (selected.includes(opt.label) ? ' selected' : '')}
            onClick={() => toggle(opt.label)}
          >
            <span className="opt-label">{opt.label}</span>
            {opt.description && <span className="opt-desc">{opt.description}</span>}
          </button>
        ))}
      </div>
      <button
        className="question-submit"
        disabled={selected.length === 0}
        onClick={() => props.onSubmit(selected.join(','))}
      >
        提交
      </button>
    </div>
  );
}
