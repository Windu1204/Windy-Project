import { type Payload, type Value, type SlaRule, type Match } from '../types';
const slaNorm = (v: Value) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const normSlaText = (v: Value) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function customSlaSimilarity(a: string, b: string) { a = normSlaText(a); b = normSlaText(b); if (!a || !b)
    return 0; if (a === b)
    return 1; if (a.includes(b) || b.includes(a))
    return Math.min(a.length, b.length) / Math.max(a.length, b.length) + .15; const A = new Set(a.split(' ').filter(x => x.length > 1)), B = new Set(b.split(' ').filter(x => x.length > 1)); if (!A.size || !B.size)
    return 0; let hit = 0; A.forEach(x => { if (B.has(x))
    hit++; }); return (2 * hit) / (A.size + B.size); }
function customSlaMatch(r: Payload, CUSTOM_SLA_RULES: SlaRule[]): Match | null { const p = normSlaText(r.product), text = normSlaText([r.product, r.requestType, r.formType, r.description, r.remarks].filter(Boolean).join(' ')); if (!p && !text)
    return null; let best: SlaRule | null = null, bestScore = 0; for (const x of CUSTOM_SLA_RULES) {
    const base = normSlaText(x.product), name = normSlaText(x.name), aliases = String(x.aliases || '').split(',').map(normSlaText).filter(k => k.length >= 3);
    let score = base && p === base ? 1 : 0;
    if (!score && base)
        score = Math.max(score, customSlaSimilarity(p, base));
    if (!score && name)
        score = Math.max(score, customSlaSimilarity(p, name));
    for (const k of aliases) {
        if (text.includes(k)) {
            score = Math.max(score, .98);
            break;
        }
        score = Math.max(score, customSlaSimilarity(p, k));
    }
    if (score > bestScore) {
        bestScore = score;
        best = x;
    }
} if (!best || bestScore < .72)
    return null; const typ = String(r.projectType || r.requestType || r.formType || '').toLowerCase(); const isMaint = /maint|maintenance|existing|perubahan|update/.test(typ); const n = Number(best.newDays), m = Number(best.maintDays); const target = isMaint ? (m || n) : (n || m); return target > 0 ? { target, solution: best.name || best.product, map: 'Custom SLA Setting' } : null; }
export function memoSemanticMatch(r: Payload, rules: SlaRule[]): Match | null {
    const clean = (v: Value) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const product = clean(r.product), project = clean(r.projectType), form = clean(r.formType), req = clean(r.requestType), desc = clean(r.description), remarks = clean(r.remarks);
    const text = [product, form, req, desc, remarks].join(' ');
    const isNew = /\bnew\b|new project|pendaftaran aplikasi baru|baru/.test(project + ' ' + form + ' ' + req);
    const hit = (re: RegExp) => re.test(text);
    if (r.slaTarget != null && r.slaSolution)
        return { target: Number(r.slaTarget), solution: String(r.slaSolution), map: String(r.slaMapMethod) || 'Memo mapping' };
    if (/supply chain|fscm/.test(product) || hit(/\b(fscm|scf|supply chain|supplier financing|payable financing|sf post|early payment)\b/))
        return { target: 3, solution: 'FSCM [SCF] New Corporate/Mitra', map: 'Semantic Memo mapping' };
    if (/mt\s*940/.test(product) || hit(/\bmt\s*940\b/))
        return { target: 10, solution: 'MT940 (Swift/email)', map: 'Semantic Memo mapping' };
    if (/mt\s*100/.test(product) || hit(/\bmt\s*100\b/))
        return { target: 10, solution: 'MT100 (standard)', map: 'Semantic Memo mapping' };
    if (/cash delivery|pickup services|pick up/.test(product))
        return { target: 5, solution: 'Cash Pick Up', map: 'Semantic Memo mapping' };
    if (/cash card/.test(product) || ((!product || /others/.test(product)) && hit(/\bcash card\b/)))
        return { target: 14, solution: 'Cash Card (non CUSTOM)', map: 'Semantic Memo mapping' };
    if (/jisdor/.test(product) || hit(/\bjisdor\b/))
        return { target: 10, solution: 'JISDOR', map: 'Semantic Memo mapping' };
    if (/intraday/.test(product) || hit(/\bintraday\b/))
        return { target: 7, solution: 'Intraday Facility iCons', map: 'Semantic Memo mapping' };
    if (/garansi bank/.test(product) || hit(/\b(garansi bank|gb online)\b/))
        return { target: 3, solution: 'GB Online', map: 'Semantic Memo mapping' };
    if (/bni trade online|\bbto\b/.test(product) || hit(/\b(bni trade online|bto)\b/))
        return { target: 3, solution: 'BTO', map: 'Semantic Memo mapping' };
    if ((!product || /others/.test(product)) && hit(/\b(cash pick up|cash pickup|pickup services|cash delivery)\b/))
        return { target: 5, solution: 'Cash Pick Up', map: 'Semantic Memo mapping' };
    if (/national pooling|notional pooling/.test(product) || hit(/\b(notional pooling|national pooling|cash ?pooling)\b/))
        return { target: 3, solution: 'Notional Pooling', map: 'Semantic Memo mapping' };
    if (/billing payment|bill payment/.test(product) || hit(/\b(bill ?payment|billing payment)\b/))
        return { target: 10, solution: 'Bill Payment', map: 'Semantic Memo mapping' };
    if (/api rdn/.test(product) || /rekening dana nasabah/.test(product) || ((!product || /others|application programming interface/.test(product)) && hit(/\b(api rdn|rekening dana nasabah|rdn)\b/)))
        return { target: 5, solution: 'API RDN', map: 'Semantic Memo mapping' };
    if (/api rdl|rekening dana landing/.test(product) || ((!product || /others|application programming interface|digital service/.test(product)) && hit(/\b(api rdl|rekening dana landing|rdl)\b/)))
        return { target: 5, solution: 'API RDL', map: 'Semantic Memo mapping' };
    if (/api rdf/.test(product) || hit(/\bapi rdf\b/))
        return { target: 5, solution: 'API RDF', map: 'Semantic Memo mapping' };
    if (hit(/\bapi mpn\b/))
        return { target: 5, solution: 'API MPN', map: 'Semantic Memo mapping' };
    if (hit(/\bapi otr\b/))
        return { target: 7, solution: 'API OTR', map: 'Semantic Memo mapping' };
    if (hit(/\bapi bni ?direct\b/))
        return { target: 5, solution: 'API BNIdirect', map: 'Semantic Memo mapping' };
    if (/one gate payment/.test(product) || hit(/\bogp\b|one gate payment/)) {
        const snap = hit(/\bsnap\b/);
        return { target: isNew ? 7 : 5, solution: snap ? 'OGP SNAP' : 'OGP', map: 'Semantic Memo mapping' };
    }
    if (/virtual account debet kredit|virtual account debit kredit/.test(product))
        return { target: 14, solution: 'VA Debit/Kredit berkartu', map: 'Semantic Memo mapping' };
    if (/virtual account debet|virtual account debit/.test(product))
        return { target: 14, solution: 'VA Debit berkartu', map: 'Semantic Memo mapping' };
    if (/virtual account kredit|virtual account credit/.test(product))
        return { target: 14, solution: 'VA Kredit berkartu', map: 'Semantic Memo mapping' };
    if (/e collection/.test(product) || hit(/\b(e ?coll|ecoll|e collection|portal va|va portal)\b/))
        return { target: isNew ? 7 : 5, solution: 'VA eCollection (Portal)', map: 'Semantic Memo mapping' };
    if (hit(/\bvirtual account\b.*\bsnap\b|\bva\b.*\bsnap\b/))
        return { target: isNew ? 7 : 5, solution: 'Virtual Account SNAP', map: 'Semantic Memo mapping' };
    if (hit(/\b(non ?snap|integrasi)\b/) && (/virtual account/.test(product) || hit(/\bvirtual account\b|\bva\b/)))
        return { target: isNew ? 7 : 5, solution: 'Virtual Account Non SNAP (Integrasi)', map: 'Semantic Memo mapping' };
    if (hit(/\b(icons|rpa|upload va)\b/) && (/virtual account/.test(product) || hit(/\bvirtual account\b|\bva\b/)))
        return { target: 3, solution: 'Virtual Account (upload iCons/RPA)', map: 'Semantic Memo mapping' };
    if (/bni ?direct/.test(product))
        return { target: isNew ? 3 : 2, solution: 'BNIdirect', map: 'Semantic Memo mapping' };
    const custom = customSlaMatch(r, rules);
    if (custom) return custom;
    const canonical = product.replace(/\becollection\b|\becolletion\b/g, 'e collection');
    if (canonical !== product) return memoSemanticMatch({ ...r, product: canonical }, rules);
    if (product === 'vam') return memoSemanticMatch({...r,product:'VA eColl Portal'},rules);
    if (product === 'api snap') return memoSemanticMatch({...r,product:'OGP SNAP'},rules);
    return null;
}
export const REG_SLA_RULES: [
    string,
    number,
    number
][] = [['BNIdirect', 3, 2], ['BTO', 3, 3], ['VA eCollection (Portal)', 7, 5], ['Cash Pick Up', 7, 5], ['GB Online', 3, 3], ['Virtual Account (upload iCons/RPA)', 3, 3], ['Intraday Facility iCons', 5, 7], ['JISDOR', 10, 10], ['Cash Card (non CUSTOM)', 14, 14], ['VA Debit berkartu', 14, 14], ['VA Kredit berkartu', 14, 14], ['MT100 (standard)', 10, 10], ['MT940 (Swift/email)', 10, 10], ['FSCM [SCF] New Corporate/Mitra', 3, 3], ['Bill Payment', 14, 10], ['OGP', 7, 5], ['Virtual Account Non SNAP (Integrasi)', 7, 5], ['Virtual Account SNAP', 7, 5], ['OGP SNAP', 7, 5], ['API BNIdirect', 7, 5], ['API OTR', 10, 7], ['API ITR', 7, 5], ['API FSCM', 7, 5], ['API MPN', 7, 5], ['API Notification Account Statement', 7, 5], ['API RDF', 7, 5], ['API RDL', 7, 5], ['API RDN', 7, 5], ['BNIdirect-GFX', 21, 5], ['Notional Pooling', 10, 3], ['SPC', 14, 14], ['MT101', 30, 10]];
const REG_SLA_RULE_MAP = Object.fromEntries(REG_SLA_RULES.map(x => [x[0], { newDays: x[1], maintDays: x[2] }]));
function regSlaResult(solution: string, isNew: boolean) { const x = REG_SLA_RULE_MAP[solution]; return x ? { target: isNew ? x.newDays : x.maintDays, solution } : null; }
export function regSlaTarget(r: Payload) {
    const p = slaNorm(r.product), t = slaNorm(r.type), isNew = /\bnew\b|baru/.test(t);
    if (/bni ?direct/.test(p))
        return regSlaResult('BNIdirect', isNew);
    if (/fscm|supply chain|scf/.test(p))
        return regSlaResult('FSCM [SCF] New Corporate/Mitra', isNew);
    if (/mt ?940/.test(p))
        return regSlaResult('MT940 (Swift/email)', isNew);
    if (/mt ?100/.test(p))
        return regSlaResult('MT100 (standard)', isNew);
    if (/cash delivery|cash pickup|cash pick up|pickup services/.test(p))
        return regSlaResult('Cash Pick Up', isNew);
    if (/cash card/.test(p))
        return regSlaResult('Cash Card (non CUSTOM)', isNew);
    if (/jisdor/.test(p))
        return regSlaResult('JISDOR', isNew);
    if (/intraday/.test(p))
        return regSlaResult('Intraday Facility iCons', isNew);
    if (/garansi bank|gb online/.test(p))
        return regSlaResult('GB Online', isNew);
    if (/bni trade online|\bbto\b/.test(p))
        return regSlaResult('BTO', isNew);
    if (/notional pooling|national pooling|cash pooling/.test(p))
        return regSlaResult('Notional Pooling', isNew);
    if (/bill payment|billing payment/.test(p))
        return regSlaResult('Bill Payment', isNew);
    if (/api rdn|rekening dana nasabah/.test(p))
        return regSlaResult('API RDN', isNew);
    if (/api rdl|rekening dana landing/.test(p))
        return regSlaResult('API RDL', isNew);
    if (/api rdf/.test(p))
        return regSlaResult('API RDF', isNew);
    if (/api mpn/.test(p))
        return regSlaResult('API MPN', isNew);
    if (/api otr/.test(p))
        return regSlaResult('API OTR', isNew);
    if (/api.*bni ?direct|bni ?direct.*api/.test(p))
        return regSlaResult('API BNIdirect', isNew);
    if (/one gate payment|\bogp\b/.test(p))
        return regSlaResult(/snap/.test(p) ? 'OGP SNAP' : 'OGP', isNew);
    if (/va debit.*kredit|va debet.*kredit|virtual account debit.*kredit|virtual account debet.*kredit/.test(p))
        return regSlaResult('VA Debit/Kredit berkartu', isNew);
    if (/va debit|va debet/.test(p))
        return regSlaResult('VA Debit berkartu', isNew);
    if (/va kredit|va credit/.test(p))
        return regSlaResult('VA Kredit berkartu', isNew);
    if (/e collection|ecollection|portal va|va portal/.test(p))
        return regSlaResult('VA eCollection (Portal)', isNew);
    if (/virtual account|\bva\b/.test(p)) {
        if (/snap/.test(p))
            return regSlaResult('Virtual Account SNAP', isNew);
        if (/non snap|integrasi/.test(p))
            return regSlaResult('Virtual Account Non SNAP (Integrasi)', isNew);
        if (/icons|rpa|upload/.test(p))
            return regSlaResult('Virtual Account (upload iCons/RPA)', isNew);
    }
    // Only unmapped rows reach this fallback. Exact aliases do not alter source labels.
    const compact=p.replace(/[^a-z0-9]/g,'');
    const alias:Record<string,string>={vaecoll:'VA eCollection (Portal)',vaecollection:'VA eCollection (Portal)',vaecolletion:'VA eCollection (Portal)',apinotif:'API Notification Account Statement'};
    const canonical=alias[compact]||REG_SLA_RULES.find(([name])=>slaNorm(name).replace(/[^a-z0-9]/g,'')===compact)?.[0];
    return canonical?regSlaResult(canonical,isNew):null;
}
