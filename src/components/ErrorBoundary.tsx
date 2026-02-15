import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6 text-center z-50">
                    <h1 className="text-4xl font-orbitron font-bold text-destructive mb-4">
                        SYSTEM FAILURE
                    </h1>
                    <div className="bg-card border border-border p-6 rounded-lg shadow-lg max-w-md w-full mb-6">
                        <p className="text-muted-foreground mb-4 font-mono text-sm break-words">
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>
                    </div>
                    <Button
                        onClick={() => window.location.reload()}
                        className="font-bold tracking-wider"
                    >
                        REBOOT SYSTEM
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
