import React, { useState } from 'react';
import {
  X, Save, Clock, Edit3, Trash2, ChevronRight, Check,
  Calendar, FileText, AlertTriangle, Wheat, CheckCircle2, XCircle, Lock, Unlock, RotateCcw, Sparkles, Loader2,
} from 'lucide-react';
import {
  type RascunhoAuditoria,
  type BakeryItemSalvo,
  carregarRascunhos,
  salvarRascunho,
  excluirRascunho,
} from './storage';
import { PrintOverlay } from './relatorio';
import { groqChat } from './groqClient';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── MODAL SALVAR RASCUNHO ────────────────────────────────────────────────────
interface ModalRascunhoProps {
  nomeCliente: string;
  rascunhoExistente?: RascunhoAuditoria | null;  // se já tem rascunho do mesmo cliente, atualiza
  onConfirm: (mes: string, obs: string) => void;
  onClose: () => void;
}

export function ModalSalvarRascunho({ nomeCliente, rascunhoExistente, onConfirm, onClose }: ModalRascunhoProps) {
  const [mes, setMes] = useState(() => {
    if (rascunhoExistente) return rascunhoExistente.mesReferencia;
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [obs, setObs] = useState(rascunhoExistente?.observacao ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#001F3F]">Salvar Rascunho</h2>
              <p className="text-xs text-slate-400 font-medium">Pode ser continuado depois</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* cliente read-only */}
        <div className="flex items-center gap-3 bg-[#001F3F]/5 border border-[#001F3F]/10 rounded-2xl px-4 py-3">
          <FileText className="w-4 h-4 text-[#001F3F]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cliente</p>
            <p className="font-black text-[#001F3F] text-sm">{nomeCliente}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            O rascunho salva o estado atual (fornecedores + seleção de itens de trigo). Qualquer pessoa com acesso ao sistema pode abrir e finalizar.
          </p>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Mês de Referência</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input autoFocus type="text" value={mes} onChange={e => setMes(e.target.value)}
              placeholder="MM/AAAA"
              className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-amber-400 outline-none font-medium text-slate-800" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Observação (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex: aguardando confirmação do analista..."
            rows={2}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-amber-400 outline-none font-medium text-slate-800 placeholder:text-slate-300 resize-none text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => mes.trim() && onConfirm(mes.trim(), obs.trim())}
            disabled={!mes.trim()}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {rascunhoExistente ? 'Atualizar Rascunho' : 'Salvar Rascunho'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EDITOR DE RASCUNHO (tela completa para continuar) ───────────────────────
interface EditorRascunhoProps {
  rascunho: RascunhoAuditoria;
  onFinalizar: (rascunho: RascunhoAuditoria) => void;   // chama ModalSalvar normal
  onSalvarAlteracoes: (rascunho: RascunhoAuditoria) => void; // atualiza rascunho
  onClose: () => void;
}

export function EditorRascunho({ rascunho, onFinalizar, onSalvarAlteracoes, onClose }: EditorRascunhoProps) {
  const [items, setItems] = useState<BakeryItemSalvo[]>(rascunho.bakeryItems);
  const [fornecedores, setFornecedores] = useState(rascunho.fornecedores);
  const [editandoMes, setEditandoMes] = useState(false);
  const [mes, setMes] = useState(rascunho.mesReferencia);
  const [printMode, setPrintMode] = useState<'none' | 'icms' | 'trigo'>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [iaAnalisando, setIaAnalisando] = useState(false);
  const [iaAviso, setIaAviso] = useState<string | null>(null);

  const toggleItem = (idx: number) => {
    if (isConfirmed) return;
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  };

  const classificarComIA = async () => {
    if (items.length === 0 || isConfirmed) return;
    setIaAnalisando(true);
    setIaAviso(null);
    try {
      const productList = items.map((p, idx) =>
        `${idx}: ${p.description}${p.ncm ? ` [NCM: ${p.ncm}]` : ''} - Fornecedor: ${p.supplier}`
      ).join('\n');
      const prompt = `Você é um auditor fiscal especializado em panificação. Avalie cada item e recomende se deve ou não ser contado na sistemática de panificação (regra dos 7%).\n\nContar: farinhas de trigo, pré-misturas, semolina, trigo em grão.\nNão contar: itens que não são insumo de panificação.\n\nResponda SOMENTE com JSON array:\n[{"index":0,"shouldCount":true,"confidence":"high","reason":"..."},...]\n\nProdutos:\n${productList}`;
      const response = await groqChat({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 2000,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Erro Groq');
      }
      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        const results: { index: number; shouldCount: boolean; confidence: string }[] = JSON.parse(jsonMatch[0]);
        setItems(prev => prev.map((it, i) => {
          const r = results.find(r => r.index === i);
          return r ? { ...it, selected: r.shouldCount, aiConfidence: r.confidence as any } : it;
        }));
        setIaAviso('✓ IA classificou os itens. Revise e confirme.');
      }
    } catch (err) {
      setIaAviso('⚠️ IA indisponível. Tente novamente mais tarde.');
    } finally {
      setIaAnalisando(false);
    }
  };

  const toggleDescartar = (id: string) => {
    setFornecedores(prev => prev.map(f => f.id === id ? { ...f, descartado: !f.descartado } : f));
  };

  const selecionados = items.filter(i => i.selected);
  const selectedTotal = round(selecionados.reduce((a, i) => a + i.value, 0));
  const questorTotal = rascunho.questorTotal;
  const pct = questorTotal && questorTotal > 0 ? (selectedTotal / questorTotal) * 100 : null;
  const isOk = pct !== null && pct >= 7;

  // Se não há itens de trigo, pode finalizar sem precisar confirmar contagem
  const semTrigo = items.length === 0;
  const podeFinalizarSemTrigo = semTrigo;
  const finalizar = isConfirmed || podeFinalizarSemTrigo;

  const fornecedoresAtivos = fornecedores.filter(f => !f.descartado);
  const economiaAtiva = round(fornecedoresAtivos.reduce((a, f) => a + f.economia, 0));
  const descartadosCount = fornecedores.filter(f => f.descartado).length;

  const rascunhoAtualizado: RascunhoAuditoria = {
    ...rascunho,
    mesReferencia: mes,
    bakeryItems: items,
    fornecedores,
  };

  // Recalcula summaryTable para o PDF refletindo descartes
  const summaryTableRascunho = React.useMemo(() => {
    const orig = rascunho.summaryTable ?? [];
    const normalRow = orig.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')));
    const ativos = fornecedoresAtivos;
    const totalSimplesIcms = round(ativos.reduce((a, f) => a + f.icmsPago, 0));
    const totalSimplesValor = round(ativos.reduce((a, f) => a + f.valorTotal, 0));
    const totalProjetado = round(ativos.reduce((a, f) => a + f.icmsProjetado, 0));
    const totalNormalIcms = normalRow?.icmsAntecipado ?? 0;
    const totalNormalValor = normalRow?.valorTotal ?? 0;
    const totalPagoReal = round(totalNormalIcms + totalSimplesIcms);
    const totalProjetadoIdeal = round(totalNormalIcms + totalProjetado);
    return [
      ...(normalRow ? [normalRow] : []),
      { label: 'Simples Nacional', valorTotal: totalSimplesValor, icmsAntecipado: totalSimplesIcms },
      { label: 'Projeção (Normal)', valorTotal: totalSimplesValor, icmsAntecipado: totalProjetado },
      { label: 'Total ICMS Pago (Real)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalPagoReal },
      { label: 'Total ICMS Projetado (Cenário Ideal)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalProjetadoIdeal },
      { label: 'Diferença (Economia)', valorTotal: 0, icmsAntecipado: round(totalPagoReal - totalProjetadoIdeal) },
    ];
  }, [fornecedoresAtivos, rascunho.summaryTable]);

  // monta dados para PDF (reutiliza PrintOverlay)
  const auditParaPrint = {
    ...rascunhoAtualizado,
    id: rascunho.id,
    criadoEm: rascunho.criadoEm,
    nomeEmpresa: rascunho.nomeEmpresa,
    mesReferencia: mes,
    totalIcmsPago: round(fornecedoresAtivos.reduce((a, f) => a + f.icmsPago, 0)),
    totalIcmsProjetado: round(fornecedoresAtivos.reduce((a, f) => a + f.icmsProjetado, 0)),
    economiaTotal: economiaAtiva,
    totalRegistros: fornecedores.length,
    percentualSistematica: pct,
    regra7pctAtendida: pct !== null ? isOk : null,
    trigoQuestorTotal: questorTotal,
    trigoSelectedTotal: selectedTotal,
    trigoItens: selecionados.map(i => ({ description: i.description, supplier: i.supplier, ncm: i.ncm, value: i.value })),
    summaryTable: summaryTableRascunho,
    fornecedores,
  };

  return (
    <>
      {printMode !== 'none' && (
        <PrintOverlay auditoria={auditParaPrint as any} modo={printMode} onDone={() => setPrintMode('none')} />
      )}

      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-amber-500 p-5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white/60 uppercase tracking-widest">RASCUNHO</span>
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">em aberto</span>
                </div>
                <h2 className="text-xl font-black text-white">{rascunho.nomeEmpresa}</h2>
              </div>
              <div className="ml-2">
                {editandoMes ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={mes} onChange={e => setMes(e.target.value)}
                      className="bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white text-sm font-bold outline-none w-28" />
                    <button onClick={() => setEditandoMes(false)} className="text-white text-xs font-bold">OK</button>
                  </div>
                ) : (
                  <button onClick={() => setEditandoMes(true)} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                    <span className="text-white text-sm font-bold">{mes}</span>
                    <Edit3 className="w-3 h-3 text-white/70" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setPrintMode('icms')} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                <FileText className="w-3.5 h-3.5" />PDF ICMS
              </button>
              {isConfirmed && selecionados.length > 0 && (
                <button onClick={() => setPrintMode('trigo')} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                  <Wheat className="w-3.5 h-3.5" />PDF Trigo
                </button>
              )}
              <button onClick={() => onSalvarAlteracoes(rascunhoAtualizado)}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                <Save className="w-3.5 h-3.5" />Salvar Alterações
              </button>
              <button
                onClick={() => finalizar && onFinalizar(rascunhoAtualizado)}
                title={!finalizar ? 'Confirme a contagem do trigo primeiro' : ''}
                className={`flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all
                  ${finalizar
                    ? 'bg-[#001F3F] hover:bg-[#002d5c] cursor-pointer'
                    : 'bg-[#001F3F]/40 cursor-not-allowed opacity-60'
                  }`}
              >
                <Check className="w-3.5 h-3.5" />Finalizar Apuração
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Corpo com duas colunas */}
          <div className="flex flex-1 overflow-hidden">

            {/* Coluna esquerda: fornecedores ICMS */}
            <div className="flex-1 overflow-y-auto p-5 border-r border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Fornecedores · {fornecedoresAtivos.length} ativos
                  </p>
                  {descartadosCount > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{descartadosCount} descartado(s)</p>
                  )}
                </div>
                <span className="text-lg font-black text-emerald-600">{fmt(economiaAtiva)}</span>
              </div>

              {/* KPIs resumidos */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">ICMS Pago</p>
                  <p className="text-sm font-black text-red-500">{fmt(round(fornecedoresAtivos.reduce((a,f)=>a+f.icmsPago,0)))}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Projetado</p>
                  <p className="text-sm font-black text-blue-500">{fmt(round(fornecedoresAtivos.reduce((a,f)=>a+f.icmsProjetado,0)))}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Economia</p>
                  <p className="text-sm font-black text-emerald-600">{fmt(economiaAtiva)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                {fornecedores.map(f => (
                  <div key={f.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm ${f.descartado ? 'opacity-50 bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate text-xs ${f.descartado ? 'line-through text-slate-400' : 'text-slate-800'}`}>{f.nome}</p>
                      <p className="text-[10px] text-slate-400 truncate">{f.produto}</p>
                    </div>
                    <p className={`text-xs font-bold flex-shrink-0 ${f.descartado ? 'text-slate-300' : 'text-emerald-600'}`}>{fmt(f.economia)}</p>
                    <button
                      onClick={() => toggleDescartar(f.id)}
                      title={f.descartado ? 'Restaurar' : 'Descartar'}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                        f.descartado
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      {f.descartado ? <><RotateCcw className="w-3 h-3" />Restaurar</> : <>✕ Descartar</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita: itens de trigo */}
            <div className="w-[420px] flex-shrink-0 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Sistemática · {selecionados.length} selecionados
                </p>
                {pct !== null && (
                  <span className={`text-xs font-black px-2 py-1 rounded-full ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {isOk ? '✓' : '✗'} {pct.toFixed(2).replace('.', ',')}%
                  </span>
                )}
              </div>

              {/* Botão classificar com IA */}
              {items.length > 0 && !isConfirmed && (
                <button
                  onClick={classificarComIA}
                  disabled={iaAnalisando}
                  className="w-full mb-3 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  {iaAnalisando
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analisando com IA...</>
                    : <><Sparkles className="w-3.5 h-3.5" />Classificar com IA</>
                  }
                </button>
              )}
              {iaAviso && (
                <div className={`text-xs font-bold px-3 py-2 rounded-lg mb-3 ${iaAviso.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {iaAviso}
                </div>
              )}

              {questorTotal && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-700">Total Comercialização</p>
                  <p className="text-sm font-black text-amber-800">{fmt(questorTotal)}</p>
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Wheat className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">Nenhum item de trigo nesta apuração.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <button key={i} onClick={() => toggleItem(i)}
                      disabled={isConfirmed}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        isConfirmed
                          ? (item.selected ? 'bg-amber-50 border-amber-200 cursor-default' : 'bg-slate-50 border-slate-100 opacity-40 cursor-default')
                          : item.selected
                            ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                      }`}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                        item.selected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                      }`}>
                        {item.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-xs truncate ${item.selected ? 'text-slate-800' : 'text-slate-500'}`}>{item.description}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.supplier}</p>
                      </div>
                      <p className="text-xs font-bold text-slate-600 flex-shrink-0">{fmt(item.value)}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Resultado + botão confirmar */}
              {questorTotal && selectedTotal > 0 && (
                <div className={`mt-4 p-3 rounded-xl border-l-4 ${isOk ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-500'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-600">Total selecionado</p>
                      <p className="text-sm font-black text-slate-800">{fmt(selectedTotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black" style={{ color: isOk ? '#059669' : '#dc2626' }}>
                        {pct?.toFixed(2).replace('.', ',')}%
                      </p>
                      <p className={`text-xs font-black ${isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isOk ? 'APROVADO' : 'REPROVADO'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão confirmar / editar contagem */}
              {items.length > 0 && (
                <div className="mt-4">
                  {!isConfirmed ? (
                    <button
                      onClick={() => setIsConfirmed(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100"
                    >
                      <Lock className="w-4 h-4" />
                      Confirmar Contagem do Trigo
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsConfirmed(false)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Editar Seleção
                      </button>
                      <div className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isOk ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        Validação {isOk ? 'Aprovada' : 'Reprovada'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">
                Criado em {new Date(rascunho.criadoEm).toLocaleString('pt-BR')}
              </p>
              {rascunho.observacao && (
                <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                  📝 {rascunho.observacao}
                </span>
              )}
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-red-500 font-bold">Excluir rascunho?</p>
                <button onClick={() => { excluirRascunho(rascunho.id).then(() => onClose()); }}
                  className="text-xs bg-red-500 text-white font-bold px-3 py-1.5 rounded-xl">Sim, excluir</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-red-400 font-bold transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Excluir rascunho
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CARD DE RASCUNHO (usado no DashboardCliente) ─────────────────────────────
interface CardRascunhoProps {
  key?: React.Key | null;
  rascunho: RascunhoAuditoria;
  onClick: () => void;
}

export function CardRascunho({ rascunho, onClick }: CardRascunhoProps) {
  const ativos = rascunho.fornecedores.filter(f => !f.descartado);
  const economia = round(ativos.reduce((a, f) => a + f.economia, 0));
  const selecionados = rascunho.bakeryItems.filter(i => i.selected).length;
  const ago = (() => {
    const diff = Date.now() - new Date(rascunho.atualizadoEm).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  })();

  return (
    <button onClick={onClick}
      className="w-full bg-amber-50 border-2 border-amber-200 hover:border-amber-400 rounded-2xl p-5 flex items-center gap-5 transition-all hover:shadow-sm text-left group">
      {/* Ícone de rascunho */}
      <div className="bg-amber-400 rounded-2xl p-3 flex-shrink-0">
        <Clock className="w-5 h-5 text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-black bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider">RASCUNHO</span>
          <span className="text-sm font-bold text-slate-700">{rascunho.mesReferencia}</span>
        </div>
        <p className="text-xs text-slate-400">
          {ativos.length} fornecedores · {selecionados} itens trigo · {ago}
        </p>
        {rascunho.observacao && (
          <p className="text-xs text-amber-600 font-medium mt-0.5 truncate">📝 {rascunho.observacao}</p>
        )}
      </div>

      {/* Economia */}
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Economia</p>
        <p className="text-xl font-black text-emerald-600">{fmt(economia)}</p>
      </div>

      <ChevronRight className="w-5 h-5 text-amber-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
    </button>
  );
}
