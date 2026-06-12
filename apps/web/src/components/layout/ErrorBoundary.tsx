import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * App-level error boundary: prevents a render error from white-screening the app
 * and never surfaces stack traces / internals to the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Log to console only (no UI leak); wire to telemetry later if needed.
    console.error('Render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please reload the page — your data is safe.
            </p>
            <button
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground"
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
