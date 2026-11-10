import React, { useMemo, useRef, useState } from 'react';
import { Upload, History, Check, X, Download, Save, AlertTriangle, Search, Trash2, RotateCcw, ArrowLeft } from 'lucide-react';
import {
  lerArquivo, decidir, aprender, antecipado, exportarExcel, cfopApurado, memoriaVazia, mesDoNome,
  type ArquivoLido, type Decisao, type Item, type Memoria, type Origem,
} from './motor';

// ─── persistência local (protótipo) ──────────────────────────────────────────
const LS = 'apuracao-prototipo-v1';
type Banco = Record<string, Memoria>;
const lerBanco = (): Banco => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
const gravarBanco = (b: Banco) => { try { localStorage.setItem(LS, JSON.stringify(b)); } catch { /* cheio */ } };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ORIGEM: Record<Origem, { rotulo: string; cor: string }> = {
  cfop: { rotulo: 'CFOP', cor: 'bg-stone-100 text-stone-600' },
  produto: { rotulo: 'Histórico · produto', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  'ncm-fornecedor': { rotulo: 'Histórico · NCM+forn.', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  ncm: { rotulo: 'Histórico · NCM', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  cst: { rotulo: 'Regra CST', cor: 'bg-sky-50 text-sky-700' },
  manual: { rotulo: 'Manual', cor: 'bg-violet-50 text-violet-700' },
};

type Aba = 'crua' | 'itens' | 'icms' | 'sistematica' | 'revisar' | 'divergencias';

/** Apuração a partir da planilha crua do Questor. As regras aprendidas ficam separadas por cliente. */
export default function ApuracaoApp({ clienteId, clienteNome, onVoltar }: { clienteId: string; clienteNome: string; onVoltar: () => void }) {
  const [banco, setBanco] = useState<Banco>(lerBanco);
  const cliente = `cliente:${clienteId}`;
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [manuais, setManuais] = useState<Map<number, Partial<Decisao>>>(new Map());
  const [aba, setAba] = useState<Aba>('sistematica');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(150);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState('');
  const inputHist = useRef<HTMLInputElement>(null);
  const inputCrua = useRef<HTMLInputElement>(null);

  const mem = banco[cliente] ?? memoriaVazia();
  const salvarMem = (m: Memoria) => { const b = { ...banco, [cliente]: m }; setBanco(b); gravarBanco(b); };

  // ── decisões ──
  const automaticas = useMemo(() => {
    const m = new Map<number, Decisao>();
    arquivo?.itens.forEach(it => m.set(it.id, decidir(it, mem)));
    return m;
  }, [arquivo, mem]);
  const decisoes = useMemo(() => {
    const m = new Map<number, Decisao>();
    automaticas.forEach((d, id) => { const o = manuais.get(id); m.set(id, o ? { ...d, ...o } : d); });
    return m;
  }, [automaticas, manuais]);

  const itens = arquivo?.itens ?? [];
  const totais = useMemo(() => {
    let normal = 0, simples = 0, valorInc = 0, nInc = 0;
    itens.forEach(it => {
      const d = decisoes.get(it.id)!; if (!d?.incluir) return;
      const v = antecipado(it, d); nInc++; valorInc += it.valor;
      if (it.tipo.toUpperCase().includes('SIMPLES')) simples += v; else normal += v;
    });
    return { normal, simples, total: normal + simples, valorInc, nInc, valorTudo: itens.reduce((s, i) => s + i.valor, 0) };
  }, [itens, decisoes]);

  const ana = arquivo?.analista;
  const divergentes = useMemo(() => {
    if (!ana) return new Set<number>();
    const s = new Set<number>();
    itens.forEach(it => {
      const a = ana.decisoes.get(it.id), d = decisoes.get(it.id)!;
      if (!a) return;
      if (a.incluir !== d.incluir || (a.incluir && a.aliq && Math.abs(a.aliq - d.aliq) > 0.01)) s.add(it.id);
    });
    return s;
  }, [ana, itens, decisoes]);

  const precisaRevisar = (it: Item, d: Decisao) =>
    !!d.conflito || (cfopApurado(it) && (d.origem === 'cst' || (d.incluir && d.aliq !== 20.5)));

  const listas = useMemo(() => ({
    crua: itens,
    itens: itens.filter(i => cfopApurado(i) || decisoes.get(i.id)?.incluir),
    icms: [] as Item[],
    sistematica: itens.filter(i => decisoes.get(i.id)?.incluir),
    revisar: itens.filter(i => precisaRevisar(i, decisoes.get(i.id)!)),
    divergencias: itens.filter(i => divergentes.has(i.id)),
  }), [itens, decisoes, divergentes]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const l = listas[aba];
    if (!q) return l;
    return l.filter(i => `${i.razao} ${i.descricao} ${i.ncm} ${i.cfop} ${i.cst} ${i.produto}`.toUpperCase().includes(q));
  }, [listas, aba, busca]);

  const resumoIcms = useMemo(() => {
    const m = new Map<string, [number, number]>();
    listas.sistematica.forEach(i => { const r = m.get(i.tipo) ?? [0, 0]; r[0] += i.valor; r[1] += antecipado(i, decisoes.get(i.id)!); m.set(i.tipo, r); });
    const linhas = [...m.entries()].sort().map(([t, [v, a]]) => [t, v, a] as [string, number, number]);
    return { linhas, valor: linhas.reduce((s, l) => s + l[1], 0), antecipado: linhas.reduce((s, l) => s + l[2], 0) };
  }, [listas, decisoes]);

  // colunas no layout da planilha (A–S do Questor; T–AA calculadas na aba SISTEMATICA)
  type Col = { letra: string; titulo: string; dir?: boolean; calc?: boolean; largura?: number; celula: (it: Item, d: Decisao) => React.ReactNode };
  const colunas: Col[] = useMemo(() => {
    const base: Col[] = [
      { letra: 'A', titulo: 'Fornecedor', celula: it => it.fornecedor },
      { letra: 'B', titulo: 'Razão Social', largura: 220, celula: it => <span title={it.razao}>{it.razao}</span> },
      { letra: 'C', titulo: 'CNPJ/CPF/CNO', celula: it => it.cnpj },
      { letra: 'D', titulo: 'Tipo Fornecedor', celula: it => it.tipo },
      { letra: 'E', titulo: 'Número', celula: it => it.numero },
      { letra: 'F', titulo: 'Data Entrada', celula: it => it.data },
      { letra: 'G', titulo: 'Chave de Acesso', largura: 110, celula: it => <span title={it.chave}>{it.chave}</span> },
      { letra: 'H', titulo: 'Produto', celula: it => it.produto },
      { letra: 'I', titulo: 'Descrição', largura: 300, celula: it => <span title={it.descricao}>{it.descricao}</span> },
      { letra: 'J', titulo: 'Classificação Fiscal', celula: it => it.ncm },
      { letra: 'K', titulo: 'Natureza', celula: it => it.cfop },
      { letra: 'L', titulo: 'Unidade Medida', celula: it => it.un },
      { letra: 'M', titulo: 'Quantidade', dir: true, celula: it => it.qtd.toLocaleString('pt-BR') },
      { letra: 'N', titulo: 'Valor Unitário', dir: true, celula: it => n2(it.vunit) },
      { letra: 'O', titulo: 'Valor Total', dir: true, celula: it => n2(it.valor) },
      { letra: 'P', titulo: 'CST ICMS', celula: it => it.cst },
      { letra: 'Q', titulo: 'Base Cálculo ICMS', dir: true, celula: it => n2(it.bc) },
      { letra: 'R', titulo: 'Alíquota ICMS', dir: true, celula: it => n2(it.aliqDest) },
      { letra: 'S', titulo: 'Valor ICMS', dir: true, celula: it => n2(it.icms) },
    ];
    if (aba === 'crua' || aba === 'itens') return base;
    const so = (d: Decisao, v: React.ReactNode) => (d.incluir ? v : '');
    return [...base,
      { letra: 'T', titulo: 'VALOR TOTAL LIQUIDO', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor)) },
      { letra: 'U', titulo: 'VALOR DO ICMS DESC', dir: true, calc: true, celula: (it, d) => so(d, n2(it.icms)) },
      { letra: 'V', titulo: 'ALIQ ICMS', dir: true, calc: true, celula: (it, d) => so(d, n2(it.aliqDest)) },
      { letra: 'W', titulo: 'CRED SIMPLES NACIONAL', dir: true, calc: true, celula: (it, d) => so(d, it.tipo.toUpperCase().includes('SIMPLES')
        ? <input type="number" step="0.01" value={d.credSn || ''} placeholder="0,00" onChange={e => mudarCred(it, Number(e.target.value) || 0)}
            className="w-20 border border-[#C8C8C8] rounded px-1 text-[11px] text-right bg-white" />
        : '') },
      { letra: 'X', titulo: 'PERC SISTEMATICA 25%', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor * 0.25)) },
      { letra: 'Y', titulo: 'BASE DE CALC SISTEMATICA', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor * 1.25)) },
      { letra: 'Z', titulo: 'BC SISTEMATICA * ALIQ INTERNA', dir: true, calc: true, celula: (it, d) => so(d, <span className="inline-flex items-center gap-1.5">
          <select value={d.aliq} onChange={e => mudarAliq(it, Number(e.target.value))}
            className={`border rounded px-0.5 text-[11px] ${d.aliq !== 20.5 ? 'border-[#C9A227] bg-[#FBF7EA]' : 'border-[#C8C8C8] bg-white'}`}>
            {[...new Set([20.5, 27, d.aliq])].map(v => <option key={v} value={v}>{String(v).replace('.', ',')}%</option>)}
          </select>{n2(it.valor * 1.25 * d.aliq / 100)}</span>) },
      { letra: 'AA', titulo: 'VALOR DO ICMS ANTECIPADO', dir: true, calc: true, celula: (it, d) => so(d, <b>{n2(antecipado(it, d))}</b>) },
    ];
  }, [aba, manuais, itens]);

  // ── ações ──
  const alternar = (it: Item) => {
    const atual = decisoes.get(it.id)!;
    const novo = !atual.incluir;
    const m = new Map<number, Partial<Decisao>>(manuais);
    // o mesmo produto do mesmo fornecedor muda junto nesta apuração
    itens.filter(o => o.cnpj === it.cnpj && o.produto === it.produto && cfopApurado(o) === cfopApurado(it))
      .forEach(o => m.set(o.id, { ...(m.get(o.id) ?? {}), incluir: novo, origem: 'manual', motivo: novo ? 'Incluído manualmente' : 'Excluído manualmente' }));
    setManuais(m);
  };
  const mudarAliq = (it: Item, aliq: number) => {
    const m = new Map<number, Partial<Decisao>>(manuais);
    itens.filter(o => o.cnpj === it.cnpj && o.produto === it.produto).forEach(o => m.set(o.id, { ...(m.get(o.id) ?? {}), aliq }));
    setManuais(m);
  };
  const mudarCred = (it: Item, credSn: number) => { const m = new Map<number, Partial<Decisao>>(manuais); m.set(it.id, { ...(m.get(it.id) ?? {}), credSn }); setManuais(m); };

  async function importarHistorico(files: FileList | null) {
    if (!files?.length || !cliente) return;
    setErro(''); setAviso('');
    const lista = [...files].sort((a, b) => {
      const o = (n: string) => { const [m, y] = (mesDoNome(n) || '00/0000').split('/').map(Number); return y * 100 + m; };
      return o(a.name) - o(b.name);
    });
    let m = mem; const ok: string[] = [], falhas: string[] = [];
    for (const f of lista) {
      setCarregando(`Lendo ${f.name}…`);
      try {
        const a = await lerArquivo(f);
        if (!a.analista) { falhas.push(`${f.name} (sem aba SISTEMATICA)`); continue; }
        m = aprender(m, a.itens, it => a.analista!.decisoes.get(it.id)!, a.mes || f.name);
        ok.push(a.mes || f.name);
      } catch (e) { falhas.push(`${f.name} (${(e as Error).message})`); }
    }
    setCarregando('');
    salvarMem(m);
    setAviso(`Histórico atualizado com ${ok.length} apuração(ões)${falhas.length ? `. Não lidas: ${falhas.join('; ')}` : '.'}`);
  }

  async function abrirCrua(file: File | undefined) {
    if (!file) return;
    setErro(''); setAviso(''); setCarregando(`Lendo ${file.name}…`);
    try {
      const a = await lerArquivo(file);
      if (a.mes && mem.meses.includes(a.mes)) setAviso(`Atenção: ${a.mes} já está no histórico deste cliente. Como o app já conhece as decisões deste mês, o resultado tende a sair igual ao da analista.`);
      setArquivo(a); setManuais(new Map()); setAba(a.analista ? 'divergencias' : 'sistematica'); setLimite(150);
    } catch (e) { setErro((e as Error).message); }
    setCarregando('');
  }

  function salvarNoHistorico() {
    if (!arquivo) return;
    const mes = arquivo.mes || arquivo.nome;
    salvarMem(aprender(mem, arquivo.itens, it => { const d = decisoes.get(it.id)!; return { incluir: d.incluir, aliq: d.aliq }; }, mes));
    setAviso(`Decisões de ${mes} gravadas no histórico de ${clienteNome}. A próxima apuração já parte delas.`);
  }

  const qtdProdutos = Object.keys(mem.produtos).length;

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#17150F] font-report">
      <header className="border-b border-[#E7E2D6] bg-[#17150F] text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onVoltar} title="Voltar ao cliente" className="bg-white/10 hover:bg-white/20 p-2 rounded-lg border border-white/10">
            <ArrowLeft className="w-5 h-5 text-[#C9A227]" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] font-semibold">Apuração da Sistemática · em teste</p>
            <h1 className="font-display text-2xl">{clienteNome}</h1>
          </div>
          <p className="ml-auto text-xs text-white/60 max-w-sm text-right">As regras aprendidas ficam neste navegador e valem só para este cliente. Nada é gravado no Supabase.</p>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        {/* cliente + histórico */}
        <section>
          <div className="bg-white border border-[#E7E2D6] rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mb-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Histórico de regras</p>
                {cliente ? (
                  <p className="text-sm">
                    {mem.meses.length ? <><b>{mem.meses.length}</b> mês(es) aprendidos ({mem.meses.join(', ')}) · <b>{qtdProdutos.toLocaleString('pt-BR')}</b> produtos conhecidos</>
                      : <span className="text-stone-500">Nenhum mês aprendido ainda. Importe as apurações já feitas pela analista.</span>}
                  </p>
                ) : <p className="text-sm text-stone-500">Crie ou selecione um cliente.</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button disabled={!cliente} onClick={() => inputHist.current?.click()}
                  className="flex items-center gap-1.5 border border-[#C9A227] text-[#7A6110] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#F4EDD3] disabled:opacity-30">
                  <Upload className="w-3.5 h-3.5" />Importar apurações feitas
                </button>
                {mem.meses.length > 0 && (
                  <button onClick={() => { if (confirm(`Apagar o histórico de ${clienteNome} neste navegador?`)) salvarMem(memoriaVazia()); }}
                    className="text-stone-400 hover:text-red-600 px-2" title="Limpar histórico"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
            <input ref={inputHist} type="file" accept=".xlsx" multiple hidden onChange={e => { importarHistorico(e.target.files); e.target.value = ''; }} />
          </div>
        </section>

        {(erro || aviso || carregando) && (
          <div className={`text-sm rounded-lg px-4 py-2.5 border ${erro ? 'bg-red-50 border-red-200 text-red-700' : 'bg-[#FBF7EA] border-[#E9DDB0] text-[#5E4B0C]'}`}>
            {carregando || erro || aviso}
          </div>
        )}

        {/* anexar planilha */}
        {(
          <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); abrirCrua(e.dataTransfer.files[0]); }}
            onClick={() => inputCrua.current?.click()}
            className="border-2 border-dashed border-[#D9CFAF] rounded-xl bg-white hover:bg-[#FBF7EA] cursor-pointer px-6 py-5 flex items-center gap-4">
            <Upload className="w-6 h-6 text-[#9A7B12]" />
            <div>
              <p className="font-semibold text-sm">{arquivo ? `${arquivo.nome} — trocar planilha` : 'Anexar a planilha crua do Questor'}</p>
              <p className="text-xs text-stone-500">Arraste ou clique. Se anexar uma apuração já feita pela analista, o app compara o resultado com o dela.</p>
            </div>
            <input ref={inputCrua} type="file" accept=".xlsx" hidden onChange={e => { abrirCrua(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}

        {arquivo && (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Kpi rotulo="ICMS antecipado" valor={brl(totais.total)} destaque />
              <Kpi rotulo="Fornecedores Normal" valor={brl(totais.normal)} />
              <Kpi rotulo="Fornecedores Simples" valor={brl(totais.simples)} />
              <Kpi rotulo="Itens na apuração" valor={`${totais.nInc} de ${itens.length}`} sub={`${brl(totais.valorInc)} de ${brl(totais.valorTudo)}`} />
              {ana ? (
                <Kpi rotulo="Apuração da analista" valor={brl(ana.total)}
                  sub={`Diferença ${brl(totais.total - ana.total)} · ${divergentes.size} item(ns) divergente(s)`}
                  alerta={Math.abs(totais.total - ana.total) > 1} />
              ) : <Kpi rotulo="A revisar" valor={String(listas.revisar.length)} sub="itens sem histórico ou com alíquota diferente" alerta={listas.revisar.length > 0} />}
            </section>

            {/* pasta de trabalho no formato da planilha da analista */}
            <section className="bg-white border border-[#D4D4D4] rounded-lg overflow-hidden" style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#D4D4D4] bg-[#F8F8F8]">
                <p className="text-[11px] text-stone-600">
                  {aba === 'crua' && 'Planilha do Questor como veio. ✓ = entra na apuração.'}
                  {aba === 'itens' && 'Itens com CFOP de compra para comercialização (1102) e bonificação (1910).'}
                  {aba === 'sistematica' && 'Itens que entram no cálculo, com as mesmas colunas e fórmulas da planilha.'}
                  {aba === 'icms' && 'Resumo por tipo de fornecedor (a tabela dinâmica da aba ICMS).'}
                  {aba === 'revisar' && 'Itens sem histórico, com decisão que mudou entre meses, CFOP a conferir ou alíquota diferente de 20,5%.'}
                  {aba === 'divergencias' && 'Itens em que o app decidiu diferente da apuração da analista.'}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  {aba !== 'icms' && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                      <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(150); }} placeholder="Localizar: fornecedor, produto, NCM, CFOP…"
                        className="border border-[#C8C8C8] rounded pl-8 pr-3 py-1 text-xs w-72 bg-white" />
                    </div>
                  )}
                  {manuais.size > 0 && (
                    <button onClick={() => setManuais(new Map())} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 px-2"><RotateCcw className="w-3.5 h-3.5" />Desfazer ajustes</button>
                  )}
                </div>
              </div>

              <div className="overflow-auto max-h-[64vh]">
                {aba === 'icms' ? (
                  <table className="text-[12px] border-collapse m-4">
                    <tbody>
                      <tr className="bg-[#DDEBF7] font-bold"><td className="border border-[#BFBFBF] px-3 py-1">Tipo Fornecedor</td><td className="border border-[#BFBFBF] px-3 py-1 text-right">Soma de Valor Total</td><td className="border border-[#BFBFBF] px-3 py-1 text-right">Soma de VALOR DO ICMS ANTECIPADO</td></tr>
                      {resumoIcms.linhas.map(([t, v, a]) => (
                        <tr key={t}><td className="border border-[#BFBFBF] px-3 py-1">{t}</td><td className="border border-[#BFBFBF] px-3 py-1 text-right tabular-nums">{n2(v)}</td><td className="border border-[#BFBFBF] px-3 py-1 text-right tabular-nums">{n2(a)}</td></tr>
                      ))}
                      <tr className="bg-[#DDEBF7] font-bold"><td className="border border-[#BFBFBF] px-3 py-1">Total geral</td><td className="border border-[#BFBFBF] px-3 py-1 text-right tabular-nums">{n2(resumoIcms.valor)}</td><td className="border border-[#BFBFBF] px-3 py-1 text-right tabular-nums">{n2(resumoIcms.antecipado)}</td></tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="text-[11.5px] border-collapse min-w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#F3F3F3] text-[#666]">
                        <th className="sticky left-0 z-20 bg-[#F3F3F3] border border-[#D4D4D4] w-10"></th>
                        <th className="border border-[#D4D4D4] w-8"></th>
                        {colunas.map(c => <th key={c.letra} className="border border-[#D4D4D4] font-normal px-1 py-0.5">{c.letra}</th>)}
                        <th className="border border-[#D4D4D4] font-normal px-1">Por quê</th>
                        {ana && <th className="border border-[#D4D4D4] font-normal px-1">Analista</th>}
                      </tr>
                      <tr className="bg-[#FFFFFF] text-[#17150F]">
                        <th className="sticky left-0 z-20 bg-[#F3F3F3] border border-[#D4D4D4] text-[#666] font-normal">1</th>
                        <th className="border border-[#D4D4D4] bg-white"></th>
                        {colunas.map(c => (
                          <th key={c.letra} className={`border border-[#D4D4D4] px-1.5 py-1 font-bold whitespace-nowrap ${c.calc ? 'bg-[#FFF2CC]' : 'bg-white'} ${c.dir ? 'text-right' : 'text-left'}`}>{c.titulo}</th>
                        ))}
                        <th className="border border-[#D4D4D4] bg-white"></th>
                        {ana && <th className="border border-[#D4D4D4] bg-white"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.slice(0, limite).map((it, idx) => {
                        const d = decisoes.get(it.id)!; const a = ana?.decisoes.get(it.id);
                        const linhaExcel = aba === 'crua' ? it.id + 2 : idx + 2;
                        return (
                          <tr key={it.id} className={`${divergentes.has(it.id) ? 'bg-red-50' : d.incluir ? 'bg-white' : 'bg-[#FAFAFA] text-[#A0A0A0]'} hover:bg-[#EAF2FB]`}>
                            <td className="sticky left-0 bg-[#F3F3F3] border border-[#D4D4D4] text-center text-[#666] tabular-nums">{linhaExcel}</td>
                            <td className="border border-[#D4D4D4] text-center px-0.5">
                              <button onClick={() => alternar(it)} title={d.incluir ? 'Excluir da apuração' : 'Incluir na apuração'}
                                className={`w-5 h-5 rounded flex items-center justify-center border mx-auto ${d.incluir ? 'bg-[#217346] border-[#217346] text-white' : 'border-[#C8C8C8] text-[#C8C8C8] hover:border-stone-500'}`}>
                                {d.incluir ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              </button>
                            </td>
                            {colunas.map(c => (
                              <td key={c.letra} className={`border border-[#E1E1E1] px-1.5 py-0.5 whitespace-nowrap ${c.dir ? 'text-right tabular-nums' : ''} ${c.calc && d.incluir ? 'bg-[#FFFBEA]' : ''}`}
                                style={c.largura ? { maxWidth: c.largura, overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}>
                                {c.celula(it, d)}
                              </td>
                            ))}
                            <td className="border border-[#E1E1E1] px-1.5">
                              <span title={d.motivo} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${ORIGEM[d.origem].cor}`}>
                                {d.conflito && <AlertTriangle className="w-3 h-3" />}{ORIGEM[d.origem].rotulo}
                              </span>
                            </td>
                            {ana && (
                              <td className="border border-[#E1E1E1] px-1.5 whitespace-nowrap text-[10px]">
                                {a?.incluir ? <span className="text-[#217346] font-semibold">Incluiu{a.aliq && a.aliq !== 20.5 ? ` · ${String(a.aliq).replace('.', ',')}%` : ''}</span> : <span className="text-stone-400">Excluiu</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {aba !== 'icms' && visiveis.length === 0 && <p className="text-center text-sm text-stone-400 py-10">Nenhum item aqui.</p>}
                {aba !== 'icms' && visiveis.length > limite && (
                  <button onClick={() => setLimite(l => l + 300)} className="w-full text-xs font-semibold text-[#217346] py-2.5 border-t border-[#D4D4D4] hover:bg-[#F3F9F5]">
                    Mostrar mais ({visiveis.length - limite} linhas restantes)
                  </button>
                )}
              </div>

              {/* abas da pasta, como no Excel */}
              <div className="flex items-end gap-0.5 px-2 pt-1 bg-[#F3F3F3] border-t border-[#D4D4D4] overflow-x-auto">
                {([
                  ['crua', arquivo.nome.replace(/\.xlsx$/i, ''), listas.crua.length],
                  ['itens', 'ITENS', listas.itens.length],
                  ['icms', 'ICMS', null],
                  ['sistematica', 'SISTEMATICA', listas.sistematica.length],
                ] as [Aba, string, number | null][]).map(([id, rot, n]) => (
                  <button key={id} onClick={() => { setAba(id); setLimite(150); }}
                    className={`text-[12px] px-4 py-1.5 whitespace-nowrap border-x border-t ${aba === id ? 'bg-white text-[#217346] font-bold border-[#D4D4D4] border-b-2 border-b-[#217346] -mb-px' : 'text-[#444] border-transparent hover:bg-[#E8E8E8]'}`}>
                    {rot}{n !== null && <span className="ml-1.5 text-[10px] text-stone-400 font-normal">{n}</span>}
                  </button>
                ))}
                <span className="w-px h-5 bg-[#C8C8C8] mx-2 mb-1.5" />
                {([
                  ['revisar', 'A revisar', listas.revisar.length],
                  ...(ana ? [['divergencias', 'Diferente da analista', listas.divergencias.length]] : []),
                ] as [Aba, string, number][]).map(([id, rot, n]) => (
                  <button key={id} onClick={() => { setAba(id); setLimite(150); }}
                    className={`text-[12px] px-4 py-1.5 whitespace-nowrap border-x border-t flex items-center gap-1.5 ${aba === id ? 'bg-white text-[#9A7B12] font-bold border-[#D4D4D4] border-b-2 border-b-[#C9A227] -mb-px' : 'text-[#7A6110] border-transparent hover:bg-[#EFE8D2]'}`}>
                    <AlertTriangle className="w-3 h-3" />{rot}<span className="text-[10px] opacity-70 font-normal">{n}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* rodapé de ações */}
            <section className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => exportarExcel(`${clienteNome} ${(arquivo.mes || '').replace('/', '-')} APP.xlsx`, arquivo.cabecalho, itens, decisoes)}
                className="flex items-center gap-1.5 border border-[#17150F] text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-stone-50">
                <Download className="w-4 h-4" />Baixar Excel no layout da analista
              </button>
              <button onClick={salvarNoHistorico} disabled={!cliente} title={cliente ? '' : 'Crie ou selecione um cliente para gravar o histórico'}
                className="flex items-center gap-1.5 bg-[#17150F] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-black disabled:opacity-30">
                <Save className="w-4 h-4" />Finalizar e gravar decisões no histórico
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ rotulo, valor, sub, destaque, alerta }: { rotulo: string; valor: string; sub?: string; destaque?: boolean; alerta?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${destaque ? 'bg-[#17150F] text-white border-[#17150F]' : alerta ? 'bg-[#FBF7EA] border-[#E9DDB0]' : 'bg-white border-[#E7E2D6]'}`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${destaque ? 'text-[#C9A227]' : 'text-stone-500'}`}>{rotulo}</p>
      <p className="font-display text-2xl mt-1 tabular-nums">{valor}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${destaque ? 'text-white/60' : 'text-stone-500'}`}>{sub}</p>}
    </div>
  );
}
