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

  private defineRange(lineStart: number, colStart: number, lineEnd: number, colEnd: number): vscode.Range {
    return new vscode.Range(
      new vscode.Position(lineStart, colStart),
      new vscode.Position(lineEnd, colEnd)
    )
  }

  private findKeyword(infoString: string): string | undefined {
    const parts = infoString.split(/\s+/).map(p => p.toLowerCase()).filter(Boolean)
    const keys = Object.keys(this.KEYWORD_CONFIG)
    for (const part of parts) {
      if (this.KEYWORD_CONFIG[part]) return part
      for (const k of keys) if (part.startsWith(k)) return k
    }
    return undefined
  }

  findRanges(doc: vscode.TextDocument): { [k: string]: vscode.Range[] } {
    const result: { [k: string]: vscode.Range[] } = {}
    for (const { infoString, blockRange, iconRange } of this.getCodeBlocks(doc)) {
      const match = this.findKeyword(infoString)
      if (!match) continue

      const cfg = this.KEYWORD_CONFIG[match]
      if (cfg.color) result[`${match}-bg`] = [...(result[`${match}-bg`] || []), blockRange]
      if (cfg.icon) result[`${match}-icon`] = [...(result[`${match}-icon`] || []), iconRange]
    }
    return result
  }

  private getCodeBlocks(doc: vscode.TextDocument): Array<{
    infoString: string;
    blockRange: vscode.Range;
    iconRange: vscode.Range
  }> {
    const blocks: Array<{ infoString: string; blockRange: vscode.Range; iconRange: vscode.Range }> = []
    const lineCount = doc.lineCount
    let line = 0

    while (line < lineCount) {
      const startLineText = doc.lineAt(line).text.trim()

      if (!startLineText.startsWith('```')) {
        line++
        continue
      }

      const infoString = startLineText.substring(3)
      let endLine = line + 1

      while (endLine < lineCount && !doc.lineAt(endLine).text.trim().startsWith('```')) endLine++
      if (endLine < lineCount) {
        const endText = doc.lineAt(endLine).text.trim()
        blocks.push({
          infoString,
          blockRange: this.defineRange(line, 0, endLine, endText.length),
          iconRange: this.defineRange(line, 0, line, 0)
        })
      }
      line = endLine + 1
    }
    return blocks
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
}

export { CodeBlockDecorationsComponent }
