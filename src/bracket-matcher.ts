import type { editor } from 'monaco-editor-core'
import type { TextDocument, Position } from './find-matching-brackets'
import { findMatchingBrackets } from './find-matching-brackets'

/**
 * Injects CSS styles for bracket matching into the document if not already present.
 * Uses Monaco's standard bracket matching colors for visual consistency.
 */
function injectStyles() {
  const styleId = 'mdc-bracket-matcher-styles'

  // Check if running in browser environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (globalThis as any).document
  if (typeof doc === 'undefined') {
    return
  }

  // Check if styles already injected
  if (doc.getElementById(styleId)) {
    return
  }

  const style = doc.createElement('style')
  style.id = styleId
  style.textContent = `
    .mdc-bracket-match {
      background-color: rgba(0, 122, 204, 0.1) !important;
      border: 1px solid rgba(0, 122, 204, 0.8) !important;
      box-sizing: border-box !important;
    }

    .mdc-bracket-match-inline {
      font-weight: 600;
    }
  `

  doc.head.appendChild(style)
}

/**
 * Options for customizing bracket matcher appearance and behavior.
 */
export interface BracketMatcherOptions {
  /**
   * CSS class name for matched bracket decorations.
   * If not provided, default styles will be used.
   * @default 'mdc-bracket-match'
   */
  className?: string

  /**
   * Inline CSS class name for matched bracket decorations.
   * @default 'mdc-bracket-match-inline'
   */
  inlineClassName?: string

  /**
   * Whether to automatically inject default styles into the document.
   * Set to false if you want to provide your own CSS.
   * @default true
   */
  injectStyles?: boolean

  /**
   * Maximum number of lines to scan for bracket matching.
   * Bracket matching will be disabled for documents exceeding this limit
   * to maintain performance. Set to 0 to disable the limit.
   * @default 5000
   */
  maxLineCount?: number
}

/**
 * Disposable object for cleaning up bracket matcher resources.
 */
export interface BracketMatcherDisposable {
  /**
   * Removes all event listeners and decorations.
   */
  dispose: () => void
}

const DEFAULT_OPTIONS: Required<BracketMatcherOptions> = {
  className: 'mdc-bracket-match',
  inlineClassName: 'mdc-bracket-match-inline',
  injectStyles: true,
  maxLineCount: 5000,
}

/**
 * Registers a bracket matcher for MDC block components in Monaco Editor.
 *
 * The bracket matcher highlights matching opening and closing `::` markers when the cursor
 * is adjacent to them. It automatically injects the necessary CSS styles unless disabled.
 *
 * @example
 * ```typescript
 * import { registerBracketMatcher } from '@nuxtlabs/monarch-mdc'
 *
 * const disposable = registerBracketMatcher(editor, {
 *   injectStyles: true, // default
 *   maxLineCount: 5000, // default, disables for large documents
 * })
 *
 * // Clean up when done
 * disposable.dispose()
 * ```
 *
 * @param monacoEditor - The Monaco editor instance to attach the bracket matcher to
 * @param options - Configuration options for the bracket matcher
 * @returns A disposable object that can be used to clean up the bracket matcher
 */
export function registerBracketMatcher(
  monacoEditor: editor.ICodeEditor,
  options?: BracketMatcherOptions,
): BracketMatcherDisposable {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Inject default styles if enabled
  if (opts.injectStyles) {
    injectStyles()
  }

  let decorations: string[] = []

  /**
   * Adapts Monaco's ITextModel to the TextDocument interface.
   */
  function createTextDocument(model: editor.ITextModel): TextDocument {
    return {
      getLine: (lineNumber: number) => model.getLineContent(lineNumber + 1), // Monaco uses 1-based line numbers
      lineCount: model.getLineCount(),
    }
  }

  /**
   * Adapts Monaco's Position to the Position interface.
   */
  function createPosition(position: { lineNumber: number, column: number }): Position {
    return {
      line: position.lineNumber - 1, // Convert to 0-based
      column: position.column - 1, // Convert to 0-based
    }
  }

  /**
   * Update bracket decorations based on cursor position.
   */
  function updateBracketDecorations(position: { lineNumber: number, column: number }) {
    try {
      const model = monacoEditor.getModel()
      if (!model) {
        return
      }

      // Performance safeguard: skip bracket matching for very large documents
      if (opts.maxLineCount > 0 && model.getLineCount() > opts.maxLineCount) {
        // Clear any existing decorations
        decorations = model.deltaDecorations(decorations, [])
        return
      }

      // Adapt Monaco types to editor-agnostic interfaces
      const document = createTextDocument(model)
      const pos = createPosition(position)
      const match = findMatchingBrackets(document, pos)

      if (!match) {
        // Clear decorations if no match found
        decorations = model.deltaDecorations(decorations, [])
        return
      }

      // Create decoration options - always use CSS classes for styling
      const decorationOptions: editor.IModelDecorationOptions = {
        className: opts.className,
        inlineClassName: opts.inlineClassName,
        stickiness: 1, // TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }

      // Apply decorations to both opening and closing brackets (convert 0-based to 1-based)
      decorations = model.deltaDecorations(decorations, [
        {
          range: {
            startLineNumber: match.opening.startLine + 1,
            startColumn: match.opening.startColumn + 1,
            endLineNumber: match.opening.endLine + 1,
            endColumn: match.opening.endColumn + 1,
          },
          options: decorationOptions,
        },
        {
          range: {
            startLineNumber: match.closing.startLine + 1,
            startColumn: match.closing.startColumn + 1,
            endLineNumber: match.closing.endLine + 1,
            endColumn: match.closing.endColumn + 1,
          },
          options: decorationOptions,
        },
      ])
    }
    catch (error) {
      // Fail silently to avoid breaking the editor
      console.warn('[MDC Bracket Matcher] Error updating decorations:', error)
      // Clear any existing decorations on error
      const model = monacoEditor.getModel()
      if (model && decorations.length > 0) {
        decorations = model.deltaDecorations(decorations, [])
      }
    }
  }

  // Listen to cursor position changes
  const cursorDisposable = monacoEditor.onDidChangeCursorPosition((e) => {
    updateBracketDecorations(e.position)
  })

  // Initial update based on current cursor position
  const currentPosition = monacoEditor.getPosition()
  if (currentPosition) {
    updateBracketDecorations(currentPosition)
  }

  // Return disposable
  return {
    dispose: () => {
      cursorDisposable.dispose()

      const model = monacoEditor.getModel()
      if (model) {
        model.deltaDecorations(decorations, [])
      }
      decorations = []
    },
  }
}
