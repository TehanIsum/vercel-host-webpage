// ============================================================================
// Session Provider Component
// ============================================================================
// Provides session monitoring to the entire application
// ============================================================================

'use client';

import { useSessionMonitor } from '@/hooks/use-session-monitor';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Initialize session monitoring
  useSessionMonitor();

  // Handle session revocation messages
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sessionRevoked = searchParams.get('session_revoked');
    const messageText = searchParams.get('message');

    if (sessionRevoked === 'true') {
      const displayMessage = messageText 
        ? decodeURIComponent(messageText)
        : 'Session expired. You have been logged in from another device.';
      
      setMessage(displayMessage);
      setShowMessage(true);

      // Auto-hide after 15 seconds
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleLoginClick = () => {
    setShowMessage(false);
    // Redirect to home with login dialog trigger
    router.push('/?login=true');
  };

  return (
    <>
      {showMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 bg-[#1a1a1a] border border-red-500/30 rounded-lg p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-400 text-lg font-bold mb-2">
                  Session Expired
                </p>
                <p className="text-gray-300 text-sm leading-relaxed mb-3">{message}</p>
                <p className="text-gray-400 text-xs mb-4">Please log in again to continue.</p>
                <button
                  onClick={handleLoginClick}
                  className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-md transition-colors"
                >
                  Log In Again
                </button>
              </div>
              <button
                onClick={() => setShowMessage(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
