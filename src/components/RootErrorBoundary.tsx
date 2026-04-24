import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 避免單一元件 throw 導致整頁白屏；錯誤訊息方便本機偵錯與內建瀏覽器除錯。
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RootErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#fff7ed',
            color: '#1c1917',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>頁面無法顯示</h1>
          <p style={{ color: '#57534e', marginBottom: 12 }}>
            請在瀏覽器按 F12 查看 Console 完整錯誤，或改用 Chrome / Edge 開啟同網址再試。
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#fff',
              border: '1px solid #e7e5e4',
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
            }}
          >
            {this.state.error.name}: {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
