import * as vscode from "vscode";

export default class DocProvider implements vscode.TextDocumentContentProvider {
  static scheme = "jsonpath";

  static encodeContent(query: string): vscode.Uri {
    return vscode.Uri.parse(`${DocProvider.scheme}://json-path?${query}`);
  }

  static decodeContent(
    encodedUri: vscode.Uri
  ): { jpMatches: object; uri: vscode.Uri; jpQuery: string } {
    return JSON.parse(encodedUri.query);
  }

  public provideTextDocumentContent(
    uri: vscode.Uri
  ): string | Thenable<string> {
    return uri.query
  }

  dispose() {}
}
