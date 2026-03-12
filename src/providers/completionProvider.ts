import * as vscode from 'vscode'
import { getKnownMacros } from '../macros'
import { ENVIRONMENT_LOCALE } from '../utils/constants'
import type { MacroDefinition } from '../types/macro'

const shouldTriggerCompletion = (document: vscode.TextDocument, position: vscode.Position): boolean => {
  const prefix = document.lineAt(position.line).text.substring(0, position.character)
  return /\{\{\s*$/.test(prefix)
}

const hasClosingImmediately = (document: vscode.TextDocument, position: vscode.Position): boolean => {
  const offset = document.offsetAt(position)
  const docText = document.getText()
  const remaining = docText.substring(offset, Math.min(offset + 16, docText.length))
  return /^\}\}/.test(remaining)
}

const selectionContainsClosing = (document: vscode.TextDocument): boolean => {
  const sel = vscode.window.activeTextEditor?.selection
  return !!sel && !sel.isEmpty && document.getText(sel).includes('}}')
}

const buildParamsSnippet = (paramsDef: MacroDefinition['params'] | undefined): string => {
  if (!paramsDef || paramsDef.length === 0) return ''
  return paramsDef.map((p, i) => {
    const idx = i + 1
    if (p.type === 'enum' && p.allowedValues && p.allowedValues.length) {
      const choices = p.allowedValues.map((v) => v.replace(/\s+/g, '_')).join(',')
      return `"${'${' + idx + '|' + choices + '|}'}"`
    }
    if (p.type === 'string') return `"${'${' + idx + ':' + p.name + '}'}"`
    return `${'${' + idx + ':' + p.name + '}'} `
  }).join(', ')
}

const makeCompletionItem = (key: string, def: MacroDefinition, shouldAppendClosing: boolean): vscode.CompletionItem => {
  const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Function)
  item.detail = def.description
  const paramsSnippet = buildParamsSnippet(def.params)
  const hasParams = paramsSnippet.length > 0
  const insertSnippet = hasParams
    ? (shouldAppendClosing ? `${key}(${paramsSnippet})}}` : `${key}(${paramsSnippet})`)
    : (shouldAppendClosing ? `${key}}}` : `${key}`)
  item.insertText = new vscode.SnippetString(insertSnippet)
  return item
}

const completionProvider: vscode.CompletionItemProvider = {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (!shouldTriggerCompletion(document, position)) return []
    const KNOWN_MACROS = getKnownMacros(ENVIRONMENT_LOCALE)

    const closingExistsStrict = hasClosingImmediately(document, position)
    const selectionHasClosing = selectionContainsClosing(document)

    const entries = Object.entries(KNOWN_MACROS).filter(([, def]) => !def.deprecated)

    return entries.map(([key, def]) => makeCompletionItem(key, def, !(closingExistsStrict || selectionHasClosing)))
  }
}

export { completionProvider }
