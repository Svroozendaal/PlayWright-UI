export type UiIconName =
  | 'dashboard'
  | 'folder'
  | 'grid'
  | 'play'
  | 'record'
  | 'globe'
  | 'warning'
  | 'puzzle'
  | 'settings'
  | 'back'
  | 'collapse-left'
  | 'collapse-right'
  | 'blocks'
  | 'code'
  | 'bug'
  | 'sliders'
  | 'close'
  | 'chevron-down'
  | 'chevron-up'
  | 'move-up'
  | 'move-down'
  | 'refresh'
  | 'moon'
  | 'plus'

type UiIconProps = {
  name: UiIconName
  className?: string
}

/**
 * Renders a compact inline SVG icon using the shared Carbon Logic stroke style.
 *
 * @param name The semantic icon name to render.
 * @param className Optional CSS class names for sizing or colour hooks.
 * @returns A presentation-only SVG icon.
 */
export function UiIcon({ name, className }: UiIconProps): JSX.Element {
  const common = {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    className: className ? `ui-icon ${className}` : 'ui-icon',
    'aria-hidden': true,
  }

  switch (name) {
    case 'dashboard':
      return <svg {...common}><path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v6h-4zM2.5 9.5h6v4h-6zM10.5 10.5h3v3h-3z" /></svg>
    case 'folder':
      return <svg {...common}><path d="M2.5 4.5h3l1 1h7v6h-11z" /><path d="M2.5 4.5v7" /></svg>
    case 'grid':
      return <svg {...common}><path d="M2.5 3.5h4v4h-4zM9.5 3.5h4v4h-4zM2.5 10.5h4v2h-4zM9.5 10.5h4v2h-4z" /></svg>
    case 'play':
      return <svg {...common}><path d="M5 3.5v9l6-4.5z" /></svg>
    case 'record':
      return <svg {...common}><rect x="4" y="4" width="8" height="8" /></svg>
    case 'globe':
      return <svg {...common}><circle cx="8" cy="8" r="5.5" /><path d="M2.8 8h10.4M8 2.5c1.6 1.5 2.5 3.5 2.5 5.5S9.6 12 8 13.5M8 2.5C6.4 4 5.5 6 5.5 8s.9 4 2.5 5.5" /></svg>
    case 'warning':
      return <svg {...common}><path d="M8 2.5 13 12.5H3z" /><path d="M8 6v3.5M8 11.8v.2" /></svg>
    case 'puzzle':
      return <svg {...common}><path d="M3 6V3h3c0 1.1.9 2 2 2s2-.9 2-2h3v3c-1.1 0-2 .9-2 2s.9 2 2 2v3h-3c0-1.1-.9-2-2-2s-2 .9-2 2H3v-3c1.1 0 2-.9 2-2S4.1 6 3 6z" /></svg>
    case 'settings':
      return <svg {...common}><circle cx="8" cy="8" r="2.2" /><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M11.8 4.2l-1.4 1.4M5.6 10.4l-1.4 1.4" /></svg>
    case 'back':
      return <svg {...common}><path d="M12.5 8h-8" /><path d="M7.5 4.5 4 8l3.5 3.5" /></svg>
    case 'collapse-left':
      return <svg {...common}><path d="M10.5 3.5 6 8l4.5 4.5" /><path d="M3.5 3v10" /></svg>
    case 'collapse-right':
      return <svg {...common}><path d="M5.5 3.5 10 8l-4.5 4.5" /><path d="M12.5 3v10" /></svg>
    case 'blocks':
      return <svg {...common}><path d="M2.5 3.5h5v3h-5zM8.5 3.5h5v3h-5zM5.5 9.5h5v3h-5z" /></svg>
    case 'code':
      return <svg {...common}><path d="M6 4 3.5 8 6 12M10 4 12.5 8 10 12M8.8 3.5 7.2 12.5" /></svg>
    case 'bug':
      return <svg {...common}><path d="M5.5 6.5h5v4h-5z" /><path d="M6.5 4.5h3M8 2.8v1.7M4 6l1.5 1M12 6l-1.5 1M4 10l1.5-1M12 10l-1.5-1" /></svg>
    case 'sliders':
      return <svg {...common}><path d="M3 4.5h10M3 11.5h10M6 3v3M10 10v3" /></svg>
    case 'close':
      return <svg {...common}><path d="M4 4 12 12M12 4 4 12" /></svg>
    case 'chevron-down':
      return <svg {...common}><path d="M4 6.5 8 10.5l4-4" /></svg>
    case 'chevron-up':
      return <svg {...common}><path d="M4 9.5 8 5.5l4 4" /></svg>
    case 'move-up':
      return <svg {...common}><path d="M8 12.5v-8" /><path d="M4.5 6 8 2.5 11.5 6" /></svg>
    case 'move-down':
      return <svg {...common}><path d="M8 3.5v8" /><path d="M4.5 10 8 13.5 11.5 10" /></svg>
    case 'refresh':
      return <svg {...common}><path d="M12 6V3.5H9.5M4 10v2.5h2.5" /><path d="M11.2 4.8A4.5 4.5 0 0 0 4 6.5M4.8 11.2A4.5 4.5 0 0 0 12 9.5" /></svg>
    case 'moon':
      return <svg {...common}><path d="M10.8 2.8A5.5 5.5 0 1 0 13.2 11 4.8 4.8 0 0 1 10.8 2.8z" /></svg>
    case 'plus':
      return <svg {...common}><path d="M8 3v10M3 8h10" /></svg>
  }
}
