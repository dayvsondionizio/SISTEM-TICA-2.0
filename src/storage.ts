// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  criadoEm: string;
}

const KEY_CLIENTES = 'economia_icms_clientes';

export function carregarClientes(): Cliente[] {
  try {
    const raw = localStorage.getItem(KEY_CLIENTES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function persistirClientes(lista: Cliente[]) {
  localStorage.setItem(KEY_CLIENTES, JSON.stringify(lista));
}

// ─── AUDITORIAS ───────────────────────────────────────────────────────────────
export interface FornecedorSalvo {
  id: string;
  nome: string;
  produto: string;
  valorTotal: number;
  icmsPago: number;
  icmsProjetado: number;
  economia: number;
  descartado: boolean;
}

export interface SummaryRowSalvo {
  label: string;
  valorTotal: number;
  icmsAntecipado: number;
}

export interface TrigoItemSalvo {
  description: string;
  supplier: string;
  ncm?: string;
  value: number;
}

export interface AuditoriaSalva {
  id: string;
  criadoEm: string;
  nomeEmpresa: string;
  mesReferencia: string;
  totalIcmsPago: number;
  totalIcmsProjetado: number;
  economiaTotal: number;
  totalRegistros: number;
  percentualSistematica: number | null;
  regra7pctAtendida: boolean | null;
  fornecedores: FornecedorSalvo[];
  // dados do relatório de panificação (trigo)
  trigoQuestorTotal?: number | null;
  trigoSelectedTotal?: number | null;
  trigoItens?: TrigoItemSalvo[];
  // tabela de resumo da aba ICMS (necessária para o PDF idêntico ao original)
  summaryTable?: SummaryRowSalvo[];
}

const KEY_AUDITORIAS = 'economia_icms_historico';

export function carregarHistorico(): AuditoriaSalva[] {
  try {
    const raw = localStorage.getItem(KEY_AUDITORIAS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function salvarAuditoria(auditoria: AuditoriaSalva) {
  const lista = carregarHistorico();
  lista.unshift(auditoria);
  localStorage.setItem(KEY_AUDITORIAS, JSON.stringify(lista));
}

export function atualizarAuditoria(auditoria: AuditoriaSalva) {
  const lista = carregarHistorico();
  const idx = lista.findIndex(a => a.id === auditoria.id);
  if (idx !== -1) {
    lista[idx] = auditoria;
    localStorage.setItem(KEY_AUDITORIAS, JSON.stringify(lista));
  }
}

export function excluirAuditoria(id: string) {
  const lista = carregarHistorico().filter(a => a.id !== id);
  localStorage.setItem(KEY_AUDITORIAS, JSON.stringify(lista));
}

// ─── RASCUNHOS ────────────────────────────────────────────────────────────────
export interface BakeryItemSalvo {
  description: string;
  supplier: string;
  value: number;
  ncm?: string;
  selected: boolean;
  aiConfidence: 'high' | 'medium' | 'low';
}

export interface RascunhoAuditoria {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  nomeEmpresa: string;
  mesReferencia: string;
  observacao?: string;
  // dados da planilha processada
  fornecedores: FornecedorSalvo[];
  summaryTable: SummaryRowSalvo[];
  // dados do trigo
  bakeryItems: BakeryItemSalvo[];
  questorTotal: number | null;
}

const KEY_RASCUNHOS = 'economia_icms_rascunhos';

export function carregarRascunhos(): RascunhoAuditoria[] {
  try {
    const raw = localStorage.getItem(KEY_RASCUNHOS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function salvarRascunho(r: RascunhoAuditoria) {
  const lista = carregarRascunhos().filter(x => x.id !== r.id);
  lista.unshift({ ...r, atualizadoEm: new Date().toISOString() });
  localStorage.setItem(KEY_RASCUNHOS, JSON.stringify(lista));
}

export function excluirRascunho(id: string) {
  const lista = carregarRascunhos().filter(r => r.id !== id);
  localStorage.setItem(KEY_RASCUNHOS, JSON.stringify(lista));
}
