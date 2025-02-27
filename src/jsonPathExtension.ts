'use strict';

import * as vscode from 'vscode';
import * as _ from 'lodash';
import { JsonPathQueryEngine } from './jsonPathQueryEngine';
import { ResultFormatter } from './resultFormatter';
import { VSCodeFunctions } from './vsCodeFunctions';
import { ProcessQueryResultStatus } from './processQueryResultStatus';
import { ProcessQueryResult } from './processQueryResult';
import { SavedQuery } from './savedQuery';
import { OutputFormat } from './outputFormat';
import DocProvider from './schema';

export class JsonPathExtension {
    static NoJsonDocumentErrorMsg = "Active editor doesn't show a valid JSON file - please open a valid JSON file first";
    static InvalidJsonPathErrorMsg = 'Provided jsonpath expression is not valid.';
    static NoSavedQueriesErrorMsg = "Couldn't find any JSONPath queries in configuration.";
    static EnterJsonPathPrompt = 'Enter jsonpath.';
    static NoResultsFoundMsg = 'No results found for provided jsonpath.';

    private queryEngine: JsonPathQueryEngine;
    private resultFormatter: ResultFormatter;
    private vscode: VSCodeFunctions;

    constructor(
        queryEngine: JsonPathQueryEngine,
        resultFormatter: ResultFormatter,
        vscodeFunctions: VSCodeFunctions
    ) {
        this.queryEngine = queryEngine;
        this.resultFormatter = resultFormatter;
        this.vscode = vscodeFunctions;
    }

    async run(activeTextEditor: vscode.TextEditor | undefined, createJson: boolean) {
        if (activeTextEditor === undefined) {
            this.vscode.showErrorMessage(JsonPathExtension.NoJsonDocumentErrorMsg);
            return;
        }

        const jsonObject = this.getJsonObject(activeTextEditor);
        if (jsonObject === undefined) {
            this.vscode.showErrorMessage(JsonPathExtension.NoJsonDocumentErrorMsg);
            return;
        }

        const input = await this.vscode.showInputBox({
            prompt: JsonPathExtension.EnterJsonPathPrompt,
            ignoreFocusOut: true
        });
        if (input === undefined) { return; }

        const result = this.queryEngine.processQuery(input, jsonObject);

        if (result.status !== ProcessQueryResultStatus.Success || result.result === undefined) {
            this.handleError(result);
            return;
        }

        const content = this.resultFormatter.format(result.result, createJson);
        await this.showContent(content, createJson, [(activeTextEditor.viewColumn || 0) + 1]);
    }

    async runSavedQuery(activeTextEditor: vscode.TextEditor | undefined) {
        if (activeTextEditor === undefined) {
            this.vscode.showErrorMessage(JsonPathExtension.NoJsonDocumentErrorMsg);
            return;
        }

        const jsonObject = this.getJsonObject(activeTextEditor);
        if (jsonObject === undefined) {
            this.vscode.showErrorMessage(JsonPathExtension.NoJsonDocumentErrorMsg);
            return;
        }

        const savedQueries = this.getSavedQueries();
        if (savedQueries === undefined || savedQueries.length === 0) {
            this.vscode.showErrorMessage(JsonPathExtension.NoSavedQueriesErrorMsg);
            return;
        }

        const selectedQuery = await this.selectSavedQuery(savedQueries);
        if (selectedQuery === undefined) { return; }

        const result = this.queryEngine.processQuery(selectedQuery.query, jsonObject);
        if (result.status !== ProcessQueryResultStatus.Success || result.result === undefined) {
            this.handleError(result);
            return;
        }

        const createJson = selectedQuery.output === OutputFormat.Json;
        const content = this.resultFormatter.format(result.result, createJson);
        await this.showContent(content, createJson, [(activeTextEditor.viewColumn || 0) + 1]);
    }

    private handleError(result: ProcessQueryResult) {
        switch (result.status) {
            case ProcessQueryResultStatus.InvalidQuery:
                this.vscode.showErrorMessage(JsonPathExtension.InvalidJsonPathErrorMsg);
                break;
            case ProcessQueryResultStatus.NoData:
                this.vscode.showInformationMessage(JsonPathExtension.NoResultsFoundMsg);
                break;
            case ProcessQueryResultStatus.Error:
                console.error(result.result);
                break;
        }
    }

    private getJsonObject(editor: vscode.TextEditor): object | undefined {
        const text = editor.document.getText();
        try {
            const jsonObject = JSON.parse(text);

            if (!(jsonObject instanceof Object)) {
                return undefined;
            }

            return jsonObject;
        } catch (e) {
            return undefined;
        }
    }

    private async showContent(content: string, createJson: boolean, vscodeConfig: [vscode.ViewColumn, boolean?]) {
        const language = createJson ? 'json' : 'plaintext';
        const uri = DocProvider.encodeContent(content);
        const doc = await this.vscode.openTextDocument(uri);
        // @ts-ignore
        await vscode.languages.setTextDocumentLanguage(doc, language);
        await this.vscode.showTextDocument(doc, ...vscodeConfig);
    }

    private getSavedQueries(): SavedQuery[] | undefined {
        const config = this.vscode.getConfiguration('jsonPathExtract').get<SavedQuery[]>('savedQueries');
        return config;
    }

    private async selectSavedQuery(queries: SavedQuery[]): Promise<SavedQuery | undefined> {
        const quickPicks = _.map(queries, query => ({ label: query.title, detail: query.query, description: '' }));
        const selectedPick = await this.vscode.showQuickPick(quickPicks, { matchOnDetail: true });
        if (selectedPick === undefined) { return undefined; }

        const pickedQuery = _.find<SavedQuery>(queries, sq => sq.query === selectedPick.detail);
        return pickedQuery;
    }
}
