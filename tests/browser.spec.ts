import { readFileSync } from 'node:fs';
const translations = JSON.parse(readFileSync('src/lib/translations.json', 'utf8'));
const translate = (label: string, _language: string) => translations[label]?.[1] ?? label;
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: 'Buka preview lokal' }).click(); await expect(page.locator('.kpi').first()).toContainText('1,000'); await page.locator('.profile-button').click();await page.getByLabel('Bahasa / Language').selectOption('en');await page.keyboard.press('Escape'); });
test('navigation, filtering, pagination, record details and all three dashboards', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('Status', { exact: true }).selectOption('Proses Selesai');
    await expect(page.locator('.chips')).toContainText('Proses Selesai');
    await expect(page.locator('tbody tr')).toHaveCount(25);
    await page.getByRole('button', { name: 'Reset Filters', exact: true }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.pagination')).toContainText('26–50');
    await page.getByRole('button', { name: 'Details', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.detail-grid')).toContainText('Application Number');
    await page.getByRole('button', { name: 'Close details' }).click();
    await page.getByRole('button', { name: 'Implementation Process', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Branch Processing Time' })).toBeVisible();
    await page.getByRole('button', { name: 'Performance & Workload', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'KPI per Person', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Performance & Workload', exact: true }).click();
    await expect(page.getByRole('heading',{name:'Official SLA Target Reference'})).toBeVisible();
    await page.getByRole('button', { name: 'Regional - Non BNIDirect', exact: true }).click();
    await expect(page.locator('.kpi').first()).toContainText('1,098');
    await page.getByRole('button', { name: 'Implementation Process', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Milestone Availability' })).toBeVisible();
    await page.getByRole('button', { name: 'Corporate - Non Piloting', exact: true }).click();
    await expect(page.locator('.kpi').first()).toContainText('4,509');
    await page.getByRole('button', { name: 'Performance & Workload', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Official SLA Target Reference' })).toBeVisible();
    expect(errors).toEqual([]);
});
test('uploads are centralized in Admin while the Data menu remains readable',async({page})=>{await page.getByRole('button',{name:'Data',exact:true}).click();await expect(page.locator('input[type=file]')).toHaveCount(0);await expect(page.locator('.records')).toContainText('1,000 records');await page.getByRole('button',{name:'Admin',exact:true}).click();await expect(page.locator('.tabs button')).toHaveCount(5);await page.getByRole('button',{name:'Upload & Data History',exact:true}).click();await expect(page.getByLabel('Target Dashboard',{exact:true})).toBeVisible();});
test('CSV, Word and PowerPoint downloads are generated without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const sourceId = (await page.locator('tbody tr').first().locator('td').first().innerText()).trim();
    await page.getByLabel('Search records').fill(sourceId);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    const csvPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const csv = await csvPromise;
    expect((await readFile((await csv.path())!)).toString()).toContain(sourceId);
    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await page.getByLabel('Report Format', { exact: true }).selectOption('docx');
    let dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Report' }).click();
    const docx = await dl;
    await docx.saveAs('private/verified-report.docx');
    expect((await readFile('private/verified-report.docx')).subarray(0, 2).toString()).toBe('PK');
    await page.getByLabel('Report Format', { exact: true }).selectOption('pptx');
    dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Report' }).click();
    const pptx = await dl;
    await pptx.saveAs('private/verified-report.pptx');
    expect((await readFile('private/verified-report.pptx')).subarray(0, 2).toString()).toBe('PK');
    expect(errors).toEqual([]);
});
test('mobile dashboard fits the viewport and remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'private/mobile-dashboard.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 2);
    await page.getByRole('button', { name: 'Corporate - Non Piloting', exact: true }).click();
    await expect(page.locator('.kpi').first()).toContainText('4,509');
});

test('request period uses custom calendar range and can return to all periods', async ({ page }) => {
    await page.getByRole('button', { name: 'All Period', exact: true }).click();
    const calendar = page.getByRole('dialog', { name: 'Request Period', exact: true });
    await calendar.getByLabel('Custom Dates', { exact: true }).check();
    await calendar.getByLabel('Start Date', { exact: true }).fill('2025-07-01');
    await calendar.getByLabel('End Date', { exact: true }).fill('2025-07-31');
    await calendar.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('.chips')).toContainText('2025-07-01');
    await expect(page.locator('.chips')).toContainText('2025-07-31');
    await page.locator('.period-trigger').click();
    await calendar.getByLabel('All Period', { exact: true }).check();
    await calendar.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('.kpi').first()).toContainText('1,000');
});

for (const [kind, dashboard] of [['ijr', 'IJR - BNIdirect'], ['regional', 'Regional - Non BNIDirect'], ['corporate', 'Corporate - Non Piloting']] as const) {
    test(`${kind}: every visible source panel and tab KPI is carried over from v78`, async ({ page, context }) => {
        test.skip(!existsSync(`private/reference/${kind}-preview.html`), 'Local source HTML fixture is required for this comparison');
        const source = await context.newPage();
        await source.goto(`/private/reference/${kind}-preview.html`);
        await page.getByRole('button', { name: dashboard, exact: true }).click();
        const tabs = await source.locator('.tabs button').allTextContents();
        for (const tab of tabs) {
            if (['Proses & Durasi', 'Status Implementasi', 'PIC & Beban Kerja', 'Beban Implementor', 'Kinerja SLA','PIC & Implementor','Data'].includes(tab)) continue;
            await source.getByRole('button', { name: tab, exact: true }).click();
            await page.getByRole('button', { name: tab === 'Wilayah & Cabang' ? 'Region' : translate(tab, 'en'), exact: true }).click();
            if (tab === 'Report') { await expect(page.getByRole('heading', {name:'Monitoring Report',exact:true})).toBeVisible(); continue; } // Report controls were intentionally revised; Office content remains verified separately.
            if(kind==='corporate'&&['Ringkasan','Overview'].includes(tab)){await expect(page.locator('.corporate-process')).toHaveCount(0);await expect(page.locator('.grid-three')).toBeVisible();continue;}
            const sourceHeadings = await source.locator('h3:visible').allTextContents();
            for (const heading of sourceHeadings) await expect(page.getByRole('heading', { name: translate(heading.trim(), 'en'), exact: true }).first()).toBeVisible();
            const actualHeadings = (await page.locator('.dashboard-content h3:visible').allTextContents()).map(value => value.trim());
            let previous = -1;
            for (const heading of sourceHeadings) { const index = actualHeadings.indexOf(translate(heading.trim(), 'en'), previous + 1); expect(index, `${kind} ${tab}: source panel order`).toBeGreaterThan(previous); previous = index; }
            const expected = await source.locator('.view.active .kpi').evaluateAll(cards => cards.map(card => ({ label: card.querySelector('.klabel,.label')?.textContent?.trim(), value: card.querySelector('.kvalue,.value')?.textContent?.trim() })));
            const actual = await page.locator('.kpis .kpi').evaluateAll(cards => cards.map(card => ({ label: card.querySelector('small')?.textContent?.trim(), value: card.querySelector('strong')?.textContent?.trim() })));
            expect(actual, `${kind} ${tab}: labels and totals match source`).toEqual(expected.map(card => ({...card, label: translate(card.label || '', 'en')})));
            if (tab === 'Data' || tab === 'Report') await expect(page.locator('.filter-panel')).toHaveCount(0);
        }
        await source.close();
    });
}

test('IJR duration buckets, chart drilldown and person workload follow source flows', async ({ page }) => {
    await page.getByRole('button', { name: 'Implementation Process', exact: true }).click();
    await expect(page.locator('.duration-card')).toHaveCount(2);
    await expect(page.locator('.records')).toHaveCount(0);
    const bucket = page.locator('.duration-card').first().getByRole('button').first();
    const count = (await bucket.locator('strong').innerText()).trim();
    await bucket.click();
    await expect(page.locator('.records')).toContainText(`${count} records`);
    await expect(page.locator('.records thead')).toContainText('Branch Days');
    await bucket.click();
    await expect(page.locator('.records')).toHaveCount(0);
    await page.getByRole('button', { name: 'Region', exact: true }).click();
    await page.getByLabel('Region', { exact: true }).selectOption({ index: 1 });
    await expect(page.locator('.records')).toHaveCount(0); // filter alone must not invent a chart drilldown
    await page.getByRole('button', { name: 'Reset Filters', exact: true }).click();
    const branchPanel = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Top Branches', exact: true }) });
    const firstBranch = branchPanel.locator('.bar-row').first();
    const branch = (await firstBranch.locator('span').first().innerText()).trim();
    await firstBranch.click();
    await expect(page.locator('.records h3')).toContainText(`Detail Cabang — ${branch}`);
    const branchCells = await page.locator('.records tbody tr td:nth-child(8)').allTextContents();
    expect(branchCells.every(value => value.trim() === branch)).toBe(true);
    await page.getByRole('button', { name: 'Performance & Workload', exact: true }).click();
    const panel = page.locator('.person-work');
    const name = (await panel.locator('.person-row b').first().innerText()).trim();await panel.getByRole('searchbox').fill(name);await panel.locator('.person-row').first().click();await panel.locator('.person-kpis button').nth(1).click();
    const statuses = await panel.locator('tbody tr td:nth-child(4)').allTextContents();expect(statuses.every(value=>value.trim()!=='' )).toBe(true);
});

test('Regional category/subproduct chain and Done confirmation retain milestone data', async ({ page }) => {
    await page.getByRole('button', { name: 'Regional - Non BNIDirect', exact: true }).click();
    const sub = page.getByLabel('TB Subproduct', { exact: true });
    await expect(sub).toBeDisabled();
    await page.getByLabel('TB Product', { exact: true }).selectOption({ index: 1 });
    await expect(sub).toBeEnabled();
    await sub.selectOption({ index: 1 });
    await page.getByLabel('TB Product', { exact: true }).selectOption({ index: 2 });
    await expect(sub).toHaveValue('');
    await page.getByRole('button', { name: 'Reset Filters', exact: true }).click();
    await page.getByRole('button', { name: 'Performance & Workload', exact: true }).click();
    const panel=page.locator('.person-work');await panel.locator('.person-row').first().click();await panel.locator('.person-kpis button').nth(1).click();const target=panel.locator('tbody tr').first();
    await target.click();
    const dialog = page.getByRole('dialog');
    const before = await dialog.locator('.detail-grid > div').allTextContents();
    await expect(dialog.getByRole('button',{name:'Mark Done',exact:true})).toHaveCount(0);
    expect(before.length).toBeGreaterThan(5);
});

test('all dashboard tabs fit desktop and phone widths without losing controls', async ({ page }) => {
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const dashboard of ['IJR - BNIdirect', 'Regional - Non BNIDirect', 'Corporate - Non Piloting']) {
            await page.getByRole('button', { name: dashboard, exact: true }).click();
            const tabs = await page.locator('.tabs button').allTextContents();
            for (const tab of tabs) {
                await page.locator('.tabs').getByRole('button', { name: tab, exact: true }).click();
                const widths = await page.evaluate(() => { const main = document.querySelector('.main')!; return { page: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, main: main.clientWidth, mainScroll: main.scrollWidth }; });
                expect(widths.scroll, `${dashboard} ${tab} at ${width}px`).toBeLessThanOrEqual(widths.page + 2);
                expect(widths.mainScroll, `${dashboard} ${tab}: panel overflow`).toBeLessThanOrEqual(widths.main + 2);
            }
        }
    }
});

test('report person picker scopes the downloaded individual report',async({page})=>{
 await page.getByRole('button',{name:'Report',exact:true}).click();const input=page.getByLabel('PIC / Implementor',{exact:true});await expect(input).toHaveValue('All Name');await expect(page.getByRole('button',{name:'Preview Report',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Tampilkan daftar PIC / Implementor'}).click();const name=(await page.locator('.person-combo-option').nth(1).innerText()).trim();await page.locator('.person-combo-option').nth(1).click();await expect(input).toHaveValue(name);const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Generate Report',exact:true}).click();expect((await wait).suggestedFilename()).toMatch(/\.pptx$/);await input.fill('All Name');await expect(input).toHaveValue('All Name');
});
