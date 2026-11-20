'use client';

import { Search, Copy, CopyDone, CopyError } from 'lucide-react';

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
        className="rounded-2xl bg-primary/10 border border-primary/20 p-12 animate-in fade-in grow"
        style="max-width: 480px;"
      >
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mx-auto mb-6">
          <Search className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold font-headline text-center mb-4">
          Something went wrong
        </h2>
        <p className="text-muted-foreground text-center leading-relaxed mb-8">
          We ran into an issue. Please try again.
        </p>

        {/* Error button - reveals details */}
        <button
          onClick={() => setShowDetails(true)}
          className="bg-primary text-primary-foreground rounded-full px-4 py-2 font-medium text-sm transition-colors hover:bg-primary/90 mb-4 inline-block"
        >
          <Search className="mr-2 h-4 w-4" /> Show error details
        </button>

        {/* Error details panel - appears when toggled */}
        {showDetails && (
          <div
            className="bg-muted/50 rounded-lg p-4 mb-6 animate-in fade-in duration-300"
            style="max-height: 600px; overflow-y: auto;"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Error information:
              </span>
              <button
                onClick={copyToClipboard}
                className="text-primary text-sm hover:underline transition-colors"
                title="Copy error to clipboard"
              >
                {copied ? (
                  <CopyDone className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Copy status */}
            {copied && (
              <p className="text-sm text-primary/80 text-center mb-3">
                Copied to clipboard!
              </p>
            )}

            {/* Error code block - makes it readable */}
            <div
              className="bg-background rounded-md p-3 overflow-x-auto"
              style="max-height: 400px; overflow-y: auto;"
            >
              <pre
                className="text-xs font-mono whitespace-pre-wrap text-muted-foreground"
                style="color: hsl(var(--muted-foreground));"
              >
                {errorMessage}
              </pre>
            </div>
          </div>
        )}

        {/* Fallback if no error details */}
        {!showDetails && error && (
          <p className="text-sm text-muted-foreground text-center mb-4">
            Tap "Show error details" to see what went wrong
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={reset}
            className="border border-muted/50 rounded-full px-6 py-3 text-muted-foreground transition-colors hover:bg-muted/20"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}