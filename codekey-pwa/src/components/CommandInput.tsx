import { useState } from 'react';

// 底部发指令输入框。第一期只回调本地（mock），第二期接反向 stdin 通道。
export function CommandInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }
  return (
    <div className="command-input">
      <input
        className="command-field"
        placeholder="发消息给 Claude..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
      />
      <button className="command-send" onClick={send} disabled={!text.trim()}>发送</button>
    </div>
  );
}
