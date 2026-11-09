import { supabase } from './supabaseClient';
import type { RankingIcms } from './rankingIcms';

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  criadoEm: string;
}

export async function carregarClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('icms_clientes')
    .select('*')
    .order('nome');
  if (error) { console.error('carregarClientes:', error); return []; }
  return (data ?? []).map(r => ({
    id: r.id, nome: r.nome, cnpj: r.cnpj ?? '', criadoEm: r.criado_em,
  }));
}

export async function persistirClientes(lista: Cliente[]): Promise<void> {
  // Upsert completo — insere ou atualiza
  const rows = lista.map(c => ({ id: c.id, nome: c.nome, cnpj: c.cnpj, criado_em: c.criadoEm }));
  const { error } = await supabase.from('icms_clientes').upsert(rows);
  if (error) console.error('persistirClientes:', error);
}

export async function excluirCliente(id: string): Promise<void> {
  const { error } = await supabase.from('icms_clientes').delete().eq('id', id);
  if (error) console.error('excluirCliente:', error);
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
  trigoQuestorTotal?: number | null;
  trigoSelectedTotal?: number | null;
  trigoItens?: TrigoItemSalvo[];
  summaryTable?: SummaryRowSalvo[];
  rankingIcms?: RankingIcms | null;
}

function dbToAuditoria(r: any): AuditoriaSalva {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    nomeEmpresa: r.nome_empresa,
    mesReferencia: r.mes_referencia,
    totalIcmsPago: r.total_icms_pago ?? 0,
    totalIcmsProjetado: r.total_icms_projetado ?? 0,
    economiaTotal: r.economia_total ?? 0,
    totalRegistros: r.total_registros ?? 0,
    percentualSistematica: r.percentual_sistematica ?? null,
    regra7pctAtendida: r.regra7pct_atendida ?? null,
    fornecedores: r.fornecedores ?? [],
    trigoQuestorTotal: r.trigo_questor_total ?? null,
    trigoSelectedTotal: r.trigo_selected_total ?? null,
    trigoItens: r.trigo_itens ?? [],
    summaryTable: r.summary_table ?? [],
    rankingIcms: r.ranking_icms ?? undefined,
  };
}

function auditoriaToDb(a: AuditoriaSalva) {
  return {
    id: a.id,
    criado_em: a.criadoEm,
    nome_empresa: a.nomeEmpresa,
    mes_referencia: a.mesReferencia,
    total_icms_pago: a.totalIcmsPago,
    total_icms_projetado: a.totalIcmsProjetado,
    economia_total: a.economiaTotal,
    total_registros: a.totalRegistros,
    percentual_sistematica: a.percentualSistematica ?? null,
    regra7pct_atendida: a.regra7pctAtendida ?? null,
    fornecedores: a.fornecedores,
    trigo_questor_total: a.trigoQuestorTotal ?? null,
    trigo_selected_total: a.trigoSelectedTotal ?? null,
    trigo_itens: a.trigoItens ?? [],
    summary_table: a.summaryTable ?? [],
    // Só envia a coluna quando há ranking: auditorias antigas e fluxos sem ranking gravam EXATAMENTE o que gravavam antes.
    ...(a.rankingIcms ? { ranking_icms: a.rankingIcms } : {}),
  };
}

// Se a coluna ranking_icms ainda não existir no banco, a gravação é refeita sem ela para nunca perder a apuração.
const faltaColunaRanking = (e: any) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /ranking_icms/i.test(String(e.message ?? '')));
const semRanking = (row: Record<string, any>) => { const { ranking_icms: _r, ...resto } = row; return resto; };

export async function carregarHistorico(): Promise<AuditoriaSalva[]> {
  const { data, error } = await supabase
    .from('icms_auditorias')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { console.error('carregarHistorico:', error); return []; }
  return (data ?? []).map(dbToAuditoria);
}

export async function salvarAuditoria(a: AuditoriaSalva): Promise<void> {
  const row = auditoriaToDb(a);
  let { error } = await supabase.from('icms_auditorias').upsert(row);
  if (error && 'ranking_icms' in row && faltaColunaRanking(error)) {
    console.warn('salvarAuditoria: coluna ranking_icms ainda não existe; salvando sem o ranking');
    ({ error } = await supabase.from('icms_auditorias').upsert(semRanking(row)));
  }
  if (error) console.error('salvarAuditoria:', error);
}

export async function atualizarAuditoria(a: AuditoriaSalva): Promise<void> {
  const row = auditoriaToDb(a);
  let { error } = await supabase.from('icms_auditorias').update(row).eq('id', a.id);
  if (error && 'ranking_icms' in row && faltaColunaRanking(error)) {
    console.warn('atualizarAuditoria: coluna ranking_icms ainda não existe; atualizando sem o ranking');
    ({ error } = await supabase.from('icms_auditorias').update(semRanking(row)).eq('id', a.id));
  }
  if (error) console.error('atualizarAuditoria:', error);
}

export async function excluirAuditoria(id: string): Promise<void> {
  const { error } = await supabase.from('icms_auditorias').delete().eq('id', id);
  if (error) console.error('excluirAuditoria:', error);
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
  fornecedores: FornecedorSalvo[];
  summaryTable: SummaryRowSalvo[];
  bakeryItems: BakeryItemSalvo[];
  questorTotal: number | null;
  rankingIcms?: RankingIcms | null;
}

function dbToRascunho(r: any): RascunhoAuditoria {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    nomeEmpresa: r.nome_empresa,
    mesReferencia: r.mes_referencia ?? '',
    observacao: r.observacao ?? undefined,
    fornecedores: r.fornecedores ?? [],
    summaryTable: r.summary_table ?? [],
    bakeryItems: r.bakery_items ?? [],
    questorTotal: r.questor_total ?? null,
    rankingIcms: r.ranking_icms ?? undefined,
  };
}

function rascunhoToDb(r: RascunhoAuditoria) {
  return {
    id: r.id,
    criado_em: r.criadoEm,
    atualizado_em: new Date().toISOString(),
    nome_empresa: r.nomeEmpresa,
    mes_referencia: r.mesReferencia,
    observacao: r.observacao ?? null,
    fornecedores: r.fornecedores,
    summary_table: r.summaryTable,
    bakery_items: r.bakeryItems,
    questor_total: r.questorTotal,
    ...(r.rankingIcms ? { ranking_icms: r.rankingIcms } : {}),
  };
}

export async function carregarRascunhos(): Promise<RascunhoAuditoria[]> {
  const { data, error } = await supabase
    .from('icms_rascunhos')
    .select('*')
    .order('atualizado_em', { ascending: false });
  if (error) { console.error('carregarRascunhos:', error); return []; }
  return (data ?? []).map(dbToRascunho);
}

export async function salvarRascunho(r: RascunhoAuditoria): Promise<void> {
  const row = rascunhoToDb(r);
  let { error } = await supabase.from('icms_rascunhos').upsert(row);
  if (error && 'ranking_icms' in row && faltaColunaRanking(error)) {
    console.warn('salvarRascunho: coluna ranking_icms ainda não existe; salvando sem o ranking');
    ({ error } = await supabase.from('icms_rascunhos').upsert(semRanking(row)));
  }
  if (error) console.error('salvarRascunho:', error);
}

export async function excluirRascunho(id: string): Promise<void> {
  const { error } = await supabase.from('icms_rascunhos').delete().eq('id', id);
  if (error) console.error('excluirRascunho:', error);
}
