
'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function RestartServerBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // This session storage key tracks if the user has seen the banner in this session.
    const hasSeenBanner = sessionStorage.getItem('hasSeenRestartServerBanner');
    
    // This only runs on the client to avoid hydration issues
    // And only shows in development environments.
    if (process.env.NODE_ENV === 'development' && !hasSeenBanner) {
        // We use a timeout to give other banners (like the rules banner) priority
        // and not overwhelm the user on first load.
        const timer = setTimeout(() => {
            setShowBanner(true);
            sessionStorage.setItem('hasSeenRestartServerBanner', 'true');
        }, 3000); 
      
        return () => clearTimeout(timer);
    }
  }, []);

  if (!showBanner) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white p-4 w-full">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <div className="flex flex-col text-left">
            <h3 className="font-bold">How to Restart the Server</h3>
            <p className="text-sm">
              If you just changed configuration (like API keys in `.env` or `firebase.ts`), you need to restart the server.
              Look for a "Restart" or a Stop/Start button in the IDE's toolbar to apply the changes.
            </p>
          </div>
        </div>
        <RefreshCw className="h-8 w-8 opacity-70 hidden md:block" />
      </div>
    </div>
  );
}
