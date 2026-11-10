import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, X, Copy, Check } from 'lucide-react';
import { carregarHistorico, type AuditoriaSalva } from './storage';
import { nomeGrupoNcm4 } from './rankingIcms';

const ASSINATURA = 'Dayvson Dionizio';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const META = 7;

export type TipoMensagem = 'completo' | 'icms' | 'trigo' | 'ranking';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const pct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`;
const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;
/** Valor aproximado para texto: "R$ 8 mil", "R$ 1,4 mil", "R$ 346". */
const aprox = (v: number) => {
  if (v >= 10000) return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
  if (v >= 1000) return `R$ ${(Math.round(v / 100) / 10).toLocaleString('pt-BR')} mil`;
  return `R$ ${Math.ceil(v).toLocaleString('pt-BR')}`;
};
const mesAno = (ref: string) => { const [m, y] = ref.split('/').map(n => parseInt(n, 10)); return { m: m || 0, y: y || 0 }; };
const nomeMes = (ref: string) => { const { m, y } = mesAno(ref); return `${MESES[m - 1] ?? ref}/${y}`; };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const abaixo = (p: number) => (META - p <= 1 ? 'um pouco abaixo da meta de 7%' : 'abaixo da meta de 7%');
const lista = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const ordenar = (auds: AuditoriaSalva[]) => [...auds].sort((x, z) => { const a = mesAno(x.mesReferencia), b = mesAno(z.mesReferencia); return a.y * 100 + a.m - (b.y * 100 + b.m); });

function totaisIcms(auds: AuditoriaSalva[]) {
  const ativos = auds.flatMap(a => a.fornecedores.filter(f => !f.descartado));
  return {
    economia: ativos.reduce((s, f) => s + f.economia, 0),
    pago: ativos.reduce((s, f) => s + f.icmsPago, 0),
    projetado: ativos.reduce((s, f) => s + f.icmsProjetado, 0),
    itens: ativos.length,
  };
}
function trigoAcumulado(auds: AuditoriaSalva[]) {
  const com = auds.filter(a => (a.trigoQuestorTotal ?? 0) > 0);
  const compras = com.reduce((s, a) => s + (a.trigoQuestorTotal ?? 0), 0);
  const trigo = com.reduce((s, a) => s + (a.trigoSelectedTotal ?? 0), 0);
  return { meses: com.length, compras, trigo, pct: compras > 0 ? (trigo / compras) * 100 : null, falta: Math.max(0, compras * META / 100 - trigo) };
}
/** Meses que ainda faltam no semestre depois de `m` (jan–jun ou jul–dez). */
const mesesRestantes = (m: number) => { const fim = m <= 6 ? 6 : 12; return Array.from({ length: fim - m }, (_, i) => MESES[m + i]); };

// ─── blocos ──────────────────────────────────────────────────────────────────
function blocoEconomia(t: ReturnType<typeof totaisIcms>) {
  if (t.itens === 0) return '';
  const itens = t.itens === 1 ? '1 item foi comprado' : `${t.itens} itens foram comprados`;
  return `*De onde vem essa economia*
${itens} de fornecedores do Simples Nacional, que pagam até 25,5% de ICMS. O mesmo produto comprado de um fornecedor do Regime Normal paga 5,5%: quase *5 vezes menos*. ${t.itens === 1 ? 'Esse item gerou' : 'Esses itens geraram'} ${brl(t.pago)} de ICMS, quando ${t.itens === 1 ? 'poderia' : 'poderiam'} ter gerado ${brl(t.projetado)}.`;
}
function blocoRanking(a: AuditoriaSalva) {
  const r = a.rankingIcms;
  if (!r || r.grupos.length < 2 || r.totalIcms <= 0) return '';
  const g1 = nomeGrupoNcm4(r.grupos[0].codigo, r.grupos[0].nome);
  const g2 = nomeGrupoNcm4(r.grupos[1].codigo, r.grupos[1].nome);
  const p = ((r.grupos[0].icms + r.grupos[1].icms) / r.totalIcms) * 100;
  return `*Onde está o seu imposto*
Agrupando os produtos pela classificação fiscal (NCM) das notas, *${g1}* e *${g2}* respondem por *${pct1(p)}* de todo o ICMS antecipado do mês (${brl(r.totalIcms)}). O ranking completo está no relatório.`;
}
/** Trigo do relatório mensal. Abaixo da meta, usa o acumulado do semestre (meses já salvos) para mostrar como compensar. */
function blocoTrigoMensal(a: AuditoriaSalva, historico: AuditoriaSalva[]) {
  const p = a.percentualSistematica;
  if (p === null || p === undefined) return '';
  const { m, y } = mesAno(a.mesReferencia);
  if (p >= META) return `*Sistemática do trigo: ${pct(p)}*
Em ${MESES[m - 1] ?? 'no mês'}, as compras de farinha e pré-misturas ficaram dentro da meta de 7%.`;

  const ini = m <= 6 ? 1 : 7;
  // um registro por mês do semestre, do início até este mês (a apuração atual prevalece; senão a mais recente)
  const porMes = new Map<number, AuditoriaSalva>();
  historico
    .filter(h => norm(h.nomeEmpresa) === norm(a.nomeEmpresa))
    .forEach(h => { const d = mesAno(h.mesReferencia); if (d.y === y && d.m >= ini && d.m < m) { const atual = porMes.get(d.m); if (!atual || h.criadoEm > atual.criadoEm) porMes.set(d.m, h); } });
  porMes.set(m, a);
  const acum = trigoAcumulado([...porMes.values()]);
  const restantes = mesesRestantes(m);
  const linhaMes = `Em ${MESES[m - 1]}, as compras de farinha e pré-misturas ficaram em ${pct(p)}, ${abaixo(p)}.`;
  const titulo = `*Sistemática do trigo: ${pct(p)} no mês*`;

  if (acum.meses <= 1 || acum.pct === null) {
    const falta = Math.max(0, (a.trigoQuestorTotal ?? 0) * META / 100 - (a.trigoSelectedTotal ?? 0));
    return `${titulo}
${linhaMes} Isso pode ser compensado nos próximos meses: faltaram cerca de *${aprox(falta)}* em compras de insumos de panificação. O enquadramento só é apurado no fechamento do semestre.`;
  }
  const periodo = `${MESES[ini - 1]} a ${MESES[m - 1]}`;
  if (acum.pct >= META) return `${titulo}
${linhaMes} Mas no acumulado do semestre (${periodo}) o trigo está em *${pct(acum.pct)}*, dentro da meta.`;
  if (restantes.length === 0) return `${titulo}
${linhaMes} Este mês fecha o semestre, com acumulado de ${pct(acum.pct)} (${periodo}). Vamos conversar sobre os próximos passos.`;
  return `${titulo}
${linhaMes} No acumulado do semestre (${periodo}), o trigo está em ${pct(acum.pct)}. *Ainda dá para recuperar:* faltam cerca de *${aprox(acum.falta)}* em compras de insumos de panificação, que podem entrar em ${lista(restantes)}, além das compras normais. O enquadramento só é apurado no fechamento do semestre.`;
}
/** Trigo do relatório consolidado (vários meses selecionados). */
function blocoTrigoPeriodo(auds: AuditoriaSalva[]) {
  const acum = trigoAcumulado(auds);
  if (acum.pct === null) return '';
  const ord = ordenar(auds);
  const ultimo = mesAno(ord[ord.length - 1].mesReferencia);
  const periodo = `${MESES[mesAno(ord[0].mesReferencia).m - 1]} a ${MESES[ultimo.m - 1]}`;
  const titulo = `*Sistemática do trigo: ${pct(acum.pct)} no período*`;
  if (acum.pct >= META) return `${titulo}
De ${periodo}, as compras de farinha e pré-misturas ficaram dentro da meta de 7%.`;
  const restantes = mesesRestantes(ultimo.m);
  if (restantes.length === 0) return `${titulo}
De ${periodo}, as compras de farinha e pré-misturas ficaram em ${pct(acum.pct)}, abaixo da meta de 7%. Vamos conversar sobre os próximos passos.`;
  return `${titulo}
De ${periodo}, as compras de farinha e pré-misturas ficaram em ${pct(acum.pct)}, ${META - acum.pct <= 1 ? 'perto da meta de 7%' : 'abaixo da meta de 7%'}. *Ainda dá para recuperar:* faltam cerca de *${aprox(acum.falta)}* em compras de insumos de panificação, que podem entrar em ${lista(restantes)}, além das compras normais. O enquadramento só é apurado no fechamento do semestre.`;
}

// ─── montagem ────────────────────────────────────────────────────────────────
const TITULOS: Record<TipoMensagem, string> = {
  completo: 'IMPACTO TRIBUTÁRIO NAS COMPRAS', icms: 'IMPACTO TRIBUTÁRIO NAS COMPRAS',
  trigo: 'SISTEMÁTICA DE PANIFICAÇÃO – % TRIGO', ranking: 'ICMS POR GRUPO DE PRODUTOS',
};
function abertura(tipo: TipoMensagem, empresa: string, quando: string, consolidado: boolean, economia: number) {
  const ola = `Olá! Aqui é ${ASSINATURA}, do Contador de Padarias.`;
  if (tipo === 'trigo') return `${ola}

Segue o acompanhamento da sistemática de panificação da ${empresa} ${consolidado ? 'de' : 'em'} ${quando}, com o percentual de compras de farinha e pré-misturas.`;
  if (tipo === 'ranking') return `${ola}

Segue o ranking dos grupos de produtos que mais geraram ICMS nas compras da ${empresa} em ${quando}.`;
  // Com economia, o valor vem logo na abertura: é o que o cliente lê na prévia do WhatsApp.
  if (economia > 0) {
    const anexo = tipo === 'completo' ? 'Os relatórios em anexo mostram onde.' : 'O relatório em anexo mostra onde.';
    return `${ola}

${consolidado ? 'De' : 'Em'} ${quando}, *${brl(economia)} de ICMS* poderiam ter ficado no caixa da ${empresa}. ${anexo}`;
  }
  return `${ola}

Preparamos ${consolidado ? 'a análise consolidada das compras' : 'a análise das compras'} da ${empresa} ${consolidado ? 'de' : 'em'} ${quando}. Nela aparece onde o imposto está pesando e onde dá para economizar.`;
}
function fechar(partes: string[], blocos: number, empresa: string) {
  const anexo = blocos > 1 ? 'dos relatórios em anexo' : 'do relatório em anexo';
  return [...partes, `Estamos juntos no crescimento da ${empresa}. Se quiser aprofundar algum ponto ${anexo}, é só chamar.`].join('\n\n');
}

export function montarMensagemMensal(a: AuditoriaSalva, historico: AuditoriaSalva[], tipo: TipoMensagem = 'completo') {
  const quando = nomeMes(a.mesReferencia);
  const eco = blocoEconomia(totaisIcms([a])), rank = blocoRanking(a), trigo = blocoTrigoMensal(a, historico);
  const blocos = (tipo === 'completo' ? [eco, rank, trigo] : tipo === 'icms' ? [eco] : tipo === 'trigo' ? [trigo] : [rank]).filter(Boolean);
  return fechar([`*${TITULOS[tipo]} – ${quando.toUpperCase()}*`, abertura(tipo, a.nomeEmpresa, quando, false, totaisIcms([a]).economia), ...blocos], blocos.length, a.nomeEmpresa);
}
export function montarMensagemPeriodo(auds: AuditoriaSalva[], tipo: TipoMensagem = 'completo') {
  const ord = ordenar(auds);
  const ini = ord[0], fim = ord[ord.length - 1];
  const quando = ini.mesReferencia === fim.mesReferencia ? nomeMes(ini.mesReferencia) : `${MESES[mesAno(ini.mesReferencia).m - 1]} a ${nomeMes(fim.mesReferencia)}`;
  const eco = blocoEconomia(totaisIcms(ord)), trigo = blocoTrigoPeriodo(ord);
  const blocos = (tipo === 'trigo' ? [trigo] : tipo === 'icms' ? [eco] : [eco, trigo]).filter(Boolean);
  return fechar([`*${TITULOS[tipo]} – ${quando.toUpperCase()}*`, abertura(tipo, ini.nomeEmpresa, quando, true, totaisIcms(ord).economia), ...blocos], blocos.length, ini.nomeEmpresa);
}

/** Janela com a mensagem pronta para copiar. `auditorias` com 1 item = mensal; com vários = período. */
export function ModalMensagemCliente({ auditorias, onClose }: { auditorias: AuditoriaSalva[]; onClose: () => void }) {
  const [historico, setHistorico] = useState<AuditoriaSalva[] | null>(null);
  const [tipo, setTipo] = useState<TipoMensagem>('completo');
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);
  const mensal = auditorias.length === 1;
  const a0 = auditorias[0];

  useEffect(() => {
    if (!mensal) { setHistorico([]); return; }
    let ativo = true;
    carregarHistorico().then(h => { if (ativo) setHistorico(h); });
    return () => { ativo = false; };
  }, []);

  const disponivel: Record<TipoMensagem, boolean> = {
    completo: true,
    icms: totaisIcms(auditorias).itens > 0,
    trigo: auditorias.some(a => a.percentualSistematica !== null && a.percentualSistematica !== undefined),
    ranking: mensal && !!a0.rankingIcms,
  };
  const opcoes: { id: TipoMensagem; rotulo: string }[] = [
    { id: 'completo', rotulo: mensal ? 'Completo (ICMS + trigo + ranking)' : 'Completo (ICMS + trigo)' },
    { id: 'icms', rotulo: 'Só ICMS' },
    { id: 'trigo', rotulo: 'Só trigo' },
    ...(mensal ? [{ id: 'ranking' as TipoMensagem, rotulo: 'Só ranking' }] : []),
  ];

  const gerado = useMemo(() => {
    if (historico === null) return '';
    return mensal ? montarMensagemMensal(a0, historico, tipo) : montarMensagemPeriodo(auditorias, tipo);
  }, [historico, tipo]);
  useEffect(() => { setTexto(gerado); setCopiado(false); }, [gerado]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); }
    catch {
      const el = document.createElement('textarea'); el.value = texto; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl"><MessageSquare className="w-4 h-4 text-white" /></div>
            <div>
              <h3 className="text-base font-black text-slate-800">Mensagem para o cliente</h3>
              <p className="text-xs text-slate-400">Confira, ajuste se quiser e copie para o WhatsApp. Os asteriscos viram negrito.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {opcoes.map(o => (
            <button
              key={o.id}
              onClick={() => setTipo(o.id)}
              disabled={!disponivel[o.id]}
              title={disponivel[o.id] ? '' : 'Esta apuração não tem esse relatório'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${tipo === o.id ? 'bg-[#001F3F] border-[#001F3F] text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        {historico === null ? (
          <p className="text-sm text-slate-400 py-10 text-center">Montando a mensagem...</p>
        ) : (
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="w-full h-[400px] p-4 border-2 border-slate-200 rounded-xl text-sm text-slate-700 leading-relaxed outline-none focus:border-[#001F3F] font-sans"
          />
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">Fechar</button>
          <button
            onClick={copiar}
            disabled={!texto}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {copiado ? <><Check className="w-4 h-4" />Copiado!</> : <><Copy className="w-4 h-4" />Copiar mensagem</>}
          </button>
        </div>
      </div>
    </div>
  );
}
