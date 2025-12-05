import * as vscode from 'vscode'
import { join as pathJoin } from 'path'
import { DecorationComponent } from './DecorationComponent'

class CodeBlockDecorationsComponent extends DecorationComponent {
  // Keywords mapping to icon filenames and background colors
  KEYWORD_CONFIG: { [key: string]: { icon: string; color: string } } = {
    'example-good': { icon: 'check.svg', color: 'rgb(76 175 80 / 12%)' },
    'example-bad': { icon: 'x.svg', color: 'rgb(244 67 54 / 12%)' },
    'interactive-example': { icon: 'console.svg', color: 'rgb(33 150 243 / 12%)' }
  }

  getDecorations(context: vscode.ExtensionContext): { [k: string]: vscode.TextEditorDecorationType } {
    const decorations: { [k: string]: vscode.TextEditorDecorationType } = {}
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
      || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast

    for (const k of Object.keys(this.KEYWORD_CONFIG)) {
      const cfg = this.KEYWORD_CONFIG[k]
      const lightPath = vscode.Uri.file(pathJoin(context.extensionPath, 'resources', 'light', cfg.icon))
      const darkPath = vscode.Uri.file(pathJoin(context.extensionPath, 'resources', 'dark', cfg.icon))
      const chosen: vscode.Uri = isDark ? darkPath : lightPath

      // Only add background if color is defined
      if (cfg.color) {
        decorations[`${k}-bg`] = vscode.window.createTextEditorDecorationType({
          backgroundColor: cfg.color,
          isWholeLine: true
        })
      }
      // Only add icon if icon is defined
      if (cfg.icon) {
        decorations[`${k}-icon`] = vscode.window.createTextEditorDecorationType({
          gutterIconPath: chosen,
          gutterIconSize: '16px'
        })
      }
    }
    return decorations
  }

  findRanges(doc: vscode.TextDocument): { [k: string]: vscode.Range[] } {
    const result: { [k: string]: vscode.Range[] } = {}
    const lineCount = doc.lineCount
    let line = 0
    while (line < lineCount) {
      const textLine = doc.lineAt(line).text
      if (textLine.trim().startsWith('```')) {
        const infoString = textLine.trim().substring(3)
        // Find the end of the code block
        let endLine = line + 1
        while (endLine < lineCount && !doc.lineAt(endLine).text.trim().startsWith('```')) {
          endLine++
        }
        if (endLine < lineCount) {
          const blockRange = new vscode.Range(
            new vscode.Position(line, 0),
            new vscode.Position(
              endLine,
              doc.lineAt(endLine).text.length
            )
          )
          const iconRange = new vscode.Range(
            new vscode.Position(line, 0),
            new vscode.Position(line, 0)
          )
          const parts = infoString.split(/\s+/).filter(Boolean)
          for (const part of parts) {
            const key = part.toLowerCase()
            const match = Object.keys(this.KEYWORD_CONFIG).find(
              k => key === k || key.startsWith(k)
            )
            if (match) {
              const cfg = this.KEYWORD_CONFIG[match]
              result[`${match}-bg`] = cfg.color
                ? [...(result[`${match}-bg`] || []), blockRange]
                : result[`${match}-bg`]
              result[`${match}-icon`] = cfg.icon
                ? [...(result[`${match}-icon`] || []), iconRange]
                : result[`${match}-icon`]
              break
            }
          }
        }
        line = endLine + 1
      } else {
        line++
      }
    }
    return result
  }
}

export { CodeBlockDecorationsComponent }
