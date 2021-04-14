'use strict';

import * as _ from 'lodash';

export class ResultFormatter {
    format(results: any[], createJson: boolean): string {
        let content: string;
        if (createJson) {
            content = JSON.stringify(results, null, 2);
        } else {
            content = _.join(_.map(results, this.convertResultToString), '\n');
        }

        return content;
    }

    private convertResultToString(result: any): string {
        if (typeof result === 'string') {
            return result;
        } else if (typeof result === 'number') {
            return result.toString();
        } else {
            return JSON.stringify(result);
        }
    }
}
