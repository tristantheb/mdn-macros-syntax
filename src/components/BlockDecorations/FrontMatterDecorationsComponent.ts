import * as vscode from 'vscode'
import { DecorationComponent } from './DecorationComponent'

class FrontMatterDecorationsComponent extends DecorationComponent {
  getDecorations(): { [k: string]: vscode.TextEditorDecorationType } {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
      || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
    const color = isDark ? 'rgb(255 255 255 / 10%)' : 'rgb(0 0 0 / 10%)'
    return {
      'frontmatter-bg': vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: true
      })
    }
  }

  findRanges(document: vscode.TextDocument): { [k: string]: vscode.Range[] } {
    const result: { [k: string]: vscode.Range[] } = { 'frontmatter-bg': [] }
    const MAX_LINES = document.lineCount
    const FIRST_LINE: number = 0

    // Ensure front matter starts on first line
    if (MAX_LINES === 0 || document.lineAt(FIRST_LINE).text.trim() !== '---')
      return result

    let endLine = FIRST_LINE + 1
    while (true) {
      // Find the end of the front matter block
      if (endLine >= MAX_LINES) break
      if (document.lineAt(endLine).text.trim() === '---') {
        // Block includes both --- lines
        const range = new vscode.Range(
          new vscode.Position(FIRST_LINE, 0),
          new vscode.Position(
            endLine,
            document.lineAt(endLine).text.length
          )
        )
        result['frontmatter-bg'].push(range)
        break
      }
      endLine++
    }
    return result
  }
}

export { FrontMatterDecorationsComponent }
