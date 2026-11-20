import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

type GmpWindow = Window & {
  gm_authFailure?: () => void;
  __rodaleveGmpAuthFailed?: boolean;
};

// Tier 1 Google Maps Platform Auth/Referer & Quota Error Listeners
(window as GmpWindow).gm_authFailure = () => {
  (window as GmpWindow).__rodaleveGmpAuthFailed = true;
  window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args
    .map((a) => {
      try {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message || String(a);
        return String(a);
      } catch {
        return '';
      }
    })
    .join(' ');

  if (
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('ApiTargetBlockedMapError')
  ) {
    (window as GmpWindow).__rodaleveGmpAuthFailed = true;
    window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
    return;
  }
  origConsoleError.apply(console, args);
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary screenName="Aplicação">
    <App />
  </ErrorBoundary>
);
