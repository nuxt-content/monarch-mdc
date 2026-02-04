/**
 * !Important: The exported functions in this file are also utilized in
 * the `@nuxtlabs/vscode-mdc` VSCode extension https://github.com/nuxtlabs/vscode-mdc.
 *
 * Any changes to the function signatures or behavior should be tested and verified in the extension.
 */

/** Represents a text document, providing methods to access its content. */
export interface TextDocument {
  /**
   * Retrieves the content of a specific line in the document.
   * @param lineNumber - The zero-based line number to retrieve.
   * @returns The content of the specified line.
   */
  getLine: (lineNumber: number) => string

  /** The total number of lines in the document. */
  lineCount: number
}

/**
 * Represents a position in a text document (line and column).
 */
export interface Position {
  /** Line number (zero-based). */
  line: number
  /** Column number (zero-based). */
  column: number
}

/**
 * Represents a range in a text document.
 */
export interface Range {
  /** Starting line number (zero-based). */
  startLine: number
  /** Starting column number (zero-based). */
  startColumn: number
  /** Ending line number (zero-based). */
  endLine: number
  /** Ending column number (zero-based). */
  endColumn: number
}

/**
 * Represents a matched bracket pair with their positions.
 */
export interface BracketMatch {
  /** Range of the opening bracket (e.g., `::component-name`) */
  opening: Range
  /** Range of the closing bracket (e.g., `::`) */
  closing: Range
  /** Number of colons in the matched pair */
  colonCount: number
}

/**
 * Internal representation of a block component bracket.
 */
interface BracketBlock {
  line: number
  colonCount: number
  isOpening: boolean
  /** For opening brackets, the tag name; for closing brackets, null */
  tagName: string | null
}

/**
 * Finds matching MDC block component brackets (:: markers) when cursor is adjacent to one.
 *
 * @param document - The text document to search
 * @param position - The current cursor position
 * @returns The matched bracket pair if found, otherwise null
 */
export function findMatchingBrackets(
  document: TextDocument,
  position: Position,
): BracketMatch | null {
  try {
    const lineContent = document.getLine(position.line)

    // Check if cursor is adjacent to a :: marker
    const bracketAtCursor = detectBracketAtPosition(lineContent, position.column)

    if (!bracketAtCursor) {
      return null
    }

    // Build a map of all brackets in the document
    const brackets = scanAllBrackets(document)
    if (brackets.length === 0) {
      return null
    }

    // Find the current bracket in our list
    const currentBracketIndex = brackets.findIndex(
      b => b.line === position.line,
    )
    if (currentBracketIndex === -1) {
      return null
    }

    const currentBracket = brackets[currentBracketIndex]
    const matchingBracket = findMatchingBracket(brackets, currentBracketIndex)

    if (!matchingBracket) {
      return null
    }

    // Return the match with brackets in correct order
    return {
      opening: createBracketRange(
        document,
        currentBracket.isOpening ? currentBracket : matchingBracket,
      ),
      closing: createBracketRange(
        document,
        currentBracket.isOpening ? matchingBracket : currentBracket,
      ),
      colonCount: currentBracket.colonCount,
    }
  }
  catch (error) {
    // Fail silently to avoid breaking the editor
    console.warn('[MDC Bracket Matcher] Error finding matching brackets:', error)
    return null
  }
}

/**
 * Detects if the cursor is adjacent to a :: marker and returns its colon count.
 *
 * Checks for:
 * - Opening brackets: `::component-name` (cursor anywhere on the line)
 * - Closing brackets: `::` alone (cursor within or adjacent to colons)
 *
 * @returns Object with colon count if cursor is on a bracket, null otherwise
 */
function detectBracketAtPosition(
  lineContent: string,
  column: number,
): { colonCount: number } | null {
  // Check for opening bracket: ::component-name
  const openingMatch = lineContent.match(/^\s*(:{2,})([\w-]+)/)
  if (openingMatch) {
    const colonCount = openingMatch[1].length
    const colonStart = openingMatch.index! + openingMatch[0].indexOf(openingMatch[1])
    const componentNameEnd = colonStart + openingMatch[1].length + openingMatch[2].length

    // Cursor should be within or adjacent to the colons or component name
    if (column >= colonStart && column <= componentNameEnd) {
      return { colonCount }
    }
  }

  // Check for closing bracket: ::
  const closingMatch = lineContent.match(/^\s*(:{2,})\s*$/)
  if (closingMatch) {
    const colonCount = closingMatch[1].length
    const colonStart = closingMatch.index! + closingMatch[0].indexOf(closingMatch[1])
    const colonEnd = colonStart + colonCount

    // Cursor should be within or adjacent to the colons
    if (column >= colonStart && column <= colonEnd) {
      return { colonCount }
    }
  }

  return null
}

/**
 * Scans the entire document for all block component brackets.
 *
 * Note: This performs a full document scan on each cursor movement.
 * For large documents, this could be optimized by caching results
 * and incrementally updating on document changes.
 */
function scanAllBrackets(document: TextDocument): BracketBlock[] {
  const brackets: BracketBlock[] = []
  let insideCodeBlock = false

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
    const lineContent = document.getLine(lineNumber)
    const trimmed = lineContent.trim()

    // Check for code block markers
    if (/^\s*(?:`{3,}|~{3,})/.test(trimmed)) {
      insideCodeBlock = !insideCodeBlock
      continue
    }

    // Skip lines inside markdown code blocks
    if (insideCodeBlock) {
      continue
    }

    // Match opening brackets: ::component-name
    const openingMatch = trimmed.match(/^(:{2,})([\w-]+)/)
    if (openingMatch) {
      brackets.push({
        line: lineNumber,
        colonCount: openingMatch[1].length,
        isOpening: true,
        tagName: openingMatch[2],
      })
      continue
    }

    // Match closing brackets: ::
    const closingMatch = trimmed.match(/^(:{2,})$/)
    if (closingMatch) {
      brackets.push({
        line: lineNumber,
        colonCount: closingMatch[1].length,
        isOpening: false,
        tagName: null,
      })
    }
  }

  return brackets
}

/**
 * Finds the matching bracket for a given bracket using stack-based matching.
 * Only matches brackets with identical colon counts (:: matches :: but not :::).
 *
 * Algorithm:
 * - For opening brackets: scan forward, using a stack to track nesting
 * - For closing brackets: scan backward, using a stack to track nesting
 * - Pop from stack when matching colon count is found
 * - Return match when stack is empty
 */
function findMatchingBracket(
  brackets: BracketBlock[],
  currentIndex: number,
): BracketBlock | null {
  const currentBracket = brackets[currentIndex]

  if (currentBracket.isOpening) {
    // Find matching closing bracket forward
    const stack: BracketBlock[] = [currentBracket]

    for (let i = currentIndex + 1; i < brackets.length; i++) {
      const bracket = brackets[i]

      if (bracket.isOpening) {
        stack.push(bracket)
      }
      else {
        const lastOpening = stack[stack.length - 1]
        if (lastOpening && lastOpening.colonCount === bracket.colonCount) {
          stack.pop()
          if (stack.length === 0) {
            return bracket
          }
        }
      }
    }
  }
  else {
    // Find matching opening bracket backward
    const stack: BracketBlock[] = [currentBracket]

    for (let i = currentIndex - 1; i >= 0; i--) {
      const bracket = brackets[i]

      if (!bracket.isOpening) {
        stack.push(bracket)
      }
      else {
        const lastClosing = stack[stack.length - 1]
        if (lastClosing && lastClosing.colonCount === bracket.colonCount) {
          stack.pop()
          if (stack.length === 0) {
            return bracket
          }
        }
      }
    }
  }

  return null
}

/**
 * Creates a Range for a bracket.
 *
 * For opening brackets, includes the colons and component name (e.g., `::component-name`).
 * For closing brackets, includes only the colons (e.g., `::`).
 */
function createBracketRange(
  document: TextDocument,
  bracket: BracketBlock,
): Range {
  const lineNumber = bracket.line
  const lineContent = document.getLine(lineNumber)

  if (bracket.isOpening) {
    // Match the colons and component name
    const match = lineContent.match(/(:{2,})([\w-]+)/)
    if (match) {
      const startColumn = lineContent.indexOf(match[0])
      const endColumn = startColumn + match[0].length
      return {
        startLine: lineNumber,
        startColumn,
        endLine: lineNumber,
        endColumn,
      }
    }
  }
  else {
    // Match just the colons
    const match = lineContent.match(/(:{2,})$/)
    if (match) {
      const startColumn = lineContent.lastIndexOf(match[0])
      const endColumn = startColumn + match[0].length
      return {
        startLine: lineNumber,
        startColumn,
        endLine: lineNumber,
        endColumn,
      }
    }
  }

  // Fallback to entire line
  return {
    startLine: lineNumber,
    startColumn: 0,
    endLine: lineNumber,
    endColumn: lineContent.length,
  }
}
