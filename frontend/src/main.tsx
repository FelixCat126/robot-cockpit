import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 确保root元素存在
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">错误：找不到root元素</div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('React app rendered successfully');
  } catch (error) {
    console.error('Failed to render React app:', error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;">渲染错误: ${error}</div>`;
  }
}

