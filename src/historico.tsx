import React, { useState } from 'react';
import { Trash2, ChevronRight, X, Save, History, Building2, Calendar, CheckCircle2, XCircle, Edit3, Download, FileText, Wheat, RotateCcw, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SeletorCliente } from './clientes';
import { PrintOverlay } from './relatorio';
import {
  type AuditoriaSalva,
  type FornecedorSalvo,
  salvarAuditoria,
  carregarHistorico,
  atualizarAuditoria,
  excluirAuditoria,
} from './storage';

export type { AuditoriaSalva, FornecedorSalvo };

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── MODAL SALVAR ─────────────────────────────────────────────────────────────
interface ModalSalvarProps {
  onConfirm: (empresa: string, mes: string) => void;
  onClose: () => void;
  economiaTotal: number;
  nomeCliente: string;
  mesInicial?: string; // quando já definido (ex: rascunho), pula a pergunta
}

export function ModalSalvar({ onConfirm, onClose, economiaTotal, nomeCliente, mesInicial }: ModalSalvarProps) {
  const [mes, setMes] = useState(() => {
    if (mesInicial) return mesInicial;
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#001F3F] p-2.5 rounded-xl">
              <Save className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-[#001F3F]">Salvar no Histórico</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Cliente (somente leitura) */}
        <div className="flex items-center gap-3 bg-[#001F3F]/5 border border-[#001F3F]/10 rounded-2xl px-4 py-3">
          <Building2 className="w-5 h-5 text-[#001F3F] flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cliente</p>
            <p className="font-black text-[#001F3F]">{nomeCliente}</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Economia Calculada</p>
          <p className="text-3xl font-black text-emerald-700">{fmt(economiaTotal)}</p>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">
            Mês de Referência
            {mesInicial && <span className="ml-2 text-[10px] text-emerald-600 normal-case font-bold">✓ definido no rascunho</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus={!mesInicial}
              type="text"
              value={mes}
              readOnly={!!mesInicial}
              onChange={e => { if (!mesInicial) setMes(e.target.value); }}
              placeholder="MM/AAAA"
              className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl outline-none font-medium text-slate-800 placeholder:text-slate-300 transition-all ${
                mesInicial
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 cursor-default select-none'
                  : 'border-slate-200 focus:border-[#001F3F]'
              }`}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => mes.trim() && onConfirm(nomeCliente, mes.trim())}
            disabled={!mes.trim()}
            className="flex-1 py-3 bg-[#001F3F] hover:bg-[#002d5c] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETALHE DA AUDITORIA ─────────────────────────────────────────────────────
interface DetalheProps {
  auditoria: AuditoriaSalva;
  onClose: () => void;
  onUpdate: (a: AuditoriaSalva) => void;
}

export function DetalheAuditoria({ auditoria, onClose, onUpdate }: DetalheProps) {
  const [dados, setDados] = useState<AuditoriaSalva>(JSON.parse(JSON.stringify(auditoria)));
  const [printMode, setPrintMode] = useState<'none' | 'icms' | 'trigo'>('none');
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState(dados.nomeEmpresa);
  const [editandoMes, setEditandoMes] = useState(false);
  const [novoMes, setNovoMes] = useState(dados.mesReferencia);

  const ativos = dados.fornecedores.filter(f => !f.descartado);
  const economiaAtiva = round(ativos.reduce((a, f) => a + f.economia, 0));
  const icmsPagoAtivo = round(ativos.reduce((a, f) => a + f.icmsPago, 0));
  const icmsProjetadoAtivo = round(ativos.reduce((a, f) => a + f.icmsProjetado, 0));

  const baixarExcel = () => {
    const ativos = dados.fornecedores.filter(f => !f.descartado);
    const rows: any[][] = [
      ['Fornecedor', 'Produto', 'Valor Total', 'ICMS Pago', 'ICMS Projetado', 'Economia'],
      ...ativos.map(f => [f.nome, f.produto, f.valorTotal, f.icmsPago, f.icmsProjetado, f.economia]),
      [],
      ['TOTAL', '', ativos.reduce((a,f)=>a+f.valorTotal,0), ativos.reduce((a,f)=>a+f.icmsPago,0), ativos.reduce((a,f)=>a+f.icmsProjetado,0), ativos.reduce((a,f)=>a+f.economia,0)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:40},{wch:40},{wch:16},{wch:16},{wch:18},{wch:16}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const s2ab = (s: string) => { const buf = new ArrayBuffer(s.length); const view = new Uint8Array(buf); for (let i=0;i<s.length;++i) view[i]=s.charCodeAt(i)&0xFF; return buf; };
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUDITORIA_${dados.nomeEmpresa.replace(/\s+/g,'_')}_${dados.mesReferencia.replace('/','_')}.xlsx`;
    document.body.appendChild(link); link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
  };

  const toggleDescartar = (id: string) => {
    const novos = dados.fornecedores.map(f => f.id === id ? { ...f, descartado: !f.descartado } : f);
    const novo = { ...dados, fornecedores: novos };
    setDados(novo);
    atualizarAuditoria(novo);
    onUpdate(novo);
  };

  const salvarNome = () => {
    const novo = { ...dados, nomeEmpresa: novoNome };
    setDados(novo); atualizarAuditoria(novo); onUpdate(novo); setEditandoNome(false);
  };

  const salvarMes = () => {
    const novo = { ...dados, mesReferencia: novoMes };
    setDados(novo); atualizarAuditoria(novo); onUpdate(novo); setEditandoMes(false);
  };

  return (
    <>
    {printMode !== 'none' && (
      <PrintOverlay
        auditoria={dados}
        modo={printMode}
        onDone={() => setPrintMode('none')}
      />
    )}
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-[#001F3F] p-6 flex items-center justify-between flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {editandoNome ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)}
                    className="bg-white/10 border border-white/30 rounded-lg px-3 py-1 text-white font-bold outline-none" />
                  <button onClick={salvarNome} className="text-emerald-400 text-xs font-bold">Salvar</button>
                  <button onClick={() => setEditandoNome(false)} className="text-white/50 text-xs">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-white">{dados.nomeEmpresa}</h2>
                  <button onClick={() => setEditandoNome(true)} className="text-white/40 hover:text-white/80">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editandoMes ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={novoMes} onChange={e => setNovoMes(e.target.value)}
                    className="bg-white/10 border border-white/30 rounded-lg px-3 py-1 text-sky-200 text-sm font-bold outline-none w-28" />
                  <button onClick={salvarMes} className="text-emerald-400 text-xs font-bold">Salvar</button>
                  <button onClick={() => setEditandoMes(false)} className="text-white/50 text-xs">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sky-300 text-sm font-bold">{dados.mesReferencia}</p>
                  <button onClick={() => setEditandoMes(true)} className="text-white/40 hover:text-white/80">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <span className="text-white/30 text-xs">• {new Date(dados.criadoEm).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrintMode('icms')}
              title="Relatório ICMS — Impacto Tributário"
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF ICMS
            </button>
            {dados.trigoItens && dados.trigoItens.length > 0 && (
              <button
                onClick={() => setPrintMode('trigo')}
                title="Relatório Sistemática de Panificação"
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                <Wheat className="w-4 h-4" />
                PDF Trigo
              </button>
            )}
            <button
              onClick={baixarExcel}
              title="Baixar Excel"
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar Excel
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Economia Ativa</p>
            <p className="text-2xl font-black text-emerald-600">{fmt(economiaAtiva)}</p>
            {economiaAtiva !== dados.economiaTotal && (
              <p className="text-xs text-slate-400 mt-1">Original: {fmt(dados.economiaTotal)}</p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">ICMS Pago</p>
            <p className="text-2xl font-black text-red-500">{fmt(icmsPagoAtivo)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">ICMS Projetado</p>
            <p className="text-2xl font-black text-blue-600">{fmt(icmsProjetadoAtivo)}</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {ativos.length} ativos · {dados.fornecedores.filter(f => f.descartado).length} descartados
            </p>
            <p className="text-xs text-slate-400 italic">Passe o mouse para descartar</p>
          </div>
          {dados.fornecedores.map(f => (
            <div key={f.id} className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${f.descartado ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${f.descartado ? 'line-through text-slate-400' : 'text-slate-800'}`}>{f.nome}</p>
                <p className="text-xs text-slate-400 truncate">{f.produto}</p>
              </div>
              <div className="text-right flex-shrink-0 space-y-0.5">
                <p className="text-xs text-slate-400">{fmt(f.valorTotal)}</p>
                <p className={`text-sm font-bold ${f.descartado ? 'text-slate-400' : 'text-emerald-600'}`}>{fmt(f.economia)}</p>
              </div>
              {/* Botão descartar/restaurar — aparece no hover */}
              <button
                onClick={() => toggleDescartar(f.id)}
                title={f.descartado ? 'Restaurar linha' : 'Descartar linha'}
                className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all
                  ${f.descartado
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 opacity-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 opacity-0 group-hover:opacity-100'
                  }`}
              >
                {f.descartado
                  ? <><RotateCcw className="w-3 h-3" />Restaurar</>
                  : <><EyeOff className="w-3 h-3" />Descartar</>
                }
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}

// ─── TELA HISTÓRICO ───────────────────────────────────────────────────────────
interface HistoricoProps {
  onClose: () => void;
}

export function TelaHistorico({ onClose }: HistoricoProps) {
  const [lista, setLista] = useState<AuditoriaSalva[]>(carregarHistorico);
  const [detalhe, setDetalhe] = useState<AuditoriaSalva | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleExcluir = (id: string) => {
    excluirAuditoria(id);
    setLista(carregarHistorico());
    setConfirmDelete(null);
  };

  const handleUpdate = (a: AuditoriaSalva) => {
    setLista(carregarHistorico());
    setDetalhe(a);
  };

  const empresas = Array.from(new Set(lista.map(a => a.nomeEmpresa)));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="bg-[#001F3F] p-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-sky-400" />
              <div>
                <h2 className="text-xl font-black text-white">Histórico de Auditorias</h2>
                <p className="text-sky-300 text-xs font-bold">{lista.length} auditoria{lista.length !== 1 ? 's' : ''} salva{lista.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            {lista.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-bold text-lg">Nenhuma auditoria salva ainda.</p>
                <p className="text-sm mt-1">Processe uma planilha e clique em "Salvar no Histórico".</p>
              </div>
            ) : (
              <div className="space-y-8">
                {empresas.map(empresa => {
                  const auditorias = lista.filter(a => a.nomeEmpresa === empresa);
                  return (
                    <div key={empresa}>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-[#001F3F]" />
                        <h3 className="font-black text-[#001F3F] uppercase tracking-wide text-sm">{empresa}</h3>
                        <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                          {auditorias.length} {auditorias.length === 1 ? 'mês' : 'meses'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {auditorias.map(a => {
                          const ativos = a.fornecedores.filter(f => !f.descartado);
                          const economiaAtiva = round(ativos.reduce((acc, f) => acc + f.economia, 0));
                          return (
                            <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-[#001F3F]/30 hover:shadow-sm transition-all">
                              <div className="bg-slate-50 rounded-xl p-3 flex-shrink-0 text-center min-w-[80px] border border-slate-100">
                                <p className="text-xs font-black text-[#001F3F]">{a.mesReferencia}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">{a.totalRegistros} fornecedores</span>
                                  {(a.percentualSistematica !== null && a.percentualSistematica !== undefined ? true : a.regra7pctAtendida !== null) && (
                                    a.percentualSistematica !== null && a.percentualSistematica !== undefined
                                      ? <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${a.regra7pctAtendida ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>🌾 {a.percentualSistematica.toFixed(2).replace('.', ',')}%</span>
                                      : <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${a.regra7pctAtendida ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>🌾 {a.regra7pctAtendida ? '≥7%' : '<7%'}</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 mt-0.5">{new Date(a.criadoEm).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">Economia</p>
                                <p className="text-lg font-black text-emerald-600">{fmt(economiaAtiva)}</p>
                                {economiaAtiva !== a.economiaTotal && (
                                  <p className="text-xs text-slate-300 line-through">{fmt(a.economiaTotal)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => setDetalhe(a)}
                                  className="flex items-center gap-1.5 bg-[#001F3F] hover:bg-[#002d5c] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                                >
                                  Abrir <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                {confirmDelete === a.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleExcluir(a.id)} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Sim</button>
                                    <button onClick={() => setConfirmDelete(null)} className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl">Não</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setConfirmDelete(a.id)} className="p-2 hover:bg-red-50 hover:text-red-500 text-slate-300 rounded-xl transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {detalhe && (
        <DetalheAuditoria
          auditoria={detalhe}
          onClose={() => setDetalhe(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
