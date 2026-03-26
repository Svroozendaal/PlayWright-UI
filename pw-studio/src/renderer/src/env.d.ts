/// <reference types="vite/client" />

// Re-export JSX namespace for React 19 compatibility
import type React from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = React.JSX.Element
    type IntrinsicElements = React.JSX.IntrinsicElements
  }
}
