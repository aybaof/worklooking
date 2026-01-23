import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertCircle className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
