import { getMacroText } from './constants'

/**
 * Result of parsing a macro occurrence inside text.
 */
interface MacroParseResult {
  name: string;
  args: string[];
  start: number;
  end: number;
}

/**
 * Remove surrounding matching single or double quotes from a string.
 * Only removes quotes when both ends match.
 */
const stripMatchingQuotes = (s: string): string => {
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return s.substring(1, s.length - 1).trim()
    }
  }
  return s.trim()
}

/**
 * Split argument list while preserving empty slots.
 */
const splitArgsPreserveEmpty = (rawArgs: string): string[] => {
  if (!rawArgs || rawArgs.length === 0) return []
  const result: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < rawArgs.length; i++) {
    const ch = rawArgs[i]

    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle
      current += ch
      continue
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      current += ch
      continue
    }

    if (ch === ',' && !inSingle && !inDouble) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  // push last entry (may be empty string)
  result.push(current.trim())

  // strip matching quotes from each argument
  return result.map(stripMatchingQuotes)
}

/**
 * Find a macro that contains the given offset and return its parsed name/args
 * and positions.
 */
const parseMacroAtOffset = (text: string, offset: number): MacroParseResult | undefined => {
  let match: RegExpExecArray | null

  while ((match = getMacroText(text)) !== null) {
    const start = match.index
    const end = match.index + match[0].length
    if (offset >= start && offset <= end) {
      const rawArgs = match[2] || ''
      const args = rawArgs.trim().length ? splitArgsPreserveEmpty(rawArgs) : []
      return { name: match[1], args, start, end }
    }
  }

  return undefined
}

export { splitArgsPreserveEmpty, parseMacroAtOffset }
