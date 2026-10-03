import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { type DatasetKind, type Payload } from '../src/types';
import { calculateSla } from '../src/domain/sla';
import { reportContext, reportModel, reportContents, selectReportPerson, reportNames } from '../src/domain/report-model';
import { createRenderer as ijr } from '../src/domain/report-renderers/ijr.js';
import { createRenderer as regional } from '../src/domain/report-renderers/regional.js';
import { createRenderer as corporate } from '../src/domain/report-renderers/corporate.js';

describe('v78 report model parity', () => {
  for (const kind of ['ijr', 'regional', 'corporate'] as DatasetKind[]) {
    it.skipIf(!existsSync(`private/seed/${kind}.json`))(`${kind}: all names and one implementor match original aggregation`, () => {
      const data = JSON.parse(readFileSync(`private/seed/${kind}.json`, 'utf8')) as Payload[];
      const all = data.map((payload, index) => ({ id: String(index), payload, sla: calculateSla(payload, kind) }));
      const renderer = { ijr, regional, corporate }[kind];
      const name = all.flatMap(row => reportNames(row, kind))[0];
      for (const person of ['All Name', name]) {
        const rows = selectReportPerson(all, kind, person);
        const context = reportContext(rows, kind, reportContents[kind], { person, dataset: all });
        expect(reportModel(rows, kind, person)).toEqual(renderer(context).model());
      }
      const model = reportModel(all, kind);
      expect(model.statuses.reduce((sum, [, n]) => sum + n, 0)).toBe(all.length);
      expect(model.active + model.done + model.handover).toBe(all.length);
    });
  }
});
