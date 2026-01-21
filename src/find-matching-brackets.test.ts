import { describe, it, expect } from 'vitest'
import { findMatchingBrackets, type TextDocument, type Position } from './find-matching-brackets'

/**
 * Creates a simple TextDocument implementation from a string.
 */
function createDocument(content: string): TextDocument {
  const lines = content.split('\n')
  return {
    getLine: (lineNumber: number) => lines[lineNumber] || '',
    lineCount: lines.length,
  }
}

describe('findMatchingBrackets', () => {
  describe('basic bracket matching', () => {
    it('matches simple opening and closing brackets', () => {
      const doc = createDocument('::component\nSome content\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(2)
      expect(result?.colonCount).toBe(2)
    })

    it('matches brackets when cursor is on closing bracket', () => {
      const doc = createDocument('::component\nContent\n::')
      const position: Position = { line: 2, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(2)
    })

    it('returns null when cursor is not on a bracket', () => {
      const doc = createDocument('::component\nSome content\n::')
      const position: Position = { line: 1, column: 5 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })

    it('returns null when there is no matching bracket', () => {
      const doc = createDocument('::component\nSome content')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })
  })

  describe('nested brackets', () => {
    it('matches nested brackets with same colon count', () => {
      const doc = createDocument('::outer\n::inner\nContent\n::\n::')
      const position: Position = { line: 1, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(1)
      expect(result?.closing.startLine).toBe(3)
    })

    it('matches outer bracket correctly', () => {
      const doc = createDocument('::outer\n::inner\nContent\n::\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(4)
    })

    it('matches brackets with different colon counts (triple colons)', () => {
      const doc = createDocument(':::outer\n::inner\nContent\n::\n:::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(4)
      expect(result?.colonCount).toBe(3)
    })

    it('does not match brackets with different colon counts', () => {
      const doc = createDocument('::component\n:::\nContent\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      // Should skip the ::: and find the ::
      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(3)
      expect(result?.colonCount).toBe(2)
    })
  })

  describe('deeply nested structures', () => {
    it('matches deeply nested brackets correctly', () => {
      const doc = createDocument(
        '::level1\n::level2\n::level3\nContent\n::\n::\n::',
      )

      // Match innermost bracket
      const innerResult = findMatchingBrackets(doc, { line: 2, column: 0 })
      expect(innerResult?.opening.startLine).toBe(2)
      expect(innerResult?.closing.startLine).toBe(4)

      // Match middle bracket
      const middleResult = findMatchingBrackets(doc, { line: 1, column: 0 })
      expect(middleResult?.opening.startLine).toBe(1)
      expect(middleResult?.closing.startLine).toBe(5)

      // Match outermost bracket
      const outerResult = findMatchingBrackets(doc, { line: 0, column: 0 })
      expect(outerResult?.opening.startLine).toBe(0)
      expect(outerResult?.closing.startLine).toBe(6)
    })

    it('handles complex nesting with mixed colon counts', () => {
      const doc = createDocument(
        ':::outer\n::inner1\nContent\n::\n::inner2\nMore content\n::\n:::',
      )

      // Match first inner bracket
      const inner1Result = findMatchingBrackets(doc, { line: 1, column: 0 })
      expect(inner1Result?.opening.startLine).toBe(1)
      expect(inner1Result?.closing.startLine).toBe(3)

      // Match second inner bracket
      const inner2Result = findMatchingBrackets(doc, { line: 4, column: 0 })
      expect(inner2Result?.opening.startLine).toBe(4)
      expect(inner2Result?.closing.startLine).toBe(6)

      // Match outer bracket
      const outerResult = findMatchingBrackets(doc, { line: 0, column: 0 })
      expect(outerResult?.opening.startLine).toBe(0)
      expect(outerResult?.closing.startLine).toBe(7)
      expect(outerResult?.colonCount).toBe(3)
    })
  })

  describe('code blocks', () => {
    it('ignores brackets inside code blocks', () => {
      const doc = createDocument(
        '::component\n```\n::fake-component\n::\n```\n::',
      )
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      // Should skip the brackets inside the code block
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(5)
    })

    it('ignores brackets inside tilde code blocks', () => {
      const doc = createDocument(
        '::component\n~~~\n::fake-component\n::\n~~~\n::',
      )
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(5)
    })
  })

  describe('cursor position detection', () => {
    it('detects bracket when cursor is at the start of opening bracket', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })

    it('detects bracket when cursor is in the middle of component name', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 0, column: 5 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })

    it('detects bracket when cursor is at end of component name', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 0, column: 11 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })

    it('detects closing bracket when cursor is on colons', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 1, column: 1 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })

    it('does not detect bracket when cursor is after component name', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 0, column: 12 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })
  })

  describe('whitespace handling', () => {
    it('handles opening brackets with leading whitespace', () => {
      const doc = createDocument('  ::component\nContent\n  ::')
      const position: Position = { line: 0, column: 2 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(2)
    })

    it('handles closing brackets with leading and trailing whitespace', () => {
      const doc = createDocument('::component\nContent\n  ::  ')
      const position: Position = { line: 2, column: 2 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startLine).toBe(0)
      expect(result?.closing.startLine).toBe(2)
    })
  })

  describe('component names', () => {
    it('matches components with hyphens in name', () => {
      const doc = createDocument('::my-component\nContent\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startColumn).toBe(0)
      expect(result?.opening.endColumn).toBe(14) // length of "::my-component"
    })

    it('matches components with numbers in name', () => {
      const doc = createDocument('::component123\nContent\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })

    it('matches components with underscores in name', () => {
      const doc = createDocument('::my_component\nContent\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles empty document', () => {
      const doc = createDocument('')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })

    it('handles document with only opening bracket', () => {
      const doc = createDocument('::component')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })

    it('handles document with only closing bracket', () => {
      const doc = createDocument('::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })

    it('handles mismatched nesting', () => {
      const doc = createDocument('::outer\n::inner\n::') // Missing closing for inner
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      // Inner bracket steals the only closing bracket, so outer has no match
      expect(result).toBeNull()
    })

    it('returns null on error and logs warning', () => {
      // Create a document that will cause an error during processing
      const doc: TextDocument = {
        getLine: () => {
          throw new Error('Simulated error')
        },
        lineCount: 1,
      }
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).toBeNull()
    })
  })

  describe('range calculations', () => {
    it('calculates correct ranges for opening bracket', () => {
      const doc = createDocument('::component\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening).toEqual({
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 11, // length of "::component"
      })
    })

    it('calculates correct ranges for closing bracket', () => {
      const doc = createDocument('::component\nContent\n::')
      const position: Position = { line: 0, column: 0 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.closing).toEqual({
        startLine: 2,
        startColumn: 0,
        endLine: 2,
        endColumn: 2, // length of "::"
      })
    })

    it('calculates correct ranges with leading whitespace', () => {
      const doc = createDocument('  ::component\nContent\n  ::')
      const position: Position = { line: 0, column: 2 }

      const result = findMatchingBrackets(doc, position)

      expect(result).not.toBeNull()
      expect(result?.opening.startColumn).toBe(2)
      expect(result?.opening.endColumn).toBe(13) // 2 (whitespace) + 11 (::component)
      expect(result?.closing.startColumn).toBe(2)
      expect(result?.closing.endColumn).toBe(4) // 2 (whitespace) + 2 (::)
    })
  })
})
