import { useRef, useEffect, useCallback, useState } from 'react'

// ---------------------------------------------------------------------------
// Token types and VS Code Dark+ colour palette
// ---------------------------------------------------------------------------
type TokenType =
  | 'keyword' | 'control' | 'string' | 'template' | 'comment'
  | 'number' | 'type' | 'function' | 'decorator' | 'operator'
  | 'punctuation' | 'property' | 'regex' | 'default'

const COLORS: Record<TokenType, string> = {
  keyword:     '#569CD6',
  control:     '#C586C0',
  string:      '#CE9178',
  template:    '#CE9178',
  comment:     '#6A9955',
  number:      '#B5CEA8',
  type:        '#4EC9B0',
  function:    '#DCDCAA',
  decorator:   '#DCDCAA',
  operator:    '#D4D4D4',
  punctuation: '#D4D4D4',
  property:    '#9CDCFE',
  regex:       '#D16969',
  default:     '#D4D4D4',
}

// ---------------------------------------------------------------------------
// Tokeniser — single‑pass regex scanner for TS / JS / Playwright
// ---------------------------------------------------------------------------
const KEYWORDS = new Set([
  'import','export','from','const','let','var','function','return',
  'class','extends','implements','new','typeof','instanceof','of','in',
  'async','await','yield','static','get','set','declare','readonly',
  'abstract','override','public','private','protected','namespace','module',
  'enum','as','is','keyof','infer','satisfies',
])

const CONTROL = new Set([
  'if','else','for','while','do','switch','case','break','continue',
  'throw','try','catch','finally','default','with',
])

const TYPES = new Set([
  'string','number','boolean','void','null','undefined','never','any',
  'unknown','object','symbol','bigint','true','false','this','super',
  'type','interface','Promise','Record','Partial','Required','Omit','Pick',
  'Array','Map','Set','Date','Error','RegExp','Function','Readonly',
  'JSX','Element',
])

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightCode(code: string): string {
  // Order matters: longer / greedier patterns first
  const TOKEN_RE = new RegExp([
    '(\\/\\/[^\\n]*)',                             // single-line comment
    '(\\/\\*[\\s\\S]*?\\*\\/)',                    // multi-line comment
    '(`(?:[^`\\\\]|\\\\.)*`)',                     // template literal
    '("(?:[^"\\\\\\n]|\\\\.)*")',                  // double-quoted string
    "('(?:[^'\\\\\\n]|\\\\.)*')",                  // single-quoted string
    '(\\/(?![\\/*])(?:[^\\/\\\\\\n]|\\\\.)+\\/[gimsuy]*)', // regex
    '(@\\w+)',                                     // decorator
    '(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)', // number
    '(\\b[A-Z][A-Za-z0-9_]*\\b)',                  // PascalCase → type
    '(\\b[a-zA-Z_$][\\w$]*(?=\\s*\\())',           // identifier followed by ( → function
    '(\\b[a-zA-Z_$][\\w$]*\\b)',                   // plain identifier
    '([{}()\\[\\];,.])',                            // punctuation
    '([+\\-*/%=<>!&|^~?:]+)',                      // operators
  ].join('|'), 'gm')

  let result = ''
  let lastIndex = 0

  for (const m of code.matchAll(TOKEN_RE)) {
    // Anything between matches (whitespace) goes through verbatim
    if (m.index! > lastIndex) {
      result += escapeHtml(code.slice(lastIndex, m.index!))
    }
    lastIndex = m.index! + m[0].length

    const raw = m[0]
    let type: TokenType = 'default'

    if (m[1] || m[2]) {
      type = 'comment'
    } else if (m[3] || m[4] || m[5]) {
      type = 'string'
    } else if (m[6]) {
      type = 'regex'
    } else if (m[7]) {
      type = 'decorator'
    } else if (m[8]) {
      type = 'number'
    } else if (m[9]) {
      // PascalCase — check known types first
      type = TYPES.has(raw) ? 'type' : 'type'
    } else if (m[10]) {
      type = 'function'
    } else if (m[11]) {
      if (KEYWORDS.has(raw)) type = 'keyword'
      else if (CONTROL.has(raw)) type = 'control'
      else if (TYPES.has(raw)) type = 'type'
      else type = 'property'
    } else if (m[12]) {
      type = 'punctuation'
    } else if (m[13]) {
      type = 'operator'
    }

    result += `<span style="color:${COLORS[type]}">${escapeHtml(raw)}</span>`
  }

  // Trailing content
  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex))
  }

  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type Props = {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  /** called when content doesn't match the original */
  onDirtyChange?: (dirty: boolean) => void
  /** height of the editor — defaults to 100% */
  height?: string | number
}

export function CodeEditor({ value, onChange, readOnly, onDirtyChange, height = '100%' }: Props): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [lineCount, setLineCount] = useState(1)
  const [highlighted, setHighlighted] = useState('')
  const originalRef = useRef(value)

  // Store original for dirty tracking
  useEffect(() => {
    originalRef.current = value
  }, [value])

  // Highlight whenever value changes
  useEffect(() => {
    setHighlighted(highlightCode(value))
    setLineCount(value.split('\n').length)
  }, [value])

  // Sync scroll between textarea and pre
  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    onChange?.(v)
    onDirtyChange?.(v !== originalRef.current)
  }, [onChange, onDirtyChange])

  // Handle Tab key → insert 2 spaces instead of losing focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = ta.value.substring(0, start) + '  ' + ta.value.substring(end)
      // Use native setter to trigger React's change event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set
      nativeInputValueSetter?.call(ta, newVal)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      // Restore cursor
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2
        ta.selectionEnd = start + 2
      })
    }
  }, [])

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="code-editor-root" style={{ height }}>
      {/* Line number gutter */}
      <div className="code-editor-gutter" ref={gutterRef}>
        {lineNumbers.map((n) => (
          <div key={n} className="code-editor-line-num">{n}</div>
        ))}
      </div>

      {/* Code area — pre behind, textarea on top */}
      <div className="code-editor-content">
        <pre
          ref={preRef}
          className="code-editor-highlight"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          aria-hidden
        />
        <textarea
          ref={textareaRef}
          className="code-editor-textarea"
          value={value}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          data-gramm="false"
        />
      </div>
    </div>
  )
}
