import * as XLSX from 'xlsx';

// ─── tipos ───────────────────────────────────────────────────────────────────
export type Origem = 'cfop' | 'produto' | 'ncm-fornecedor' | 'ncm' | 'cst' | 'manual';
export interface Item {
  id: number;
  linha: unknown[];          // linha original da planilha crua (19 colunas)
  fornecedor: string; razao: string; cnpj: string; tipo: string;
  numero: string; data: string; chave: string; produto: string; descricao: string;
  ncm: string; cfop: string; un: string; qtd: number; vunit: number; valor: number;
  cst: string; bc: number; aliqDest: number; icms: number;
}
export interface Decisao {
  incluir: boolean; origem: Origem; motivo: string;
  aliq: number; credSn: number; conflito?: boolean;
}
interface Contagem { inc: number; exc: number; ultima: boolean; ultimoMes: string; aliq?: Record<string, number> }
export interface Memoria {
  produtos: Record<string, Contagem>;
  ncmForn: Record<string, Contagem>;
  ncm: Record<string, Contagem>;
  meses: string[];
}
export const memoriaVazia = (): Memoria => ({ produtos: {}, ncmForn: {}, ncm: {}, meses: [] });

// ─── leitura ─────────────────────────────────────────────────────────────────
const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown) => {
  if (typeof v === 'number') return v;
  const t = txt(v); if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
};
const cstTxt = (v: unknown) => txt(v).replace(/\.0+$/, '');

function paraItens(linhas: unknown[][]): Item[] {
  return linhas
    .filter(r => r && (txt(r[6]) || txt(r[0])))
    .map((r, i) => ({
      id: i, linha: r.slice(0, 19),
      fornecedor: txt(r[0]), razao: txt(r[1]), cnpj: txt(r[2]), tipo: txt(r[3]) || 'Normal',
      numero: txt(r[4]), data: txt(r[5]), chave: txt(r[6]), produto: txt(r[7]), descricao: txt(r[8]),
      ncm: txt(r[9]), cfop: txt(r[10]), un: txt(r[11]), qtd: num(r[12]), vunit: num(r[13]), valor: num(r[14]),
      cst: cstTxt(r[15]), bc: num(r[16]), aliqDest: num(r[17]), icms: num(r[18]),
    }));
}

export interface ArquivoLido {
  nome: string; mes: string; itens: Item[]; cabecalho: unknown[];
  /** Presente quando o arquivo já é uma apuração feita pela analista (aba SISTEMATICA). */
  analista?: { decisoes: Map<number, { incluir: boolean; aliq: number | null; credSn: number; valor: number }>; total: number };
}

export function mesDoNome(nome: string) {
  const m = nome.match(/(\d{2})[-_.](\d{4})/);
  return m ? `${m[1]}/${m[2]}` : '';
}
const ordemMes = (m: string) => { const [mm, yy] = m.split('/').map(Number); return (yy || 0) * 100 + (mm || 0); };

/** Linhas da aba lendo só a área preenchida (as planilhas costumam declarar até a linha 1.048.576). */
function linhasDaAba(ws: XLSX.WorkSheet): unknown[][] {
  let maxR = 0, maxC = 0;
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const c = XLSX.utils.decode_cell(k);
    if (c.r > maxR) maxR = c.r; if (c.c > maxC) maxC = c.c;
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: Math.max(maxC, 0) } });
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
}

export async function lerArquivo(file: File): Promise<ArquivoLido> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', dense: false });
  const crua = linhasDaAba(wb.Sheets[wb.SheetNames[0]]);
  const cabecalho = crua[0] ?? [];
  if (!txt(cabecalho[10]).toUpperCase().startsWith('NATUREZA') || !txt(cabecalho[14]).toUpperCase().startsWith('VALOR TOTAL')) {
    throw new Error('A primeira aba não está no layout do Questor (esperado: Natureza na coluna K e Valor Total na coluna O).');
  }
  const itens = paraItens(crua.slice(1));
  const out: ArquivoLido = { nome: file.name, mes: mesDoNome(file.name), itens, cabecalho };

  const abaSist = wb.SheetNames.find(n => n.toUpperCase().startsWith('SISTEM'));
  if (abaSist) {
    const sist = linhasDaAba(wb.Sheets[abaSist]).slice(1)
      .filter(r => r && (txt(r[6]) || txt(r[0])));
    // casa linha a linha (a mesma nota pode repetir o mesmo item; contamos ocorrências)
    const chave = (r: unknown[]) => `${txt(r[6])}|${txt(r[7])}|${num(r[12])}|${num(r[14]).toFixed(2)}`;
    const fila = new Map<string, unknown[][]>();
    sist.forEach(r => { const k = chave(r); fila.set(k, [...(fila.get(k) ?? []), r]); });
    const decisoes = new Map<number, { incluir: boolean; aliq: number | null; credSn: number; valor: number }>();
    let total = 0;
    itens.forEach(it => {
      const lista = fila.get(chave(it.linha));
      const r = lista?.shift();
      if (r) {
        const y = num(r[24]), z = num(r[25]);
        decisoes.set(it.id, { incluir: true, aliq: y ? Math.round((z / y) * 10000) / 100 : null, credSn: num(r[22]), valor: num(r[26]) });
      } else decisoes.set(it.id, { incluir: false, aliq: null, credSn: 0, valor: 0 });
    });
    sist.forEach(r => { total += num(r[26]); });
    out.analista = { decisoes, total };
  }
  return out;
}

// ─── regras ──────────────────────────────────────────────────────────────────
export const CFOPS_APURADOS = ['1102', '1910'];
const CST_FORA = ['40', '41', '60'];
export const cfopApurado = (it: Item) => CFOPS_APURADOS.includes(it.cfop.slice(0, 4));
const cstFinal = (it: Item) => it.cst.slice(-2).padStart(2, '0');
const NCM_27 = ['2204', '2205', '2206', '2208'];

const kProd = (it: Item) => `${it.cnpj}|${it.produto}`;
const kNcmForn = (it: Item) => `${it.cnpj}|${it.ncm}`;
const kNcm = (it: Item) => it.ncm;

function registrar(mapa: Record<string, Contagem>, chave: string, incluir: boolean, mes: string, aliq: number | null) {
  const c = mapa[chave] ?? (mapa[chave] = { inc: 0, exc: 0, ultima: incluir, ultimoMes: '' });
  if (incluir) c.inc++; else c.exc++;
  if (ordemMes(mes) >= ordemMes(c.ultimoMes)) { c.ultima = incluir; c.ultimoMes = mes; }
  if (incluir && aliq) { c.aliq = c.aliq ?? {}; c.aliq[String(aliq)] = (c.aliq[String(aliq)] ?? 0) + 1; }
}

/** Grava na memória as decisões de uma apuração (da analista ou finalizada no app). */
export function aprender(mem: Memoria, itens: Item[], decisao: (it: Item) => { incluir: boolean; aliq: number | null }, mes: string) {
  const m: Memoria = JSON.parse(JSON.stringify(mem));
  itens.filter(cfopApurado).forEach(it => {
    const d = decisao(it);
    registrar(m.produtos, kProd(it), d.incluir, mes, d.aliq);
    registrar(m.ncmForn, kNcmForn(it), d.incluir, mes, d.aliq);
    registrar(m.ncm, kNcm(it), d.incluir, mes, d.aliq);
  });
  if (mes && !m.meses.includes(mes)) m.meses = [...m.meses, mes].sort((a, b) => ordemMes(a) - ordemMes(b));
  return m;
}

const aliqMaisUsada = (c?: Contagem) => {
  if (!c?.aliq) return null;
  const [a] = Object.entries(c.aliq).sort((x, y) => y[1] - x[1])[0] ?? [];
  return a ? Number(a) : null;
};

export function decidir(it: Item, mem: Memoria): Decisao {
  const cp = mem.produtos[kProd(it)], cnf = mem.ncmForn[kNcmForn(it)], cn = mem.ncm[kNcm(it)];
  const aliq = aliqMaisUsada(cp) ?? aliqMaisUsada(cnf) ?? aliqMaisUsada(cn)
    ?? (it.aliqDest >= 27 || NCM_27.includes(it.ncm.replace(/\D/g, '').slice(0, 4)) ? 27 : 20.5);
  const base = { aliq, credSn: 0 };

  const descreve = (c: Contagem) => `${c.inc}× incluído, ${c.exc}× excluído (último: ${c.ultimoMes || '—'})`;
  if (!cfopApurado(it)) {
    // Produto que a analista já apurou antes (lançado como 1102), mas que veio do Questor com outro CFOP de entrada:
    // costuma ser lançamento a corrigir (ex.: 1403 em fornecedor do Simples). Inclui e manda revisar.
    if (cp?.ultima && it.cfop.startsWith('14')) return { ...base, incluir: true, origem: 'produto', conflito: true,
      motivo: `CFOP ${it.cfop} no Questor, mas este produto entrou na apuração antes (${descreve(cp)}). Conferir o lançamento.` };
    return { ...base, incluir: false, origem: 'cfop', motivo: `CFOP ${it.cfop} fora da apuração` };
  }
  if (cp) return { ...base, incluir: cp.ultima, origem: 'produto', motivo: `Mesmo produto do fornecedor: ${descreve(cp)}`, conflito: cp.inc > 0 && cp.exc > 0 };
  if (cnf) return { ...base, incluir: cnf.ultima, origem: 'ncm-fornecedor', motivo: `Mesmo NCM deste fornecedor: ${descreve(cnf)}`, conflito: cnf.inc > 0 && cnf.exc > 0 };
  if (cn) {
    const t = cn.inc + cn.exc, maior = cn.inc >= cn.exc;
    if (Math.max(cn.inc, cn.exc) / t >= 0.8) return { ...base, incluir: maior, origem: 'ncm', motivo: `NCM ${it.ncm} em outros fornecedores: ${descreve(cn)}` };
  }
  const fora = CST_FORA.includes(cstFinal(it));
  return { ...base, incluir: !fora, origem: 'cst', motivo: fora ? `CST ${it.cst} (isento, não tributado ou ST)` : `CST ${it.cst} tributado — sem histórico` };
}

export const antecipado = (it: Item, d: Decisao) => (d.incluir ? it.valor * 1.25 * (d.aliq / 100) - it.icms - d.credSn : 0);

// ─── exportação no layout da analista ────────────────────────────────────────
export function exportarExcel(nomeArquivo: string, cabecalho: unknown[], itens: Item[], dec: Map<number, Decisao>) {
  const wb = XLSX.utils.book_new();
  const cab = cabecalho.slice(0, 19);
  const crua = XLSX.utils.aoa_to_sheet([cab, ...itens.map(i => i.linha)]);
  XLSX.utils.book_append_sheet(wb, crua, nomeArquivo.replace(/\.xlsx$/i, '').slice(0, 31) || 'CRUA');
  const apurados = itens.filter(cfopApurado);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...apurados.map(i => i.linha)]), 'ITENS');

  const incl = itens.filter(i => dec.get(i.id)?.incluir);
  const resumo = new Map<string, [number, number]>();
  incl.forEach(i => { const r = resumo.get(i.tipo) ?? [0, 0]; r[0] += i.valor; r[1] += antecipado(i, dec.get(i.id)!); resumo.set(i.tipo, r); });
  const linhasResumo: unknown[][] = [[], [], ['Tipo Fornecedor', 'Soma de Valor Total', 'Soma de VALOR DO ICMS ANTECIPADO']];
  let tv = 0, ta = 0;
  [...resumo.entries()].sort().forEach(([t, [v, a]]) => { linhasResumo.push([t, v, a]); tv += v; ta += a; });
  linhasResumo.push(['Total geral', tv, ta]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhasResumo), 'ICMS');

  const extra = ['VALOR TOTAL LIQUIDO', 'VALOR DO ICMS DESC', 'ALIQ ICMS', 'CRED SIMPLES NACIONAL', 'PERC SISTEMATICA 25%', 'BASE DE CALC SISTEMATICA', 'BC SISTEMATICA * ALIQ INTERNA', 'VALOR DO ICMS ANTECIPADO'];
  const sist = XLSX.utils.aoa_to_sheet([[...cab, ...extra], ...incl.map(i => [...i.linha])]);
  incl.forEach((it, idx) => {
    const r = idx + 2, d = dec.get(it.id)!;
    const f = (col: string, formula: string) => { sist[`${col}${r}`] = { t: 'n', f: formula }; };
    f('T', `O${r}`); f('U', `S${r}`); f('V', `R${r}`);
    if (d.credSn) sist[`W${r}`] = { t: 'n', v: d.credSn };
    f('X', `T${r}*25%`); f('Y', `T${r}+X${r}`);
    f('Z', `Y${r}*${String(d.aliq)}%`); f('AA', `Z${r}-U${r}-W${r}`);
  });
  sist['!ref'] = `A1:AA${incl.length + 1}`;
  XLSX.utils.book_append_sheet(wb, sist, 'SISTEMATICA');
  XLSX.writeFile(wb, nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`);
}
