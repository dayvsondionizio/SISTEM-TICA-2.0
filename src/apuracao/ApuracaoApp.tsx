import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, History, Check, X, Download, Save, AlertTriangle, Search, RotateCcw, ArrowLeft, Loader2, Filter, HelpCircle } from 'lucide-react';
import {
  lerArquivo, decidir, aprender, antecipado, exportarExcel, cfopApurado, memoriaVazia, indexar, regraDoItem, resumoHistorico, ALIQ_PADRAO, PERC_SISTEMATICA, CFOPS_APURADOS,
  descreverNota, type ArquivoLido, type Decisao, type Item, type Memoria, type Origem, type Passo,
} from './motor';
import { carregarRegras, salvarRegras } from './regrasBanco';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctTxt = (v: number) => `${String(v).replace('.', ',')}%`;

const ORIGEM: Record<Origem, { rotulo: string; cor: string }> = {
  cfop: { rotulo: 'CFOP', cor: 'bg-stone-100 text-stone-600' },
  produto: { rotulo: 'Histórico · produto', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  'ncm-fornecedor': { rotulo: 'Histórico · NCM+forn.', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  ncm: { rotulo: 'Histórico · NCM', cor: 'bg-[#F4EDD3] text-[#7A6110]' },
  cst: { rotulo: 'Regra CST', cor: 'bg-sky-50 text-sky-700' },
  manual: { rotulo: 'Ajuste da analista', cor: 'bg-violet-50 text-violet-700' },
};

type Aba = 'crua' | 'itens' | 'icms' | 'sistematica' | 'revisar' | 'divergencias';
type Ajuste = Partial<Decisao> & { confirmado?: boolean };
interface Pendente { it: Item; incluir: boolean; aliq: number; antes: string; depois: string; historico: string }

/** Apuração a partir da planilha crua do Questor, com as regras daquele cliente (tabela icms_regras_apuracao). */
export default function ApuracaoApp({ clienteId, clienteNome, onVoltar }: { clienteId: string; clienteNome: string; onVoltar: () => void }) {
  const [mem, setMem] = useState<Memoria>(memoriaVazia());
  const [estadoRegras, setEstadoRegras] = useState<'carregando' | 'ok' | 'sem-tabela' | 'erro'>('carregando');
  const [infoRegras, setInfoRegras] = useState('');
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [mes, setMes] = useState('');
  const [manuais, setManuais] = useState<Map<number, Ajuste>>(new Map());
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [aba, setAba] = useState<Aba>('sistematica');
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [filtroAberto, setFiltroAberto] = useState<{ chave: string; titulo: string; x: number; y: number } | null>(null);
  const [painel, setPainel] = useState<{ tipo: 'item'; it: Item } | { tipo: 'guia' } | null>(null);
  const [limite, setLimite] = useState(150);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState('');
  const [gravando, setGravando] = useState(false);
  const inputCrua = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    carregarRegras(clienteId)
      .then(r => {
        if (!vivo) return;
        setMem(r.mem);
        setEstadoRegras(r.tabelaFalta ? 'sem-tabela' : 'ok');
        if (r.atualizadoEm) setInfoRegras(`Atualizadas em ${new Date(r.atualizadoEm).toLocaleDateString('pt-BR')}${r.atualizadoPor ? ` por ${r.atualizadoPor}` : ''}`);
      })
      .catch(e => { if (vivo) { setEstadoRegras('erro'); setErro((e as Error).message); } });
    return () => { vivo = false; };
  }, [clienteId]);

  const idx = useMemo(() => indexar(mem), [mem]);

  // ── decisões ──
  const automaticas = useMemo(() => {
    const m = new Map<number, Decisao>();
    arquivo?.itens.forEach(it => m.set(it.id, decidir(it, idx)));
    return m;
  }, [arquivo, idx]);
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

  /** Em linguagem simples: o que a analista precisa conferir neste item (null = nada). Ajustes já feitos por ela saem da lista. */
  const motivoRevisao = (it: Item, d: Decisao): string | null => {
    if (d.origem === 'manual') return null;
    const rp = regraDoItem(it, idx);
    const h = rp?.h ?? [];
    if (d.conflito && d.origem === 'produto' && !cfopApurado(it))
      return `Veio com CFOP ${it.cfop} no Questor, mas este produto já entrou na apuração antes. Confira o lançamento.`;
    const notaTxt = d.nota ? (d.nota.igual ? ` A nota deste mês é igual à anterior (${d.nota.agora}).` : ` A nota mudou: antes ${d.nota.antes}, agora ${d.nota.agora}.`) : '';
    if (d.conflito && d.origem === 'produto' && h.length >= 2 && h[h.length - 2][1] !== h[h.length - 1][1] && !h[h.length - 1][3]) {
      const [ant, ult] = [h[h.length - 2], h[h.length - 1]];
      const txt = (p: typeof ult) => (p[1] ? `incluído a ${pctTxt(p[2])}` : 'excluído');
      return `A analista mudou a decisão: em ${ant[0]} foi ${txt(ant)} e em ${ult[0]} foi ${txt(ult)}. O app seguiu o mais recente.${notaTxt} Está certo assim?`;
    }
    if (d.conflito && d.origem === 'produto' && d.nota && !d.nota.igual)
      return `A nota mudou: antes ${d.nota.antes}, agora ${d.nota.agora}. O app manteve a última decisão (${d.incluir ? 'incluído' : 'excluído'}), mas a tributação pode ter mudado. Confira.`;
    if (d.conflito && d.origem === 'ncm-fornecedor')
      return `Produto novo. Este fornecedor já teve o NCM ${it.ncm} incluído e excluído em meses diferentes. Confira.`;
    if (d.origem === 'cst' && cfopApurado(it))
      return `Produto novo, sem histórico: o app decidiu só pelo CST ${it.cst} (${d.incluir ? 'tributado, entra' : 'isento, não tributado ou ST, fica fora'}). Confira.`;
    if (d.incluir && d.aliq !== ALIQ_PADRAO && !h.some(p => p[1] && p[2] === d.aliq))
      return `Alíquota de ${pctTxt(d.aliq)} aplicada pela regra de bebida alcoólica (NCM ${it.ncm}). Confira.`;
    return null;
  };
  const precisaRevisar = (it: Item, d: Decisao) => motivoRevisao(it, d) !== null;

  const listas = useMemo(() => ({
    crua: itens,
    itens: itens.filter(i => cfopApurado(i) || decisoes.get(i.id)?.incluir),
    icms: [] as Item[],
    sistematica: itens.filter(i => decisoes.get(i.id)?.incluir),
    revisar: itens.filter(i => precisaRevisar(i, decisoes.get(i.id)!)),
    divergencias: itens.filter(i => divergentes.has(i.id)),
  }), [itens, decisoes, divergentes]);

  // valor de cada coluna usado pelo filtro (como o autofiltro do Excel)
  const valorFiltro = (chave: string, it: Item, d: Decisao): string => {
    switch (chave) {
      case 'status': return d.incluir ? 'Incluído' : 'Excluído';
      case 'porque': return ORIGEM[d.origem].rotulo + (d.conflito ? ' (revisar)' : '');
      case 'A': return it.fornecedor; case 'B': return it.razao; case 'C': return it.cnpj; case 'D': return it.tipo;
      case 'E': return it.numero; case 'F': return it.data; case 'G': return it.chave; case 'H': return it.produto;
      case 'I': return it.descricao; case 'J': return it.ncm; case 'K': return it.cfop; case 'L': return it.un;
      case 'M': return it.qtd.toLocaleString('pt-BR'); case 'N': return n2(it.vunit); case 'O': return n2(it.valor);
      case 'P': return it.cst; case 'Q': return n2(it.bc); case 'R': return n2(it.aliqDest); case 'S': return n2(it.icms);
      case 'Z': return d.incluir ? pctTxt(d.aliq) : '';
      default: return '';
    }
  };
  const filtrar = (l: Item[], ignorar?: string) => {
    const q = busca.trim().toUpperCase();
    return l.filter(i => {
      if (q && !`${i.razao} ${i.descricao} ${i.ncm} ${i.cfop} ${i.cst} ${i.produto}`.toUpperCase().includes(q)) return false;
      const d = decisoes.get(i.id)!;
      return Object.entries(filtros as Record<string, Set<string>>).every(([k, set]) => k === ignorar || set.has(valorFiltro(k, i, d)));
    });
  };
  const visiveis = useMemo(() => filtrar(listas[aba]), [listas, aba, busca, filtros, decisoes]);
  const qtdFiltros = Object.keys(filtros).length;

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
    const resumida = aba === 'revisar';
    const so = (d: Decisao, v: React.ReactNode) => (d.incluir ? v : '');
    return [...base,
      { letra: 'T', titulo: 'VALOR TOTAL LIQUIDO', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor)) },
      { letra: 'U', titulo: 'VALOR DO ICMS DESC', dir: true, calc: true, celula: (it, d) => so(d, n2(it.icms)) },
      { letra: 'V', titulo: 'ALIQ ICMS', dir: true, calc: true, celula: (it, d) => so(d, n2(it.aliqDest)) },
      { letra: 'W', titulo: 'CRED SIMPLES NACIONAL', dir: true, calc: true, celula: () => '' },
      { letra: 'X', titulo: 'PERC SISTEMATICA 25%', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor * 0.25)) },
      { letra: 'Y', titulo: 'BASE DE CALC SISTEMATICA', dir: true, calc: true, celula: (it, d) => so(d, n2(it.valor * 1.25)) },
      { letra: 'Z', titulo: 'BC SISTEMATICA * ALIQ INTERNA', dir: true, calc: true, celula: (it, d) => so(d, <span className="inline-flex items-center gap-1.5">
          <select value={d.aliq} onChange={e => mudarAliq(it, Number(e.target.value))}
            className={`border rounded px-0.5 text-[11px] ${d.aliq !== 20.5 ? 'border-[#C9A227] bg-[#FBF7EA]' : 'border-[#C8C8C8] bg-white'}`}>
            {[...new Set([20.5, 27, d.aliq])].map(v => <option key={v} value={v}>{String(v).replace('.', ',')}%</option>)}
          </select>{n2(it.valor * 1.25 * d.aliq / 100)}</span>) },
      { letra: 'AA', titulo: 'VALOR DO ICMS ANTECIPADO', dir: true, calc: true, celula: (it, d) => so(d, <b>{n2(antecipado(it, d))}</b>) },
    ].filter(c => !resumida || ['B', 'I', 'J', 'K', 'P', 'O', 'Z', 'AA'].includes(c.letra));
  }, [aba, manuais, itens, idx]);

  // ── ações ──
  const mesmoProduto = (o: Item, it: Item) => o.cnpj === it.cnpj && o.produto === it.produto;

  /** Aplica a mudança no produto inteiro (todas as notas do mês). */
  function aplicar(it: Item, incluir: boolean, aliq: number, confirmado: boolean) {
    const m = new Map<number, Ajuste>(manuais);
    itens.filter(o => mesmoProduto(o, it)).forEach(o => m.set(o.id, {
      ...(m.get(o.id) ?? {}), incluir, aliq, origem: 'manual', confirmado: confirmado || m.get(o.id)?.confirmado,
      motivo: confirmado ? 'Mudança confirmada pela analista: vale daqui para frente' : (incluir ? 'Incluído pela analista' : 'Excluído pela analista'),
      conflito: false,
    }));
    setManuais(m);
  }
  /** Se o produto tem histórico e a mudança contraria a última decisão, pede confirmação antes. */
  function mudar(it: Item, incluir: boolean, aliq: number) {
    const rp = regraDoItem(it, idx);
    const u = rp?.h[rp.h.length - 1];
    const descr = (inc: boolean, a: number) => (inc ? `incluído a ${pctTxt(a)}` : 'excluído');
    if (rp && u && (!!u[1] !== incluir || (incluir && !!u[1] && u[2] !== aliq))) {
      setPendente({ it, incluir, aliq, antes: descr(!!u[1], u[2]), depois: descr(incluir, aliq), historico: resumoHistorico(rp).texto });
      return;
    }
    aplicar(it, incluir, aliq, false);
  }
  const alternar = (it: Item) => { const d = decisoes.get(it.id)!; mudar(it, !d.incluir, d.aliq); };
  const mudarAliq = (it: Item, aliq: number) => mudar(it, true, aliq);

  async function abrirCrua(file: File | undefined) {
    if (!file) return;
    setErro(''); setAviso(''); setCarregando(`Lendo ${file.name}…`);
    try {
      const a = await lerArquivo(file);
      setArquivo(a); setMes(a.mes); setManuais(new Map()); setAba(a.analista ? 'divergencias' : 'sistematica'); setLimite(150);
      if (a.mes && mem.meses.includes(a.mes)) setAviso(`${a.mes} já foi finalizado antes para ${clienteNome}. Ao finalizar de novo, as decisões deste mês serão substituídas.`);
    } catch (e) { setErro((e as Error).message); }
    setCarregando('');
  }

  async function finalizar() {
    if (!arquivo) return;
    if (!/^\d{2}\/\d{4}$/.test(mes)) { setErro('Informe o mês da apuração no formato MM/AAAA.'); return; }
    if (mem.meses.includes(mes) && !confirm(`${mes} já está gravado para ${clienteNome}. Substituir as decisões deste mês?`)) return;
    setErro(''); setGravando(true);
    try {
      const nova = aprender(mem, arquivo.itens, it => {
        const d = decisoes.get(it.id)!; return { incluir: d.incluir, aliq: d.aliq, confirmado: !!manuais.get(it.id)?.confirmado };
      }, mes);
      await salvarRegras(clienteId, nova);
      setMem(nova); setManuais(new Map()); setEstadoRegras('ok');
      setInfoRegras(`Atualizadas agora`);
      setAviso(`Apuração de ${mes} finalizada. As decisões foram gravadas nas regras de ${clienteNome} e a próxima apuração já parte delas.`);
    } catch (e) { setErro((e as Error).message); }
    setGravando(false);
  }

  const qtdProdutos = Object.keys(mem.produtos).length;

  const botaoFiltro = (chave: string, titulo: string) => {
    const ativo = !!filtros[chave];
    return (
      <button title={`Filtrar ${titulo}`} onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setFiltroAberto({ chave, titulo, x: r.left, y: r.bottom + 4 }); }}
        className={`inline-flex items-center justify-center w-4 h-4 rounded border ${ativo ? 'bg-[#217346] border-[#217346] text-white' : 'border-[#C8C8C8] text-[#888] bg-white hover:border-[#217346]'}`}>
        <Filter className="w-2.5 h-2.5" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#17150F] font-report">
      <header className="border-b border-[#E7E2D6] bg-[#17150F] text-white">
        <div className="px-4 lg:px-6 py-3 flex items-center gap-4">
          <button onClick={onVoltar} title="Voltar ao cliente" className="bg-white/10 hover:bg-white/20 p-2 rounded-lg border border-white/10">
            <ArrowLeft className="w-5 h-5 text-[#C9A227]" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] font-semibold">Apuração da Sistemática · em teste</p>
            <h1 className="font-display text-2xl">{clienteNome}</h1>
          </div>
          <button onClick={() => setPainel({ tipo: 'guia' })}
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#C9A227] border border-[#C9A227]/50 hover:bg-white/10 px-3 py-1.5 rounded-lg">
            <HelpCircle className="w-4 h-4" />Como o app apura
          </button>
        </div>
      </header>

      <main className="px-4 lg:px-6 py-4 space-y-4">
        {/* regras do cliente */}
        <section className="bg-white border border-[#E7E2D6] rounded-xl p-4 flex items-center gap-3">
          <History className="w-4 h-4 text-[#9A7B12] shrink-0" />
          <div className="text-sm">
            <p className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Regras deste cliente</p>
            {estadoRegras === 'carregando' && <p className="text-stone-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando do banco…</p>}
            {estadoRegras === 'sem-tabela' && <p className="text-[#9A7B12]">A tabela de regras ainda não foi criada no Supabase. A apuração funciona só com as regras gerais (CFOP e CST) e não dá para finalizar.</p>}
            {estadoRegras === 'erro' && <p className="text-red-600">Não foi possível carregar as regras.</p>}
            {estadoRegras === 'ok' && (mem.meses.length
              ? <p><b>{qtdProdutos.toLocaleString('pt-BR')}</b> produtos conhecidos · {mem.meses.length} mês(es): {mem.meses.join(', ')}{infoRegras && <span className="text-stone-400"> · {infoRegras}</span>}</p>
              : <p className="text-stone-500">Ainda sem histórico. A primeira apuração sai pelas regras gerais (CFOP e CST) e, ao finalizar, vira a base das próximas.</p>)}
          </div>
        </section>

        {(erro || aviso || carregando) && (
          <div className={`text-sm rounded-lg px-4 py-2.5 border ${erro ? 'bg-red-50 border-red-200 text-red-700' : 'bg-[#FBF7EA] border-[#E9DDB0] text-[#5E4B0C]'}`}>
            {carregando || erro || aviso}
          </div>
        )}

        {/* anexar planilha */}
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); abrirCrua(e.dataTransfer.files[0]); }}
          onClick={() => inputCrua.current?.click()}
          className="border-2 border-dashed border-[#D9CFAF] rounded-xl bg-white hover:bg-[#FBF7EA] cursor-pointer px-6 py-5 flex items-center gap-4">
          <Upload className="w-6 h-6 text-[#9A7B12]" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{arquivo ? `${arquivo.nome} — trocar planilha` : 'Anexar a planilha crua do Questor'}</p>
            <p className="text-xs text-stone-500">Arraste ou clique. Se anexar uma apuração já feita pela analista, o app compara o resultado com o dela.</p>
          </div>
          {arquivo && (
            <label onClick={e => e.stopPropagation()} className="text-xs text-stone-600 flex items-center gap-2">
              Mês da apuração
              <input value={mes} onChange={e => setMes(e.target.value)} placeholder="MM/AAAA"
                className={`w-24 border rounded px-2 py-1 text-sm ${/^\d{2}\/\d{4}$/.test(mes) ? 'border-[#E7E2D6]' : 'border-red-300 bg-red-50'}`} />
            </label>
          )}
          <input ref={inputCrua} type="file" accept=".xlsx" hidden onChange={e => { abrirCrua(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {pendente && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPendente(null)}>
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <p className="text-[11px] uppercase tracking-wider text-[#9A7B12] font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Mudança na regra do produto</p>
              <p className="font-display text-xl mt-2">{pendente.it.descricao}</p>
              <p className="text-xs text-stone-500 mt-0.5">{pendente.it.razao} · cód. {pendente.it.produto} · NCM {pendente.it.ncm}</p>
              <div className="mt-4 text-sm space-y-1.5">
                <p>No histórico, este produto vinha <b>{pendente.antes}</b>.</p>
                <p className="text-xs text-stone-500">{pendente.historico}</p>
                <p className="pt-1">Agora ficará <b>{pendente.depois}</b>. Confirmando, ao finalizar esta apuração a nova regra passa a valer daqui para frente.</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setPendente(null)} className="text-xs font-semibold px-4 py-2 rounded-lg border border-[#E7E2D6] hover:bg-stone-50">Cancelar</button>
                <button onClick={() => { aplicar(pendente.it, pendente.incluir, pendente.aliq, true); setPendente(null); }}
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#17150F] text-white hover:bg-black">Confirmar mudança</button>
              </div>
            </div>
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
                  {aba === 'revisar' && 'Itens em que o app não tem certeza. Leia "O que conferir" e clique em manter ou trocar: o item sai desta lista e, ao finalizar, a decisão vira regra.'}
                  {aba === 'divergencias' && 'Itens em que o app decidiu diferente da apuração da analista.'}
                </p>
                <p className="w-full text-[10px] text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="inline-block w-2.5 h-2.5 align-middle bg-[#217346] rounded-sm mr-1" />✓ verde = entra na apuração</span>
                  <span><span className="inline-block w-2.5 h-2.5 align-middle bg-[#EDEDED] border border-[#C8C8C8] rounded-sm mr-1" />linha cinza = fora da apuração</span>
                  <span><span className="inline-block w-2.5 h-2.5 align-middle bg-[#FFF2CC] rounded-sm mr-1" />colunas amarelas = cálculo da sistemática (T a AA)</span>
                  <span><span className="inline-block w-2.5 h-2.5 align-middle bg-[#FBF7EA] border border-[#C9A227] rounded-sm mr-1" />alíquota em dourado = diferente de 20,5%</span>
                  <span>⚠ no selo = item para conferir · clique no selo para ver o passo a passo</span>
                </p>
                <div className="ml-auto flex items-center gap-2">
                  {aba !== 'icms' && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                      <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(150); }} placeholder="Localizar: fornecedor, produto, NCM, CFOP…"
                        className="border border-[#C8C8C8] rounded pl-8 pr-3 py-1 text-xs w-72 bg-white" />
                    </div>
                  )}
                  {qtdFiltros > 0 && (
                    <button onClick={() => setFiltros({})} className="flex items-center gap-1 text-xs font-semibold text-[#217346] border border-[#217346]/40 bg-[#F3F9F5] rounded px-2 py-1">
                      <Filter className="w-3.5 h-3.5" />{qtdFiltros} filtro(s) · limpar
                    </button>
                  )}
                  {manuais.size > 0 && (
                    <button onClick={() => setManuais(new Map())} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 px-2"><RotateCcw className="w-3.5 h-3.5" />Desfazer ajustes</button>
                  )}
                </div>
              </div>

              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 150px)', minHeight: 360 }}>
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
                        {aba === 'revisar' && <th className="border border-[#D4D4D4] font-normal px-1">Conferir</th>}
                        <th className="border border-[#D4D4D4] font-normal px-1">Por quê</th>
                        {ana && <th className="border border-[#D4D4D4] font-normal px-1">Analista</th>}
                      </tr>
                      <tr className="bg-[#FFFFFF] text-[#17150F]">
                        <th className="sticky left-0 z-20 bg-[#F3F3F3] border border-[#D4D4D4] text-[#666] font-normal">1</th>
                        <th className="border border-[#D4D4D4] bg-white px-0.5">{botaoFiltro('status', 'Na apuração')}</th>
                        {colunas.map(c => (
                          <th key={c.letra} className={`border border-[#D4D4D4] px-1.5 py-1 font-bold whitespace-nowrap ${c.calc ? 'bg-[#FFF2CC]' : 'bg-white'} ${c.dir ? 'text-right' : 'text-left'}`}>
                            <span className="inline-flex items-center gap-1">{c.titulo}{(!c.calc || c.letra === 'Z') && botaoFiltro(c.letra, c.titulo)}</span>
                          </th>
                        ))}
                        {aba === 'revisar' && <th className="border border-[#D4D4D4] bg-[#FBF7EA] px-1.5 text-left font-bold">O que conferir</th>}
                        <th className="border border-[#D4D4D4] bg-white px-1.5 text-left font-bold whitespace-nowrap"><span className="inline-flex items-center gap-1">Por quê{botaoFiltro('porque', 'Por quê')}</span></th>
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
                            {aba === 'revisar' && (
                              <td className="border border-[#E1E1E1] px-2 py-1 bg-[#FFFDF6] min-w-[340px] max-w-[460px] whitespace-normal">
                                <p className="text-[11px] text-[#5E4B0C] leading-snug">{destacar(motivoRevisao(it, d) ?? '')}</p>
                                <div className="flex gap-1.5 mt-1">
                                  <button onClick={() => aplicar(it, d.incluir, d.aliq, true)}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#217346] text-white hover:bg-[#1a5c38]">
                                    Está certo: manter <Selo incluido={d.incluir} claro />
                                  </button>
                                  <button onClick={() => alternar(it)}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded border border-[#C8C8C8] bg-white hover:border-stone-500">
                                    Trocar para <Selo incluido={!d.incluir} />
                                  </button>
                                </div>
                              </td>
                            )}
                            <td className="border border-[#E1E1E1] px-1.5">
                              <button onClick={() => setPainel({ tipo: 'item', it })} title="Ver o passo a passo deste item"
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap hover:ring-1 hover:ring-current ${ORIGEM[d.origem].cor}`}>
                                {d.conflito && <AlertTriangle className="w-3 h-3" />}{ORIGEM[d.origem].rotulo}<HelpCircle className="w-3 h-3 opacity-60" />
                              </button>
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
              <button onClick={() => exportarExcel(`${clienteNome} ${mes.replace('/', '-')}.xlsx`, arquivo.cabecalho, itens, decisoes)}
                className="flex items-center gap-1.5 border border-[#17150F] text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-stone-50">
                <Download className="w-4 h-4" />Baixar Excel no layout da analista
              </button>
              <button onClick={finalizar} disabled={gravando || estadoRegras !== 'ok'}
                title={estadoRegras === 'ok' ? 'Grava as decisões deste mês nas regras do cliente' : 'As regras do banco não estão disponíveis'}
                className="flex items-center gap-1.5 bg-[#17150F] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-black disabled:opacity-30">
                {gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Finalizar apuração
              </button>
            </section>
          </>
        )}
      </main>

      {filtroAberto && arquivo && (
        <PopoverFiltro
          titulo={filtroAberto.titulo} x={filtroAberto.x} y={filtroAberto.y}
          valores={(() => {
            const m = new Map<string, number>();
            filtrar(listas[aba], filtroAberto.chave).forEach(i => { const v = valorFiltro(filtroAberto.chave, i, decisoes.get(i.id)!); m.set(v, (m.get(v) ?? 0) + 1); });
            return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
          })()}
          selecionados={filtros[filtroAberto.chave]}
          onAplicar={sel => { const k = filtroAberto.chave; setFiltros(f => { const n = { ...f }; if (sel) n[k] = sel; else delete n[k]; return n; }); setLimite(150); setFiltroAberto(null); }}
          onFechar={() => setFiltroAberto(null)}
        />
      )}

      {painel && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setPainel(null)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-[460px] bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#17150F] text-white px-5 py-4 flex items-center justify-between">
              <p className="font-display text-lg">{painel.tipo === 'guia' ? 'Como o app apura' : 'Passo a passo deste item'}</p>
              <button onClick={() => setPainel(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 text-sm leading-relaxed">
              {painel.tipo === 'guia' ? <GuiaApuracao /> : (
                <PassoItem it={painel.it} d={decisoes.get(painel.it.id)!} historico={regraDoItem(painel.it, idx)?.h ?? []} temAjuste={manuais.has(painel.it.id)} />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ─── destaque visual de incluído / excluído ──────────────────────────────────
function Selo({ incluido, claro }: { incluido: boolean; claro?: boolean; key?: React.Key }) {
  const cor = incluido
    ? (claro ? 'bg-white text-[#217346]' : 'bg-[#217346] text-white')
    : (claro ? 'bg-white text-[#B42318]' : 'bg-[#B42318] text-white');
  return <span className={`inline-block px-1.5 rounded font-black uppercase tracking-wide text-[9.5px] ${cor}`}>{incluido ? 'Incluído' : 'Excluído'}</span>;
}
/** Troca as palavras incluído/excluído do texto por selos coloridos. */
function destacar(texto: string): React.ReactNode {
  return texto.split(/(incluído|excluído)/g).map((parte, i) =>
    parte === 'incluído' ? <Selo key={i} incluido /> : parte === 'excluído' ? <Selo key={i} incluido={false} /> : parte);
}

// ─── filtro por coluna (como o autofiltro do Excel) ──────────────────────────
function PopoverFiltro({ titulo, x, y, valores, selecionados, onAplicar, onFechar }: {
  titulo: string; x: number; y: number; valores: [string, number][]; selecionados?: Set<string>;
  onAplicar: (sel: Set<string> | null) => void; onFechar: () => void;
}) {
  const [marc, setMarc] = useState<Set<string>>(() => new Set(selecionados ?? valores.map(v => v[0])));
  const [q, setQ] = useState('');
  const lista = valores.filter(([v]) => v.toUpperCase().includes(q.toUpperCase()));
  const todos = lista.every(([v]) => marc.has(v));
  const esq = Math.min(x, window.innerWidth - 300);
  return (
    <div className="fixed inset-0 z-50" onClick={onFechar}>
      <div className="absolute w-72 bg-white border border-[#C8C8C8] rounded-lg shadow-xl text-xs" style={{ left: esq, top: Math.min(y, window.innerHeight - 380) }} onClick={e => e.stopPropagation()}>
        <div className="px-3 pt-3 pb-2 border-b border-[#EEE]">
          <p className="font-semibold mb-2">Filtrar: {titulo}</p>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar…" className="w-full border border-[#C8C8C8] rounded px-2 py-1" />
        </div>
        <div className="max-h-60 overflow-y-auto px-3 py-2 space-y-1">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={todos} onChange={() => setMarc(m => { const n = new Set(m); lista.forEach(([v]) => (todos ? n.delete(v) : n.add(v))); return n; })} />(Selecionar tudo)
          </label>
          {lista.slice(0, 500).map(([v, n]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="checkbox" checked={marc.has(v)} onChange={() => setMarc(m => { const t = new Set(m); if (t.has(v)) t.delete(v); else t.add(v); return t; })} />
              <span className="truncate flex-1" title={v}>{v || '(vazio)'}</span><span className="text-stone-400">{n}</span>
            </label>
          ))}
          {lista.length > 500 && <p className="text-stone-400">… use a pesquisa para ver os demais ({lista.length - 500})</p>}
        </div>
        <div className="flex justify-between gap-2 px-3 py-2 border-t border-[#EEE]">
          <button onClick={() => onAplicar(null)} className="text-stone-500 hover:text-stone-800">Limpar filtro</button>
          <div className="flex gap-2">
            <button onClick={onFechar} className="px-3 py-1 rounded border border-[#C8C8C8]">Cancelar</button>
            <button onClick={() => onAplicar(marc.size === valores.length ? null : marc)} className="px-3 py-1 rounded bg-[#217346] text-white font-semibold">OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── passo a passo de um item ────────────────────────────────────────────────
function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 pb-4">
      <span className="w-6 h-6 shrink-0 rounded-full bg-[#F4EDD3] text-[#7A6110] text-xs font-bold flex items-center justify-center">{n}</span>
      <div className="flex-1"><p className="font-semibold">{titulo}</p><div className="text-stone-600 mt-0.5">{children}</div></div>
    </div>
  );
}
function PassoItem({ it, d, historico, temAjuste }: { it: Item; d: Decisao; historico: Passo[]; temAjuste: boolean }) {
  const base = it.valor * (1 + PERC_SISTEMATICA), bcAliq = base * d.aliq / 100;
  const cstFora = ['40', '41', '60'].includes(it.cst.slice(-2).padStart(2, '0'));
  return (
    <>
      <p className="font-display text-xl leading-snug">{it.descricao}</p>
      <p className="text-xs text-stone-500 mt-1">{it.razao} ({it.tipo}) · NF {it.numero} · cód. {it.produto} · NCM {it.ncm}</p>
      <p className={`mt-3 inline-block text-xs font-bold px-2 py-1 rounded ${d.incluir ? 'bg-[#E8F3EC] text-[#217346]' : 'bg-stone-100 text-stone-500'}`}>
        {d.incluir ? `Entra na apuração · ICMS antecipado ${brl(antecipado(it, d))}` : 'Fora da apuração'}
      </p>
      {d.conflito && <p className="mt-2 text-xs text-[#7A6110] bg-[#FBF7EA] border border-[#E9DDB0] rounded px-2 py-1.5">Está em "A revisar": confira a decisão abaixo antes de finalizar.</p>}
      <div className="mt-5">
        <Passo n={1} titulo={`Natureza (CFOP) ${it.cfop}`}>
          {cfopApurado(it) ? `É compra para comercialização ou bonificação (${CFOPS_APURADOS.join(' ou ')}), então o item é analisado.`
            : d.incluir ? 'Não é 1102 nem 1910, mas este produto já entrou na apuração antes. Pode ser lançamento a corrigir no Questor.'
            : 'Só entram 1102 (compra para comercialização) e 1910 (bonificação). Outras entradas, como 1403 (compra com ST), 1556 (uso e consumo) e 2102 (outro estado), ficam fora.'}
        </Passo>
        <Passo n={2} titulo="Decisão">
          <p>{temAjuste ? 'Ajustado pela analista nesta apuração.' : d.motivo}</p>
          {historico.length > 0 && (
            <div className="mt-2 border border-[#EEE] rounded">
              <p className="text-[11px] uppercase tracking-wider text-stone-400 px-2 pt-1.5">Histórico deste produto</p>
              {historico.map(([mes, inc, aliq, conf, cst, icms, cfop]) => (
                <p key={mes} className="px-2 py-1 text-xs flex justify-between gap-2 border-t border-[#F3F3F3]">
                  <span className="shrink-0">{mes}</span>
                  <span className="text-stone-400 truncate">{descreverNota(cst, icms, cfop)}</span>
                  <span className={`shrink-0 ${inc ? 'text-[#217346]' : 'text-[#B42318]'}`}>{inc ? `incluído a ${pctTxt(aliq)}` : 'excluído'}{conf ? ' · confirmado' : ''}</span>
                </p>
              ))}
            </div>
          )}
        </Passo>
        <Passo n={3} titulo={`CST ${it.cst}`}>
          {cstFora ? 'Final 40, 41 ou 60 (isento, não tributado ou ST). Sem histórico, fica fora. Com histórico, vale a decisão da analista.'
            : 'Tributado. Sem histórico, entra. Com histórico, vale a decisão da analista.'}
        </Passo>
        {d.incluir && (
          <Passo n={4} titulo="Cálculo (colunas T a AA)">
            <table className="w-full text-xs mt-1 tabular-nums">
              <tbody>
                <tr><td>Valor total (O)</td><td className="text-right">{n2(it.valor)}</td></tr>
                <tr><td>+ {PERC_SISTEMATICA * 100}% da sistemática (X)</td><td className="text-right">{n2(it.valor * PERC_SISTEMATICA)}</td></tr>
                <tr className="font-semibold"><td>= Base de cálculo (Y)</td><td className="text-right">{n2(base)}</td></tr>
                <tr><td>× alíquota interna {pctTxt(d.aliq)} (Z)</td><td className="text-right">{n2(bcAliq)}</td></tr>
                <tr><td>− ICMS destacado na nota (U)</td><td className="text-right">{n2(it.icms)}</td></tr>
                <tr className="font-bold border-t border-[#DDD]"><td>= ICMS antecipado (AA)</td><td className="text-right">{n2(antecipado(it, d))}</td></tr>
              </tbody>
            </table>
            <p className="text-xs mt-2">{d.aliq === ALIQ_PADRAO ? `Alíquota padrão de ${pctTxt(ALIQ_PADRAO)}.` : `Alíquota de ${pctTxt(d.aliq)}: vem do histórico do produto ou é bebida alcoólica (NCM 2204, 2205, 2206 ou 2208).`}</p>
          </Passo>
        )}
      </div>
    </>
  );
}

// ─── guia geral da lógica ────────────────────────────────────────────────────
function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-[#17150F] mt-5 mb-1">{children}</p>;
}
function GuiaApuracao() {
  return (
    <div className="text-stone-700 space-y-1">
      <Titulo>1. De onde vêm os itens</Titulo>
      <p>Da planilha crua do Questor: uma linha por item de nota de entrada (colunas A a S).</p>
      <Titulo>2. Quais entram (aba ITENS)</Titulo>
      <p>Só a Natureza 1102 (compra para comercialização, inclusive 1102001) e 1910 (bonificação). Saem as demais, como 1403 (compra com ST), 1556 (uso e consumo), 2102 (outro estado), 1407 e 1949.</p>
      <Titulo>3. Quais são calculados (aba SISTEMATICA)</Titulo>
      <p>Para cada item, vale a primeira regra que se aplica:</p>
      <ol className="list-decimal pl-5 space-y-1">
        <li><b>Histórico do produto:</b> mesmo código do mesmo fornecedor. Vale a última decisão da analista.</li>
        <li><b>NCM do fornecedor:</b> produto novo, mas o fornecedor já vendeu esse NCM antes. Vale a última decisão.</li>
        <li><b>NCM em outros fornecedores:</b> só quando a decisão foi a mesma em pelo menos 80% das vezes.</li>
        <li><b>Regra do CST:</b> sem histórico, saem os CST com final 40, 41 e 60 (isento, não tributado ou ST). Os demais entram.</li>
      </ol>
      <p className="mt-1">Exceção: produto que já entrou antes e veio com CFOP 14xx entra e vai para revisão, porque costuma ser lançamento a corrigir.</p>
      <Titulo>4. Cálculo</Titulo>
      <p>ICMS antecipado = Valor total × 1,25 × alíquota interna − ICMS destacado. A alíquota padrão é 20,5%. Bebidas alcoólicas (NCM 2204, 2205, 2206 e 2208) usam 27%. Se o produto tem alíquota no histórico, ela é usada.</p>
      <Titulo>5. A revisar</Titulo>
      <p>Entram aqui os itens sem histórico (decididos só pelo CST), os produtos cuja decisão mudou no último mês, os produtos cuja nota mudou (CST ou ICMS destacado diferentes da última vez), os CFOP a conferir e as alíquotas diferentes de 20,5%.</p>
      <Titulo>O que a regra guarda de cada produto</Titulo>
      <p>Fornecedor (CNPJ e tipo), código, descrição e NCM do produto e, mês a mês: se entrou ou não, a alíquota interna, se a analista confirmou, e como a nota veio (CST, com ou sem ICMS destacado, CFOP). O valor do produto não entra na regra.</p>
      <Titulo>6. Ajustes da analista</Titulo>
      <p>O ✓ inclui ou exclui o produto em todas as notas do mês. Se o produto tem histórico e a mudança contraria a última decisão, o app pede confirmação. Confirmando, a nova regra vale daqui para frente.</p>
      <Titulo>7. Finalizar</Titulo>
      <p>Grava as decisões do mês nas regras do cliente, com o e-mail de quem finalizou, e a próxima apuração já parte delas. Nenhuma regra é apagada: cada produto guarda o histórico mês a mês.</p>
      <Titulo>8. Filtros e passo a passo</Titulo>
      <p>O funil em cada cabeçalho filtra a coluna, como no Excel. A busca geral procura em fornecedor, produto, NCM, CFOP e CST. Na coluna "Por quê", clique no selo de um item para ver o passo a passo dele.</p>
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
