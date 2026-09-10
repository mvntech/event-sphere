import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  resetKey?: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EventSphere] Render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <span className="mb-2 grid size-11 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>This section ran into a problem</CardTitle>
            <CardDescription>
              The rest of EventSphere is still working. Try again, and if it keeps happening let the organizers know.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {import.meta.env.DEV && (
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 font-mono text-meta text-muted-foreground">
                {error.message}
              </pre>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => this.setState({ error: null })}>
                <RefreshCw /> Try again
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload the page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
