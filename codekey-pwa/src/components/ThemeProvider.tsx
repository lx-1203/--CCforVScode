import { ReactNode } from 'react';
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <div className="app-root" style={{minHeight:'100vh'}}>{children}</div>;
}
