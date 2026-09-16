import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Intercept window.fetch to automatically append session token if present
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const saved = localStorage.getItem('tuuci_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${user.token}`);
        }
        init.headers = headers;
      }
    }
  } catch { /* ignore parse error */ }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
