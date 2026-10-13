import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { redactUrl } from './lib/analytics';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />
  </StrictMode>,
);
