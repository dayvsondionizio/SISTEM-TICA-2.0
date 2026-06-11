import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Building2, TrendingUp, Wheat, ChevronDown, ChevronUp,
  Clock, BarChart2, AlertTriangle, RefreshCw, FileText, Printer
} from 'lucide-react';
import { carregarHistorico, carregarRascunhos, type AuditoriaSalva } from './storage';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtPct = (v: number) =>
  v.toFixed(2).replace('.', ',') + '%';
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function economiaAtiva(a: AuditoriaSalva): number {
  const ativos = a.fornecedores.filter(f => !f.descartado);
  return round(ativos.reduce((acc, f) => acc + f.economia, 0));
}

// Converte "MM/AAAA" em Date para comparação/ordenação
function parseMes(mes: string): Date {
  const [m, y] = mes.split('/');
  return new Date(Number(y), Number(m) - 1, 1);
}

// Filtra auditorias pelo período selecionado
function filtrarPorPeriodo(
  lista: AuditoriaSalva[],
  meses: number | null,
  customInicio?: string,
  customFim?: string,
): AuditoriaSalva[] {
  if (meses === -1 && customInicio && customFim) {
    // Modo personalizado: filtra entre mês início e mês fim
    try {
      const ini = parseMes(customInicio).getTime();
      const fim = parseMes(customFim).getTime();
      return lista.filter(a => {
        try {
          const t = parseMes(a.mesReferencia).getTime();
          return t >= ini && t <= fim;
        } catch { return true; }
      });
    } catch { return lista; }
  }
  if (!meses) return lista;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  return lista.filter(a => {
    try { return parseMes(a.mesReferencia) >= limite; } catch { return true; }
  });
}

// ─── BADGE TRIGO ──────────────────────────────────────────────────────────────
function BadgeTrigo({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-300 font-bold">—</span>;
  const ok = pct >= 7;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      🌾 {fmtPct(pct)}
    </span>
  );
}

// ─── PDF DO PAINEL GERAL ──────────────────────────────────────────────────────
interface PrintablePainelProps {
  empresasFiltradas: [string, AuditoriaSalva[]][];
  totalEconomiaGeral: number;
  trigoMediaGeral: number | null;
  trigoOk: number;
  trigoTotal: number;
  periodoLabel: string;
}

function PrintablePainelReport({ empresasFiltradas, totalEconomiaGeral, trigoMediaGeral, trigoOk, trigoTotal, periodoLabel }: PrintablePainelProps) {
  const dateStr = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-white text-slate-900 font-sans text-[11px]">
      {/* Cabeçalho */}
      <div className="bg-[#001F3F] text-white px-10 py-8 print:break-after-avoid">
        <h1 className="text-2xl font-black tracking-tight">Relatório Geral — Economia ICMS Sistemática</h1>
        <p className="text-sky-300 text-sm mt-1 font-bold">
          Período: {periodoLabel} · Gerado em {dateStr}
        </p>
        <div className="flex gap-8 mt-5">
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Empresas</p>
            <p className="text-2xl font-black">{empresasFiltradas.length}</p>
          </div>
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Economia Total</p>
            <p className="text-2xl font-black text-emerald-400">{fmt(totalEconomiaGeral)}</p>
          </div>
          {trigoMediaGeral !== null && (
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">% Trigo Médio</p>
              <p className={`text-2xl font-black ${trigoMediaGeral >= 7 ? 'text-emerald-400' : 'text-amber-400'}`}>{fmtPct(trigoMediaGeral)}</p>
              <p className="text-white/50 text-[10px]">{trigoOk}/{trigoTotal} meses ≥7%</p>
            </div>
          )}
        </div>
      </div>

      {/* Uma tabela por empresa */}
      {empresasFiltradas.map(([nome, auditorias]) => {
        const ordenadas = [...auditorias].sort((a, b) => {
          try { return parseMes(b.mesReferencia).getTime() - parseMes(a.mesReferencia).getTime(); }
          catch { return 0; }
        });
        const totalEco = round(ordenadas.reduce((acc, a) => acc + economiaAtiva(a), 0));
        const totalPago = round(ordenadas.reduce((acc, a) => {
          return acc + a.fornecedores.filter(f => !f.descartado).reduce((s, f) => s + f.icmsPago, 0);
        }, 0));
        const totalProj = round(ordenadas.reduce((acc, a) => {
          return acc + a.fornecedores.filter(f => !f.descartado).reduce((s, f) => s + f.icmsProjetado, 0);
        }, 0));
        const trigoVals = ordenadas.map(a => a.percentualSistematica).filter((v): v is number => v !== null && v !== undefined);
        const trigoMed = trigoVals.length ? round(trigoVals.reduce((a, b) => a + b, 0) / trigoVals.length) : null;

        return (
          <div key={nome} className="px-10 py-6 break-inside-avoid">
            {/* Nome da empresa */}
            <div className="flex items-center justify-between mb-2 pb-1 border-b-2 border-[#001F3F]">
              <h2 className="font-black text-[#001F3F] text-sm uppercase tracking-wide">{nome}</h2>
              <div className="flex gap-6 text-[10px] text-right">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider">Economia Total</p>
                  <p className="font-black text-emerald-700">{fmt(totalEco)}</p>
                </div>
                {trigoMed !== null && (
                  <div>
                    <p className="text-slate-400 font-bold uppercase tracking-wider">% Trigo Médio</p>
                    <p className={`font-black ${trigoMed >= 7 ? 'text-emerald-700' : 'text-amber-600'}`}>{fmtPct(trigoMed)}</p>
                  </div>
                )}
              </div>
            </div>

            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">Mês</th>
                  <th className="text-right py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">Economia</th>
                  <th className="text-right py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">ICMS Pago</th>
                  <th className="text-right py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">ICMS Projetado</th>
                  <th className="text-right py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">% Trigo</th>
                  <th className="text-right py-1.5 px-2 font-bold uppercase tracking-wider text-slate-500">Forn. Simples</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(a => {
                  const ativos = a.fornecedores.filter(f => !f.descartado);
                  const eco = round(ativos.reduce((acc, f) => acc + f.economia, 0));
                  const pago = round(ativos.reduce((acc, f) => acc + f.icmsPago, 0));
                  const proj = round(ativos.reduce((acc, f) => acc + f.icmsProjetado, 0));
                  const pct = a.percentualSistematica;
                  return (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="py-1.5 px-2 font-black text-[#001F3F]">{a.mesReferencia}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-emerald-700">{fmt(eco)}</td>
                      <td className="py-1.5 px-2 text-right text-red-600 font-semibold">{fmt(pago)}</td>
                      <td className="py-1.5 px-2 text-right text-blue-700 font-semibold">{fmt(proj)}</td>
                      <td className="py-1.5 px-2 text-right">
                        {pct !== null && pct !== undefined
                          ? <span className={`font-black ${pct >= 7 ? 'text-emerald-700' : 'text-amber-600'}`}>{fmtPct(pct)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-500 font-bold">{ativos.length}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="py-1.5 px-2 font-black text-slate-600 uppercase text-[10px] tracking-wider">Total</td>
                  <td className="py-1.5 px-2 text-right font-black text-emerald-700">{fmt(totalEco)}</td>
                  <td className="py-1.5 px-2 text-right font-black text-red-600">{fmt(totalPago)}</td>
                  <td className="py-1.5 px-2 text-right font-black text-blue-700">{fmt(totalProj)}</td>
                  <td className="py-1.5 px-2 text-right">
                    {trigoMed !== null && <span className={`font-black ${trigoMed >= 7 ? 'text-emerald-700' : 'text-amber-600'}`}>{fmtPct(trigoMed)}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right font-black text-slate-500">
                    {round(ordenadas.reduce((acc, a) => acc + a.fornecedores.filter(f => !f.descartado).length, 0) / (ordenadas.length || 1))}
                    <span className="text-[9px] font-normal">/mês</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      {/* Rodapé */}
      <div className="px-10 py-6 border-t-2 border-slate-200 mt-4">
        <p className="text-[10px] text-slate-400 text-center">
          Relatório gerado pelo sistema ECONOMIA ICMS SISTEMÁTICA · {dateStr}
        </p>
      </div>
    </div>
  );
}

// ─── CARD DE EMPRESA ──────────────────────────────────────────────────────────
interface EmpresaCardProps {
  key?: React.Key;
  nome: string;
  auditorias: AuditoriaSalva[];
  temRascunho: boolean;
}

function EmpresaCard({ nome, auditorias, temRascunho }: EmpresaCardProps) {
  const [expandido, setExpandido] = useState(false);

  const ordenadas = [...auditorias].sort((a, b) => {
    try { return parseMes(b.mesReferencia).getTime() - parseMes(a.mesReferencia).getTime(); }
    catch { return 0; }
  });

  const totalEconomia = round(ordenadas.reduce((acc, a) => acc + economiaAtiva(a), 0));
  const mediaMensal = ordenadas.length > 0 ? round(totalEconomia / ordenadas.length) : 0;

  const trigoVals = ordenadas
    .map(a => a.percentualSistematica)
    .filter((v): v is number => v !== null && v !== undefined);
  const trigoMedia = trigoVals.length > 0
    ? round(trigoVals.reduce((a, b) => a + b, 0) / trigoVals.length)
    : null;

  const ultimo = ordenadas[0]?.mesReferencia ?? '—';
  const qtdMeses = ordenadas.length;
  const mesOk = trigoVals.filter(v => v >= 7).length;
  const mesFail = trigoVals.filter(v => v < 7).length;

  return (
    <div className={`bg-white rounded-2xl border transition-all ${temRascunho ? 'border-[#F5C000]/60 shadow-[0_0_0_1px_#F5C000]' : 'border-slate-200'}`}>
      {/* Cabeçalho do card */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${temRascunho ? 'bg-[#F5C000]/20' : 'bg-[#001F3F]/5'}`}>
              <Building2 className={`w-5 h-5 ${temRascunho ? 'text-[#F5C000]' : 'text-[#001F3F]'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-[#001F3F] text-sm truncate">{nome}</h3>
                {temRascunho && (
                  <span className="flex-shrink-0 text-[10px] font-black bg-[#F5C000] text-[#001F3F] px-2 py-0.5 rounded-full animate-pulse">
                    ⚠️ RASCUNHO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-slate-400 font-bold">{qtdMeses} {qtdMeses === 1 ? 'mês' : 'meses'} apurados</span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-400">Último: <span className="font-bold text-slate-600">{ultimo}</span></span>
              </div>
            </div>
          </div>

          {/* Métricas rápidas */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Economia Total</p>
              <p className="text-lg font-black text-emerald-600">{fmt(totalEconomia)}</p>
              <p className="text-[10px] text-slate-400">~{fmt(mediaMensal)}/mês</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">% Trigo Médio</p>
              <div className="mt-0.5"><BadgeTrigo pct={trigoMedia} /></div>
              {trigoVals.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  <span className="text-emerald-600 font-bold">{mesOk}✓</span>
                  {mesFail > 0 && <span className="text-amber-600 font-bold ml-1">{mesFail}✗</span>}
                </p>
              )}
            </div>
            <button
              onClick={() => setExpandido(v => !v)}
              className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-700"
              title={expandido ? 'Fechar detalhes' : 'Ver por mês'}
            >
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tabela mensal expandida */}
      {expandido && (
        <div className="border-t border-slate-100 px-5 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-3 pb-2">Detalhamento Mensal</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="text-left py-1.5 pr-4">Mês</th>
                  <th className="text-right pr-4">Economia</th>
                  <th className="text-right pr-4">ICMS Pago</th>
                  <th className="text-right pr-4">ICMS Projetado</th>
                  <th className="text-right pr-4">% Trigo</th>
                  <th className="text-right">Fornec.</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(a => {
                  const ativos = a.fornecedores.filter(f => !f.descartado);
                  const eco = round(ativos.reduce((acc, f) => acc + f.economia, 0));
                  const pago = round(ativos.reduce((acc, f) => acc + f.icmsPago, 0));
                  const proj = round(ativos.reduce((acc, f) => acc + f.icmsProjetado, 0));
                  return (
                    <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-4 font-black text-[#001F3F]">{a.mesReferencia}</td>
                      <td className="py-2 pr-4 text-right font-bold text-emerald-600">{fmt(eco)}</td>
                      <td className="py-2 pr-4 text-right text-red-500 font-semibold">{fmt(pago)}</td>
                      <td className="py-2 pr-4 text-right text-blue-600 font-semibold">{fmt(proj)}</td>
                      <td className="py-2 pr-4 text-right">
                        <BadgeTrigo pct={a.percentualSistematica ?? null} />
                      </td>
                      <td className="py-2 text-right text-slate-400 font-bold">{ativos.length}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 pr-4 font-black text-slate-600 text-[10px] uppercase tracking-wider">Total</td>
                  <td className="py-2 pr-4 text-right font-black text-emerald-700">{fmt(totalEconomia)}</td>
                  <td className="py-2 pr-4 text-right font-black text-red-600">
                    {fmt(round(ordenadas.reduce((acc, a) => {
                      const ativos = a.fornecedores.filter(f => !f.descartado);
                      return acc + ativos.reduce((s, f) => s + f.icmsPago, 0);
                    }, 0)))}
                  </td>
                  <td className="py-2 pr-4 text-right font-black text-blue-700">
                    {fmt(round(ordenadas.reduce((acc, a) => {
                      const ativos = a.fornecedores.filter(f => !f.descartado);
                      return acc + ativos.reduce((s, f) => s + f.icmsProjetado, 0);
                    }, 0)))}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {trigoMedia !== null && <BadgeTrigo pct={trigoMedia} />}
                  </td>
                  <td className="py-2 text-right font-black text-slate-500">
                    {round(ordenadas.reduce((acc, a) => acc + a.fornecedores.filter(f => !f.descartado).length, 0) / (ordenadas.length || 1))}
                    <span className="text-[10px] text-slate-400 font-normal">/mês</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mini barra visual de % trigo por mês */}
          {trigoVals.length > 1 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">% Trigo por Mês</p>
              <div className="flex items-end gap-1 h-12">
                {[...ordenadas].reverse().map(a => {
                  const pct = a.percentualSistematica;
                  if (pct === null || pct === undefined) return null;
                  const altura = Math.min(100, (pct / 15) * 100);
                  const ok = pct >= 7;
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-0.5 flex-1" title={`${a.mesReferencia}: ${fmtPct(pct)}`}>
                      <div
                        className={`w-full rounded-t transition-all ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        style={{ height: `${Math.max(8, altura)}%` }}
                      />
                      <span className="text-[8px] text-slate-400 font-bold truncate w-full text-center">
                        {a.mesReferencia.split('/')[0]}/{a.mesReferencia.split('/')[1]?.slice(2)}
                      </span>
                    </div>
                  );
                })}
                {/* Linha de 7% */}
                <div className="absolute pointer-events-none" style={{ display: 'none' }} />
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-sm bg-emerald-400" />
                <span className="text-[9px] text-slate-400">≥ 7%</span>
                <div className="w-2 h-2 rounded-sm bg-amber-400 ml-2" />
                <span className="text-[9px] text-slate-400">&lt; 7%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TELA PAINEL GERAL ────────────────────────────────────────────────────────
interface PainelProps {
  onClose: () => void;
}

export function TelaPainelGeral({ onClose }: PainelProps) {
  const [historico, setHistorico] = useState<AuditoriaSalva[]>([]);
  const [rascunhosNomes, setRascunhosNomes] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<number | null>(null); // null=todos, -1=custom
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [ordenar, setOrdenar] = useState<'economia' | 'nome' | 'trigo'>('economia');
  const [busca, setBusca] = useState('');
  const [printPainel, setPrintPainel] = useState(false);

  useEffect(() => {
    Promise.all([carregarHistorico(), carregarRascunhos()]).then(([hist, rasc]) => {
      setHistorico(hist);
      setRascunhosNomes(new Set(rasc.map(r => r.nomeEmpresa)));
      setCarregando(false);
    });
  }, []);

  // Lista de todos os meses disponíveis no histórico (ordenados)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>(historico.map(a => a.mesReferencia));
    return Array.from(set).sort((a, b) => parseMes(a).getTime() - parseMes(b).getTime());
  }, [historico]);

  // Ao entrar no modo custom, inicializa com o range completo
  const ativarCustom = () => {
    if (mesesDisponiveis.length > 0) {
      setCustomInicio(mesesDisponiveis[0]);
      setCustomFim(mesesDisponiveis[mesesDisponiveis.length - 1]);
    }
    setPeriodo(-1);
  };

  const filtrado = useMemo(
    () => filtrarPorPeriodo(historico, periodo, customInicio, customFim),
    [historico, periodo, customInicio, customFim],
  );

  const empresas = useMemo(() => {
    const mapa = new Map<string, AuditoriaSalva[]>();
    for (const a of filtrado) {
      if (!mapa.has(a.nomeEmpresa)) mapa.set(a.nomeEmpresa, []);
      mapa.get(a.nomeEmpresa)!.push(a);
    }
    return mapa;
  }, [filtrado]);

  const empresasFiltradas = useMemo(() => {
    let lista = Array.from(empresas.entries());
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(([nome]) => nome.toLowerCase().includes(q));
    }
    lista.sort(([nA, aA], [nB, aB]) => {
      if (ordenar === 'nome') return nA.localeCompare(nB);
      if (ordenar === 'economia') {
        const eA = aA.reduce((acc, a) => acc + economiaAtiva(a), 0);
        const eB = aB.reduce((acc, a) => acc + economiaAtiva(a), 0);
        return eB - eA;
      }
      if (ordenar === 'trigo') {
        const tA = aA.map(a => a.percentualSistematica).filter((v): v is number => v !== null && v !== undefined);
        const tB = aB.map(a => a.percentualSistematica).filter((v): v is number => v !== null && v !== undefined);
        const mA = tA.length ? tA.reduce((a, b) => a + b, 0) / tA.length : -1;
        const mB = tB.length ? tB.reduce((a, b) => a + b, 0) / tB.length : -1;
        return mB - mA;
      }
      return 0;
    });
    return lista;
  }, [empresas, ordenar, busca]);

  // ── Totalizadores gerais ──
  const totalEconomiaGeral = round(filtrado.reduce((acc, a) => acc + economiaAtiva(a), 0));
  const totalMeses = filtrado.length;
  const trigoTodos = filtrado
    .map(a => a.percentualSistematica)
    .filter((v): v is number => v !== null && v !== undefined);
  const trigoMediaGeral = trigoTodos.length
    ? round(trigoTodos.reduce((a, b) => a + b, 0) / trigoTodos.length)
    : null;
  const trigoOk = trigoTodos.filter(v => v >= 7).length;
  const comRascunho = Array.from(empresas.keys()).filter(n => rascunhosNomes.has(n)).length;

  const PERIODOS = [
    { label: 'Todos', value: null },
    { label: '3 meses', value: 3 },
    { label: '6 meses', value: 6 },
    { label: '12 meses', value: 12 },
  ];

  const periodoLabel = periodo === null
    ? 'Todos os períodos'
    : periodo === -1
    ? `${customInicio} a ${customFim}`
    : `Últimos ${periodo} meses`;

  const gerarPDF = () => {
    setPrintPainel(true);
    setTimeout(() => {
      window.print();
      setPrintPainel(false);
    }, 300);
  };

  return (
    <>
    {printPainel && ReactDOM.createPortal(
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          #painel-print-root { display: none; }
          @media print {
            body > *:not(#painel-print-root) { display: none !important; }
            #painel-print-root { display: block !important; }
          }
        ` }} />
        <div id="painel-print-root">
          <PrintablePainelReport
            empresasFiltradas={empresasFiltradas}
            totalEconomiaGeral={totalEconomiaGeral}
            trigoMediaGeral={trigoMediaGeral}
            trigoOk={trigoOk}
            trigoTotal={trigoTodos.length}
            periodoLabel={periodoLabel}
          />
        </div>
      </>,
      document.body
    )}
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
      <div className="bg-[#f8fafc] rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-[#001F3F] px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#F5C000] p-2.5 rounded-xl">
                <BarChart2 className="w-5 h-5 text-[#001F3F]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Painel Geral</h2>
                <p className="text-sky-300 text-xs font-bold">
                  {empresas.size} empresa{empresas.size !== 1 ? 's' : ''} · {totalMeses} apuração{totalMeses !== 1 ? 'ões' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Filtro período — presets */}
              <div className="flex bg-white/10 rounded-xl overflow-hidden">
                {PERIODOS.map(p => (
                  <button
                    key={String(p.value)}
                    onClick={() => setPeriodo(p.value)}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${periodo === p.value ? 'bg-[#F5C000] text-[#001F3F]' : 'text-white/70 hover:text-white'}`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={ativarCustom}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-white/10 ${periodo === -1 ? 'bg-[#F5C000] text-[#001F3F]' : 'text-white/70 hover:text-white'}`}
                >
                  Personalizar
                </button>
              </div>
              <button
                onClick={gerarPDF}
                disabled={empresasFiltradas.length === 0}
                className="flex items-center gap-1.5 bg-[#F5C000] hover:bg-[#e6b000] disabled:opacity-40 text-[#001F3F] text-xs font-black px-3 py-2 rounded-xl transition-colors"
                title="Gerar PDF do painel atual"
              >
                <Printer className="w-4 h-4" />
                PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Seletor de período personalizado */}
          {periodo === -1 && mesesDisponiveis.length > 0 && (
            <div className="mt-3 flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5">
              <span className="text-xs font-bold text-white/60">De</span>
              <select
                value={customInicio}
                onChange={e => setCustomInicio(e.target.value)}
                className="bg-white/20 border-0 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m} className="text-slate-800 bg-white">{m}</option>
                ))}
              </select>
              <span className="text-xs font-bold text-white/60">até</span>
              <select
                value={customFim}
                onChange={e => setCustomFim(e.target.value)}
                className="bg-white/20 border-0 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m} className="text-slate-800 bg-white">{m}</option>
                ))}
              </select>
              <span className="text-xs text-[#F5C000] font-bold ml-1">
                {filtrado.length} apuração{filtrado.length !== 1 ? 'ões' : ''} no período
              </span>
            </div>
          )}
        </div>

        {/* ── Cards de totais ── */}
        <div className="grid grid-cols-4 gap-4 px-6 py-4 flex-shrink-0 bg-white border-b border-slate-200">
          <div className="bg-[#001F3F]/5 rounded-2xl p-4 text-center border border-[#001F3F]/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Empresas</p>
            <p className="text-3xl font-black text-[#001F3F]">{empresas.size}</p>
            {comRascunho > 0 && (
              <p className="text-[10px] text-[#F5C000] font-bold mt-1 animate-pulse">{comRascunho} c/ rascunho</p>
            )}
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Economia Total</p>
            <p className="text-2xl font-black text-emerald-700 leading-tight">{fmt(totalEconomiaGeral)}</p>
            <p className="text-[10px] text-emerald-500 mt-1">{totalMeses} meses apurados</p>
          </div>
          <div className={`rounded-2xl p-4 text-center border ${trigoMediaGeral === null ? 'bg-slate-50 border-slate-200' : trigoMediaGeral >= 7 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${trigoMediaGeral === null ? 'text-slate-400' : trigoMediaGeral >= 7 ? 'text-emerald-600' : 'text-amber-600'}`}>
              % Trigo Médio
            </p>
            <p className={`text-3xl font-black ${trigoMediaGeral === null ? 'text-slate-400' : trigoMediaGeral >= 7 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {trigoMediaGeral !== null ? fmtPct(trigoMediaGeral) : '—'}
            </p>
            {trigoTodos.length > 0 && (
              <p className="text-[10px] mt-1 text-slate-400">
                <span className="text-emerald-600 font-bold">{trigoOk}</span>/{trigoTodos.length} meses ≥7%
              </p>
            )}
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Média p/ Empresa</p>
            <p className="text-2xl font-black text-slate-700">
              {empresas.size > 0 ? fmt(round(totalEconomiaGeral / empresas.size)) : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">economia acumulada</p>
          </div>
        </div>

        {/* ── Barra de ferramentas ── */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-[#001F3F] text-slate-700 placeholder:text-slate-300"
          />
          <span className="text-xs text-slate-400 font-bold">Ordenar:</span>
          {(['economia', 'nome', 'trigo'] as const).map(op => (
            <button
              key={op}
              onClick={() => setOrdenar(op)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${ordenar === op ? 'bg-[#001F3F] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {op === 'economia' ? '💰 Economia' : op === 'nome' ? '🔤 Nome' : '🌾 Trigo'}
            </button>
          ))}
        </div>

        {/* ── Lista de empresas ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin opacity-40" />
              <p className="font-bold text-sm">Carregando dados...</p>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <FileText className="w-12 h-12 opacity-20" />
              <p className="font-bold text-lg">Nenhuma empresa encontrada</p>
              <p className="text-sm">Salve auditorias no histórico para elas aparecerem aqui.</p>
            </div>
          ) : (
            empresasFiltradas.map(([nome, auditorias]) => (
              <EmpresaCard
                key={nome}
                nome={nome}
                auditorias={auditorias}
                temRascunho={rascunhosNomes.has(nome)}
              />
            ))
          )}
        </div>
      </div>
    </div>
    </>
  );
}
