import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
test.skip(process.env.WCI_CACHE_MOCK !== '1', 'Requires the isolated fake Supabase server');
for (const role of ['super_admin', 'department_head', 'team_leader', 'individual']) for (const kind of ['ijr', 'regional', 'corporate', 'piloting']) {
  test(`${role} ${kind}: scoped project menus, details and logo removal`, async ({ page }) => {
    const user = { id: 'fixture-owner', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {} };
    const token = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify({ sub: user.id, exp: 4102444800, role: 'authenticated' })) + '.signature';
    const payload = (id: string, state: 'open' | 'done' | 'reject') => kind === 'ijr' ? {
      'Application Number': id, 'Applicant Name': 'Company ' + id, 'Application Type': 'New Request', Status: state === 'done' ? 'Proses Selesai' : state === 'reject' ? 'Reject' : 'Dalam Proses', 'Request Date': '2026-09-01', Wilayah: 'KANTOR WILAYAH 01', 'Implementor 1': 'Person A', _TBSDayNum: state === 'open' ? 9 : 1,
    } : kind === 'piloting' ? {
      'No. Register': id, 'Nama Perusahaan': 'Company ' + id, 'PIC AT': 'Person A', 'Kelompok': 'COB1', 'Jenis Produk / Solusi': 'BNIdirect', 'Jenis Formulir': 'New', 'Tanggal Assign to AT': '2026-09-01', Kategori: state === 'done' ? 'Done' : state === 'reject' ? 'Reject/Retur' : 'Masih Pending', 'Hari Penyelesaian (SLA, hari kerja)': state === 'done' ? 1 : null,
    } : { noreg: id, cid: id, company: 'Company ' + id, product: 'BNIdirect', projectType: 'New', type: 'New', region: 'W01', segment: 'COB1', implementor: 'Person A', assignDate: '2026-09-01', salesDate: '2026-09-01', docComplete: '2026-09-01', doneDate: state === 'done' ? '2026-09-02' : '', status: state === 'done' ? 'Done' : state === 'reject' ? 'Reject/Retur' : 'In progress' };
    await page.route('https://cache-test.supabase.co/**', async route => {
      const url = new URL(route.request().url()); let body: unknown = [], count: number | undefined;
      if (url.pathname === '/auth/v1/token') body = { access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname === '/auth/v1/user') body = user;
      else if (url.pathname.endsWith('/wci_members')) body = [{ workspace_id: 'workspace', role: 'viewer', wci_workspaces: { name: 'Fixture' } }];
      else if (url.pathname.endsWith('/wci_profiles')) body = { workspace_id: 'workspace', user_id: user.id, name: 'Fixture', email: user.email, role, active: true };
      else if (url.pathname.endsWith('/wci_access')) body = [{ workspace_id: 'workspace', user_id: user.id, dataset: kind, source: 'AT', team_id: null, pic: role === 'individual' ? 'Person A' : '' }];
      else if (url.pathname.endsWith('/wci_datasets')) body = { active_batch: 'reference', operational_batch: 'batch', data_mode: 'operational' };
      else if (url.pathname.endsWith('/wci_events')) body = { revision: 1 };
      else if (url.pathname.endsWith('/wci_records')) {
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const other={...payload('other','open'),implementor:'Person B','Implementor 1':'Person B','PIC AT':'Person B',assignDate:today,docComplete:today,'Tanggal Assign to AT':today,_TBSDayNum:0};
        body = url.searchParams.get('dataset') === 'eq.' + kind ? [...['open', 'done', 'reject'].map(state => ({ id: state, position: 1, payload: payload(state, state as 'open' | 'done' | 'reject') })),...(role==='individual'?[]:[{id:'other',position:4,payload:other}])] : [];
        count = (body as unknown[]).length;
      }
      await route.fulfill({ status: 200, json: body, headers: count === undefined ? {} : { 'content-range': count ? `0-${count - 1}/${count}` : '*/0' } });
    });
    await page.goto('/'); await expect(page.locator('.bni-logo')).toHaveCount(0);
    await page.getByLabel('Email', { exact: true }).fill(user.email); await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click(); await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.bni-logo')).toHaveCount(0);
    if(role==='super_admin'&&kind!=='ijr'){
      const titles:Record<string,string>={regional:'Regional - Non BNIDirect',corporate:'Corporate - Non Piloting',piloting:'Corporate - Piloting'};
      await page.getByRole('button',{name:titles[kind],exact:true}).click();
    }
    if (role === 'individual') {
      await expect(page.getByRole('button', { name: 'Project Berjalan & Overdue', exact: true })).toHaveCount(0); return;
    }
    await expect(page.getByRole('button', { name: 'Project Berjalan', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Project Overdue', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Project Berjalan & Overdue', exact: true }).click();
    const queue=page.locator('.project-work-queue'),nameFilter=queue.getByLabel('Filter nama PIC / implementor',{exact:true});
    await expect(nameFilter).toBeVisible();
    await expect(queue.locator('tbody tr')).toHaveCount(2);
    await expect(queue).toContainText('Company open');
    await expect(queue).not.toContainText('Company done');
    await nameFilter.selectOption('Person A');
    await expect(queue.locator('tbody tr')).toHaveCount(1);
    await expect(queue).not.toContainText('Company other');
    await queue.getByRole('button', { name: 'Detail', exact: true }).click();
    await expect(page.locator('.detail-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup detail', exact: true }).click();
    await nameFilter.selectOption('Person B');
    await expect(queue).toContainText('Company other');
    await queue.getByRole('button',{name:/^Overdue/}).click();
    await expect(queue.locator('tbody tr')).toHaveCount(0);
    await nameFilter.selectOption('Person A');
    await expect(queue.locator('tbody tr')).toHaveCount(1);
    await expect(queue.locator('.badge.red')).toContainText('Overdue');
    await nameFilter.selectOption('');
    await expect(queue.locator('tbody tr')).toHaveCount(1);
    await queue.getByRole('button',{name:/^Semua Berjalan/}).click();
    await expect(queue.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('.filter-panel')).toHaveCount(0);
    if(role==='super_admin'&&kind==='regional')await queue.screenshot({path:'private/region-revision-qa/combined-projects.png'});
    if (kind === 'regional' || kind === 'ijr') {
      await page.getByRole('button', { name: 'Wilayah', exact: true }).click();
      await expect(page.locator('.region-average-table')).toHaveCount(0);
      await expect(page.getByRole('heading',{name:'Jumlah project dan Project done per Wilayah',exact:true})).toBeVisible();
      await expect(page.locator('.region-activity-legend')).toContainText('Jumlah project');
      await expect(page.locator('.region-activity-legend')).toContainText('Project done');
      await page.locator('.region-activity-bar.completed').first().click();
      await expect(page.locator('.region-detail')).toContainText('Company done');
      if (role === 'department_head') await page.screenshot({ path: `private/region-revision-qa/${kind}-dashboard.png`, fullPage: true });
    }
  });
}
test('filtered report includes the separate region matrices without leaking another PIC', async ({ page }) => {
  await page.goto('/');
  const bytes = await page.evaluate(async () => {
    const reportsPath = '/src/domain/reports.ts', slaPath = '/src/domain/sla.ts';
    const { generateReport } = await import(reportsPath);
    const { calculateSla } = await import(slaPath);
    const payloads = [
      { company: 'Scoped Company', cid: 'ONE', region: 'W01', type: 'New', product: 'BNIdirect', implementor: 'Person A', salesDate: '2026-09-01', docComplete: '2026-09-01', doneDate: '2026-09-02', status: 'Done' },
      { company: 'Hidden Other Company', cid: 'TWO', region: 'W02', type: 'Maintenance', product: 'API OGP', implementor: 'Person B', salesDate: '2026-09-01', docComplete: '2026-09-01', doneDate: '2026-09-02', status: 'Done' },
    ];
    const records = payloads.map((payload, i) => ({ id: String(i), payload, sla: calculateSla(payload, 'regional') }));
    const output = await generateReport(records.slice(0, 1), 'regional', ['Wilayah'], 'pptx', { person: 'Person A', dataset: records }, false);
    return Array.from(new Uint8Array(await output.blob.arrayBuffer()));
  });
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const slides = await Promise.all(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name => zip.file(name)!.async('string')));
  expect(slides.filter(xml => xml.includes('Average Days N'))).toHaveLength(1);
  expect(slides.filter(xml => xml.includes('Average Days M'))).toHaveLength(1);
  expect(slides.join('')).not.toContain('Hidden Other Company');
  expect(slides.find(xml => xml.includes('Average Days N'))).toContain('W18');
});
