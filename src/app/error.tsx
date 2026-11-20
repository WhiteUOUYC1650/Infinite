'use client';

import { Search, Copy, CopyDone } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const errorMessage = React.useMemo(() => {
    if (error === null || error === undefined) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      try {
        return JSON.stringify(error, null, 2);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }, [error]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(errorMessage);
      setCopied(true);
      // Reset after 2 seconds
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-8">
      <div
        className="rounded-2xl bg-primary/10 border border-primary/20 p-8 animate-in fade-in grow max-w-md w-full"
      >
        {/* Circle with N letter */}
        <div className="flex items-center justify-center h-20 w-20 rounded-full mx-auto mb-6 bg-primary/10 border border-primary/20">
          <Search className="h-10 w-10 text-primary" />
        </div>
        
        <h2 className="text-xl font-bold font-headline text-center mb-3">Error</h2>
        <p className="text-muted-foreground text-center leading-relaxed mb-6">
          An unexpected error occurred.
        </p>

        {/* Copy button */}
        <div className="flex gap-2 justify-center mb-5">
          {copied ? (
            <p className="text-sm text-primary/80">
              Copied to clipboard!
            </p>
          ) : (
            <button
              onClick={copyToClipboard}
              className="bg-primary text-primary-foreground rounded-full px-4 py-2 font-medium text-sm transition-colors hover:bg-primary/90"
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </button>
          )}
        </div>

        {/* Toggle details button */}
        <button
          onClick={() => setShowDetails(true)}
          className="w-full bg-secondary/5 text-secondary rounded-full px-4 py-2 font-medium text-sm text-secondary transition-colors hover:bg-secondary/10 mb-3 flex items-center justify-center gap-2"
        >
          <Search className="h-4 w-4" /> Details
        </button>

        {/* Error details panel */}
        {showDetails && (
          <div
            className="bg-muted/50 rounded-lg p-4 mb-5 animate-in fade-in duration-300"
            style="max-height: 500px; overflow-y: auto;"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Error info</span>
              <button
                onClick={() => setShowDetails(false)}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Close
              </button>
            </div>

            <div className="bg-background rounded-md p-3 overflow-x-auto">
              <pre
                className="text-xs font-mono whitespace-pre-wrap text-muted-foreground"
              >
                {errorMessage}
              </pre>
            </div>
          </div>
        )}

        {/* Fallback text if no error */}
        {!showDetails && error && (
          <p className="text-sm text-muted-foreground text-center mb-4">
            Tap "Details" to see error information
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 bg-primary text-primary-foreground rounded-full px-4 py-3 font-bold transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={reset}
            className="flex-1 border border-muted/50 rounded-full px-4 py-3 text-muted-foreground transition-colors hover:bg-muted/20"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}