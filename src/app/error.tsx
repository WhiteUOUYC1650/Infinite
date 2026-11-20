import { Search } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-8">
      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-12 animate-in fade-in grow" style="max-width: 480px;">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mx-auto mb-6">
          <Search className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold font-headline text-center mb-4">
          Something went wrong
        </h2>
        <p className="text-muted-foreground text-center leading-relaxed mb-8">
          We ran into an issue. Please try again.
        </p>
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