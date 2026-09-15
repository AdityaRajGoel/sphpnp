import React, { Component, ErrorInfo, ReactNode } from "react";
import { reportClientError, toReport } from "@/lib/client-errors";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Logged on the VPS (live site only, see src/lib/client-errors.ts).
    const report = toReport("react", error, undefined, window.location.pathname);
    reportClientError({ ...report, stack: `${report.stack ?? ""}\nComponent stack:${errorInfo.componentStack ?? ""}`.slice(0, 1500) });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {/* Ambient glow decoration */}
          <div className="absolute w-96 h-96 bg-destructive/10 rounded-full blur-3xl transform-gpu" />
          
          <div className="relative z-10 flex flex-col items-center max-w-md text-center">
            <div className="w-16 h-16 bg-destructive/20 rounded-2xl flex items-center justify-center mb-6 border border-destructive/30">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">
              Oops, something went wrong
            </h1>
            
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              We encountered an unexpected error while restoring the application state. 
              {this.state.error && (
                <span className="block mt-2 text-xs opacity-70 border border-border/50 bg-muted/50 p-2 rounded-md font-mono text-left break-all">
                  {this.state.error.message}
                </span>
              )}
            </p>
            
            <Button 
              size="lg" 
              onClick={() => window.location.reload()}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white gap-2 font-semibold shadow-lg shadow-brand-orange/20"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
