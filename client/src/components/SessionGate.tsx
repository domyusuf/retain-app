import { LoaderCircle, WifiOff } from 'lucide-react';
import { Brand } from './Brand';
import { useAuth } from '../auth/AuthContext';
export function SessionGate() {
  const { status, retrySession } = useAuth();
  return (
    <main className="session-gate">
      <Brand />
      {status === 'unavailable' ? (
        <div className="session-message" role="alert">
          <WifiOff size={28} />
          <h1>We couldn’t connect</h1>
          <p>Check your connection, then try again.</p>
          <button className="button primary" onClick={retrySession}>
            Try again
          </button>
        </div>
      ) : (
        <p role="status">
          <LoaderCircle className="spin" size={20} /> Opening your account…
        </p>
      )}
    </main>
  );
}
