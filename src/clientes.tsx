import React, { useState } from 'react';
import { X, Plus, Building2, Hash, Trash2, Edit3, Save, Check, Users } from 'lucide-react';
import { type Cliente, carregarClientes, persistirClientes } from './storage';

export type { Cliente };

function formatarCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// ─── TELA CLIENTES ────────────────────────────────────────────────────────────
interface TelaClientesProps {
  onClose: () => void;
}

export function TelaClientes({ onClose }: TelaClientesProps) {
  const [lista, setLista] = useState<Cliente[]>([]);
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editCnpj, setEditCnpj] = useState('');

  React.useEffect(() => { carregarClientes().then(setLista); }, []);

  const handleAdicionar = () => {
    if (!nome.trim()) return;
    const novo: Cliente = {
      id: `${Date.now()}`,
      nome: nome.trim(),
      cnpj: cnpj.trim(),
      criadoEm: new Date().toISOString(),
    };
    const nova = [novo, ...lista];
    persistirClientes(nova).then(() => setLista(nova));
    setNome('');
    setCnpj('');
    setAdicionando(false);
  };

  const handleEditSalvar = (id: string) => {
    const nova = lista.map(c => c.id === id ? { ...c, nome: editNome.trim(), cnpj: editCnpj.trim() } : c);
    persistirClientes(nova).then(() => { setLista(nova); setEditandoId(null); });
  };

  const handleExcluir = (id: string) => {
    const nova = lista.filter(c => c.id !== id);
    persistirClientes(nova).then(() => { setLista(nova); setConfirmDelete(null); });
  };

  const iniciarEdicao = (c: Cliente) => {
    setEditandoId(c.id);
    setEditNome(c.nome);
    setEditCnpj(c.cnpj);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="bg-[#001F3F] p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <Users className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Cadastro de Clientes</h2>
              <p className="text-sky-300 text-xs font-bold">{lista.length} cliente{lista.length !== 1 ? 's' : ''} cadastrado{lista.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAdicionando(true); setEditandoId(null); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {adicionando && (
            <div className="bg-slate-50 border-2 border-[#001F3F]/20 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#001F3F]">Novo Cliente</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                    placeholder="Nome da empresa *"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-[#001F3F] outline-none font-medium text-slate-800 placeholder:text-slate-300 bg-white"
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={cnpj}
                    onChange={e => setCnpj(formatarCnpj(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                    placeholder="CNPJ (opcional)"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-[#001F3F] outline-none font-medium text-slate-800 placeholder:text-slate-300 bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setAdicionando(false); setNome(''); setCnpj(''); }}
                  className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdicionar}
                  disabled={!nome.trim()}
                  className="flex-1 py-2.5 bg-[#001F3F] hover:bg-[#002d5c] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </div>
          )}

          {lista.length === 0 && !adicionando ? (
            <div className="text-center py-20 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">Nenhum cliente cadastrado.</p>
              <p className="text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
            </div>
          ) : (
            lista.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all">
                {editandoId === c.id ? (
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input autoFocus value={editNome} onChange={e => setEditNome(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border-2 border-[#001F3F]/30 rounded-xl outline-none font-medium text-slate-800" />
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input value={editCnpj} onChange={e => setEditCnpj(formatarCnpj(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none font-medium text-slate-800" />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{c.nome}</p>
                    {c.cnpj && <p className="text-xs text-slate-400 font-mono mt-0.5">{c.cnpj}</p>}
                  </div>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  {editandoId === c.id ? (
                    <>
                      <button onClick={() => handleEditSalvar(c.id)} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditandoId(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => iniciarEdicao(c)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {confirmDelete === c.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleExcluir(c.id)} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Sim</button>
                          <button onClick={() => setConfirmDelete(null)} className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SELETOR DE CLIENTE ───────────────────────────────────────────────────────
interface SeletorClienteProps {
  value: string;
  onChange: (clienteId: string, clienteNome: string) => void;
}

export function SeletorCliente({ value, onChange }: SeletorClienteProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);
  React.useEffect(() => { carregarClientes().then(setClientes); }, []);
  const selecionado = clientes.find(c => c.id === value);

  if (clientes.length === 0) {
    return (
      <div className="w-full px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 text-center">
        Nenhum cliente cadastrado.{' '}
        <span className="text-[#001F3F] font-bold">Cadastre primeiro em "Clientes".</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={`w-full px-4 py-3 border-2 rounded-xl text-left flex items-center justify-between transition-all ${
          selecionado ? 'border-[#001F3F]/30 bg-[#001F3F]/5' : 'border-slate-200 hover:border-[#001F3F]/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {selecionado ? (
            <div>
              <p className="font-bold text-slate-800 text-sm">{selecionado.nome}</p>
              {selecionado.cnpj && <p className="text-xs text-slate-400 font-mono">{selecionado.cnpj}</p>}
            </div>
          ) : (
            <span className="text-slate-400 text-sm">Selecione o cliente...</span>
          )}
        </div>
        <span className="text-slate-400 text-xs">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {clientes.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id, c.nome); setAberto(false); }}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${value === c.id ? 'bg-[#001F3F]/5' : ''}`}
            >
              <Building2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-800 text-sm">{c.nome}</p>
                {c.cnpj && <p className="text-xs text-slate-400 font-mono">{c.cnpj}</p>}
              </div>
              {value === c.id && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
