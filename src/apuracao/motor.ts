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
  /** Comparação da nota deste mês com a do último mês em que o produto apareceu (quando o histórico tem essa informação). */
  nota?: { igual: boolean; antes: string; agora: string };
}

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
  // mês pelo nome do arquivo; se não houver, pelo mês mais frequente da Data Entrada
  let mes = mesDoNome(file.name);
  if (!mes) {
    const cont = new Map<string, number>();
    itens.forEach(i => { const m = i.data.match(/^\d{2}\/(\d{2})\/(\d{4})/); if (m) cont.set(`${m[1]}/${m[2]}`, (cont.get(`${m[1]}/${m[2]}`) ?? 0) + 1); });
    mes = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }
  const out: ArquivoLido = { nome: file.name, mes, itens, cabecalho };

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
// Regras gerais (valem para todos os clientes).
export const CFOPS_APURADOS = ['1102', '1910'];
const CST_FORA = ['40', '41', '60'];
export const PERC_SISTEMATICA = 0.25;
export const ALIQ_PADRAO = 20.5;
const NCM_27 = ['2204', '2205', '2206', '2208'];
export const cfopApurado = (it: Item) => CFOPS_APURADOS.includes(it.cfop.slice(0, 4));
const cstFinal = (it: Item) => it.cst.slice(-2).padStart(2, '0');
const aliqGeral = (it: Item) => (it.aliqDest >= 27 || NCM_27.includes(it.ncm.replace(/\D/g, '').slice(0, 4)) ? 27 : ALIQ_PADRAO);

// Regras de cada cliente: uma por produto do fornecedor, com o histórico de decisões mês a mês.
/**
 * [mês "MM/AAAA", incluiu (1/0), alíquota interna, confirmada pela analista (1/0),
 *  CST final da nota, nota com ICMS destacado (1/0), CFOP]
 * Os três últimos foram acrescentados depois: passos antigos podem não ter.
 */
export type Passo = [string, 0 | 1, number, 0 | 1, string?, (0 | 1)?, string?];

/** Como a nota veio: o que se compara de um mês para o outro. */
export const notaDoItem = (it: Item) => ({ cst: it.cst.slice(-2).padStart(2, '0'), icms: (it.icms > 0 ? 1 : 0) as 0 | 1, cfop: it.cfop.slice(0, 4) });
export const descreverNota = (cst?: string, icms?: 0 | 1, cfop?: string) =>
  [cst !== undefined ? `CST ${cst}` : '', icms !== undefined ? (icms ? 'com ICMS' : 'sem ICMS') : '', cfop ? `CFOP ${cfop}` : ''].filter(Boolean).join(', ');
export interface RegraProduto {
  cnpj: string; cod: string; desc: string; ncm: string; tipo: string; h: Passo[];
  /** Só na simulação com regras de várias empresas: de qual empresa veio e se elas discordam. */
  fonte?: string; fontes?: string[]; porFonte?: Record<string, 0 | 1>; discorda?: string;
}
export interface Memoria { produtos: Record<string, RegraProduto>; meses: string[] }
export const memoriaVazia = (): Memoria => ({ produtos: {}, meses: [] });

const normDesc = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const kProd = (cnpj: string, cod: string) => `${cnpj}|${cod}`;
const ultimo = (r: RegraProduto) => r.h[r.h.length - 1];

interface Agregado { inc: number; exc: number; ultima: boolean; ultimoMes: string; aliq: number | null }
export interface Indice {
  porCodigo: Map<string, RegraProduto>;
  porDescricao: Map<string, RegraProduto>;
  /** 'codigo' = mesma empresa (código do produto no Questor); 'descricao' = simulação com regras de outras empresas. */
  modo: 'codigo' | 'descricao';
  ncmForn: Map<string, Agregado>;
  ncm: Map<string, Agregado>;
}
/** Monta os atalhos de busca a partir das regras por produto (NCM do fornecedor e NCM do cliente são derivados). */
export function indexar(mem: Memoria, modo: 'codigo' | 'descricao' = 'codigo'): Indice {
  const idx: Indice = { porCodigo: new Map(), porDescricao: new Map(), ncmForn: new Map(), ncm: new Map(), modo };
  const soma = (m: Map<string, Agregado>, k: string, r: RegraProduto) => {
    const u = ultimo(r); if (!u) return;
    const a = m.get(k) ?? { inc: 0, exc: 0, ultima: !!u[1], ultimoMes: '', aliq: null };
    r.h.forEach(p => { if (p[1]) a.inc++; else a.exc++; });
    if (ordemMes(u[0]) >= ordemMes(a.ultimoMes)) { a.ultima = !!u[1]; a.ultimoMes = u[0]; if (u[1]) a.aliq = u[2]; }
    m.set(k, a);
  };
  Object.values(mem.produtos).forEach(r => {
    idx.porCodigo.set(kProd(r.cnpj, r.cod), r);
    if (r.desc) {
      // Na simulação o código do produto é de outra empresa, então o produto é reconhecido por fornecedor + descrição.
      // Se mais de uma empresa tem o mesmo produto, junta os históricos e anota se as últimas decisões discordam.
      const k = `${r.cnpj}|${r.desc}`, ant = idx.porDescricao.get(k);
      const ultimaDe = (x: RegraProduto) => (x.h[x.h.length - 1]?.[1] ?? 0) as 0 | 1;
      if (!ant) idx.porDescricao.set(k, { ...r, fontes: r.fonte ? [r.fonte] : undefined, porFonte: r.fonte ? { [r.fonte]: ultimaDe(r) } : undefined });
      else {
        const porFonte = { ...(ant.porFonte ?? {}), ...(r.fonte ? { [r.fonte]: ultimaDe(r) } : {}) };
        const junto: RegraProduto = { ...ant, h: [...ant.h, ...r.h].sort((x, y) => ordemMes(x[0]) - ordemMes(y[0])), fontes: Object.keys(porFonte), porFonte };
        junto.discorda = new Set(Object.values(porFonte)).size > 1
          ? `As empresas escolhidas discordam sobre este produto: ${Object.entries(porFonte).map(([f, inc]) => `${f} ${inc ? 'incluído' : 'excluído'}`).join(', ')}.`
          : undefined;
        idx.porDescricao.set(k, junto);
      }
    }
    soma(idx.ncmForn, `${r.cnpj}|${r.ncm}`, r);
    soma(idx.ncm, r.ncm, r);
  });
  return idx;
}

/** Texto curto do histórico de um produto, para o motivo e para a confirmação. */
export function resumoHistorico(r: RegraProduto) {
  const inc = r.h.filter(p => p[1]).length, exc = r.h.length - inc, u = ultimo(r);
  const ult = u ? `${u[1] ? `incluído a ${String(u[2]).replace('.', ',')}%` : 'excluído'} em ${u[0]}` : '—';
  return { inc, exc, ultimoTexto: ult, texto: `${inc}× incluído, ${exc}× excluído · último: ${ult}` };
}

export function regraDoItem(it: Item, idx: Indice): RegraProduto | undefined {
  // Só pelo código: casar pela descrição puxava decisões de códigos antigos e piorou o acerto nos testes.
  if (idx.modo === 'descricao') return idx.porDescricao.get(`${it.cnpj}|${normDesc(it.descricao)}`);
  return idx.porCodigo.get(kProd(it.cnpj, it.produto));
}

export function decidir(it: Item, idx: Indice): Decisao {
  const rp = regraDoItem(it, idx);
  const anf = idx.ncmForn.get(`${it.cnpj}|${it.ncm}`), an = idx.ncm.get(it.ncm);
  const u = rp ? ultimo(rp) : undefined;
  const aliq = (u && u[1] ? u[2] : null) ?? anf?.aliq ?? an?.aliq ?? aliqGeral(it);
  const base: { aliq: number; credSn: number; nota?: Decisao['nota'] } = { aliq, credSn: 0 };
  // decisão mais recente diferente da anterior e não confirmada pela analista → revisar
  const mudou = !!rp && !rp.fontes?.length && rp.h.length > 1 && !!u && !u[3] && rp.h[rp.h.length - 2][1] !== u[1];
  // a nota deste mês veio diferente (CST ou ICMS destacado) da última vez que o produto apareceu?
  const agora = notaDoItem(it);
  const nota = u && u[4] !== undefined
    ? { igual: u[4] === agora.cst && u[5] === agora.icms, antes: descreverNota(u[4], u[5], u[6]), agora: descreverNota(agora.cst, agora.icms, agora.cfop) }
    : undefined;
  base.nota = nota;

  if (!cfopApurado(it)) {
    // CFOP 14xx (compra com ST) fica fora. Se o produto já entrou na apuração antes, avisa: pode ser lançamento a corrigir,
    // mas quem inclui é a analista (incluir sozinho errava casos como Pringles 1403 em out/2026).
    if (u?.[1] && it.cfop.startsWith('14')) return { ...base, incluir: false, origem: 'cfop', conflito: true,
      motivo: `CFOP ${it.cfop} no Questor: fica fora. Mas este produto já entrou na apuração antes (${resumoHistorico(rp!).texto}).` };
    return { ...base, incluir: false, origem: 'cfop', motivo: `CFOP ${it.cfop} fora da apuração` };
  }
  if (rp && u && rp.discorda) {
    // regras de empresas diferentes que se contradizem: segue a maioria (empate = mais recente) e manda revisar
    const inc = rp.h.filter(p => p[1]).length, exc = rp.h.length - inc;
    return { ...base, incluir: inc === exc ? !!u[1] : inc > exc, origem: 'produto', conflito: true, motivo: rp.discorda };
  }
  if (rp && u) {
    const notaMudou = !!nota && !nota.igual;
    return { ...base, incluir: !!u[1], origem: 'produto', conflito: mudou || notaMudou,
      motivo: `Histórico do produto: ${resumoHistorico(rp).texto}${mudou ? '. A decisão mudou no último mês.' : ''}${notaMudou ? `. A nota mudou: antes ${nota!.antes}, agora ${nota!.agora}.` : ''}` };
  }
  const desc = (a: Agregado) => `${a.inc}× incluído, ${a.exc}× excluído (último: ${a.ultimoMes || '—'})`;
  if (anf) return { ...base, incluir: anf.ultima, origem: 'ncm-fornecedor', motivo: `Mesmo NCM deste fornecedor: ${desc(anf)}`, conflito: anf.inc > 0 && anf.exc > 0 };
  if (an && Math.max(an.inc, an.exc) / (an.inc + an.exc) >= 0.8)
    return { ...base, incluir: an.inc >= an.exc, origem: 'ncm', motivo: `NCM ${it.ncm} em outros fornecedores: ${desc(an)}` };
  const fora = CST_FORA.includes(cstFinal(it));
  return { ...base, incluir: !fora, origem: 'cst', motivo: fora ? `CST ${it.cst} (isento, não tributado ou ST)` : `CST ${it.cst} tributado — sem histórico` };
}

/**
 * Grava na memória as decisões de um mês (planilha da analista ou apuração finalizada no app).
 * Cada produto ganha um passo no histórico; se o mês já existia, é substituído.
 */
export function aprender(mem: Memoria, itens: Item[], decisao: (it: Item) => { incluir: boolean; aliq: number | null; confirmado?: boolean }, mes: string): Memoria {
  const m: Memoria = { produtos: { ...mem.produtos }, meses: [...mem.meses] };
  const porProduto = new Map<string, { it: Item; inc: number; exc: number; aliq: number | null; conf: boolean; notas: Map<string, number> }>();
  itens.forEach(it => {
    const d = decisao(it);
    if (!cfopApurado(it) && !d.incluir) return;
    const k = kProd(it.cnpj, it.produto);
    const a = porProduto.get(k) ?? { it, inc: 0, exc: 0, aliq: null, conf: false, notas: new Map() };
    if (d.incluir) { a.inc++; if (d.aliq) a.aliq = d.aliq; } else a.exc++;
    const n = notaDoItem(it), kn = `${n.cst}|${n.icms}|${n.cfop}`;
    a.notas.set(kn, (a.notas.get(kn) ?? 0) + 1);
    if (d.confirmado) a.conf = true;
    porProduto.set(k, a);
  });
  porProduto.forEach((a, k) => {
    const ant = m.produtos[k];
    const r: RegraProduto = ant ? { ...ant, h: ant.h.filter(p => p[0] !== mes) }
      : { cnpj: a.it.cnpj, cod: a.it.produto, desc: normDesc(a.it.descricao), ncm: a.it.ncm, tipo: a.it.tipo, h: [] };
    r.ncm = a.it.ncm; r.desc = normDesc(a.it.descricao); r.tipo = a.it.tipo;
    const incluiu = a.inc >= a.exc;
    // a nota mais frequente do produto no mês
    const [cst, icms, cfop] = [...a.notas.entries()].sort((x, y) => y[1] - x[1])[0][0].split('|');
    r.h = [...r.h, [mes, incluiu ? 1 : 0, incluiu ? (a.aliq ?? ALIQ_PADRAO) : 0, a.conf ? 1 : 0, cst, (icms === '1' ? 1 : 0) as 0 | 1, cfop] as Passo]
      .sort((x, y) => ordemMes(x[0]) - ordemMes(y[0]));
    m.produtos[k] = r;
  });
  if (mes && !m.meses.includes(mes)) m.meses = [...m.meses, mes].sort((a, b) => ordemMes(a) - ordemMes(b));
  return m;
}

export const antecipado = (it: Item, d: Decisao) => (d.incluir ? it.valor * (1 + PERC_SISTEMATICA) * (d.aliq / 100) - it.icms : 0);

// ─── exportação no layout da analista ────────────────────────────────────────
/** Largura de cada coluna pelo maior texto (como o "autoajuste" do Excel), com mínimo e máximo. */
function ajustarLarguras(ws: XLSX.WorkSheet, minimo = 8, maximo = 60) {
  if (!ws['!ref']) return;
  const r = XLSX.utils.decode_range(ws['!ref']);
  const cols: { wch: number }[] = [];
  for (let c = r.s.c; c <= r.e.c; c++) {
    let w = minimo;
    for (let l = r.s.r; l <= r.e.r; l++) {
      const cel = ws[XLSX.utils.encode_cell({ r: l, c })];
      if (!cel) continue;
      const t = cel.f ? 14 : typeof cel.v === 'number' ? cel.v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }).length + 2 : String(cel.v ?? '').length + 2;
      if (t > w) w = t;
    }
    cols.push({ wch: Math.min(w, maximo) });
  }
  ws['!cols'] = cols;
}

/** Números e fórmulas com duas casas decimais (só a exibição; o valor guardado não muda). */
function formatarNumeros(ws: XLSX.WorkSheet) {
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const cel = ws[k] as XLSX.CellObject;
    if (cel && (cel.t === 'n' || cel.f)) cel.z = '#,##0.00';
  }
}

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
    f('X', `T${r}*25%`); f('Y', `T${r}+X${r}`);
    f('Z', `Y${r}*${String(d.aliq)}%`); f('AA', `Z${r}-U${r}-W${r}`);
  });
  sist['!ref'] = `A1:AA${incl.length + 1}`;
  XLSX.utils.book_append_sheet(wb, sist, 'SISTEMATICA');
  wb.SheetNames.forEach(n => { formatarNumeros(wb.Sheets[n]); ajustarLarguras(wb.Sheets[n]); });
  XLSX.writeFile(wb, nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`);
}
