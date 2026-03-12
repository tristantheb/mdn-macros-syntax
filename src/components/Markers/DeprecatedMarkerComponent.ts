import * as vscode from 'vscode'
import { getMacroText, ENVIRONMENT_LOCALE } from '../../utils/constants'
import { getKnownMacros } from '../../macros'

class DeprecatedMarkerComponent {
  highlightDeco: vscode.TextEditorDecorationType
  labelDeco: vscode.TextEditorDecorationType

  constructor() {
    this.highlightDeco = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255 75 80 / 12%)',
      border: '1px solid rgba(255 75 80 / 28%)',
      borderRadius: '3px'
    })

    this.labelDeco = vscode.window.createTextEditorDecorationType({
      after: { contentText: 'DEPRECATED', color: '#ff4d4f', margin: '0 0 0 8px', fontWeight: '600' },
      isWholeLine: false
    })
  }

  activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.highlightDeco, this.labelDeco)

    const update = (editor: vscode.TextEditor | undefined): void => {
      if (!editor) return
      const doc = editor.document
      if (doc.languageId !== 'markdown') return

      const text = doc.getText()
      const highlightRanges: vscode.Range[] = []
      const labelRanges: vscode.Range[] = []
      let match: RegExpExecArray | null
      const KNOWN = getKnownMacros(ENVIRONMENT_LOCALE)
      while ((match = getMacroText(text)) !== null) {
        const name = match[1]
        const meta = KNOWN[name]
        if (meta && meta.deprecated) {
          const startPos = doc.positionAt(match.index)
          const endPos = doc.positionAt(match.index + match[0].length)
          // highlight entire macro
          highlightRanges.push(new vscode.Range(startPos, endPos))
          // place label after closing braces (zero-length range at end)
          labelRanges.push(new vscode.Range(endPos, endPos))
        }
      }

      editor.setDecorations(this.highlightDeco, highlightRanges)
      editor.setDecorations(this.labelDeco, labelRanges)
    }

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => update(e)))
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
      if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
        update(vscode.window.activeTextEditor)
      }
    }))

    update(vscode.window.activeTextEditor)
  }

  update(editor: vscode.TextEditor | undefined): void {
    if (!editor) return
    const doc = editor.document
    if (doc.languageId !== 'markdown') return

    const text = doc.getText()
    const highlightRanges: vscode.Range[] = []
    const labelRanges: vscode.Range[] = []
    let match: RegExpExecArray | null
    const KNOWN = getKnownMacros(ENVIRONMENT_LOCALE)
    while ((match = getMacroText(text)) !== null) {
      const name = match[1]
      const meta = KNOWN[name]
      if (meta && meta.deprecated) {
        const startPos = doc.positionAt(match.index)
        const endPos = doc.positionAt(match.index + match[0].length)
        // highlight entire macro
        highlightRanges.push(new vscode.Range(startPos, endPos))
        // place label after closing braces (zero-length range at end)
        labelRanges.push(new vscode.Range(endPos, endPos))
      }
    }

    editor.setDecorations(this.highlightDeco, highlightRanges)
    editor.setDecorations(this.labelDeco, labelRanges)
  }
}

export { DeprecatedMarkerComponent }
