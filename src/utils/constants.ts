import * as vscode from 'vscode'

const DOCUMENT_SELECTOR = { scheme: 'file', language: 'markdown' }
const ENVIRONMENT_LOCALE = vscode.env.language || 'en'
const MACRO_REGEX = /\{\{\s*([A-Za-z0-9_\-]+)(?:\s*\(([^}]*)\))?\s*\}\}/g

const getMacroText = (text: string): RegExpExecArray | null => {
  return MACRO_REGEX.exec(text)
}

export { DOCUMENT_SELECTOR, ENVIRONMENT_LOCALE, MACRO_REGEX, getMacroText }
