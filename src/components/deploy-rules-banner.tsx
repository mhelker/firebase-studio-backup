
'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';

export function DeployRulesBanner() {
  const [hasCopied, setHasCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const command = 'firebase deploy --only firestore,storage';

  useEffect(() => {
    // This will only run on the client, after the initial render.
    setIsMounted(true);
  }, []);

  const onCopy = () => {
    navigator.clipboard.writeText(command);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Don't render anything on the server or during initial client render
  // to avoid hydration mismatch.
  if (!isMounted) {
    return null;
  }

  // This banner is for development guidance and should not appear in production.
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="bg-destructive text-destructive-foreground p-4 w-full">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0" />
          <div className="flex flex-col text-left">
            <h3 className="font-bold">Action Required: Deploy Security Rules</h3>
            <p className="text-sm">To enable database and storage features, deploy the security rules from the terminal.</p>
          </div>
        </div>
        <div className="bg-black/20 rounded-md p-2 flex items-center gap-2 font-mono text-sm w-full md:w-auto">
          <span className="flex-grow">{command}</span>
          <button onClick={onCopy} title="Copy command" className="p-1 rounded-md hover:bg-black/30 transition-colors flex-shrink-0">
            {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
