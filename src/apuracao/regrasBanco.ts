import { supabase } from '../supabaseClient';
import { memoriaVazia, type Memoria } from './motor';

/**
 * Regras da apuração, uma linha por cliente na tabela `icms_regras_apuracao`
 * (tabela própria: não toca em icms_auditorias, icms_rascunhos nem icms_clientes).
 */
const TABELA = 'icms_regras_apuracao';

export interface RegrasCarregadas { mem: Memoria; atualizadoEm: string | null; atualizadoPor: string | null; tabelaFalta: boolean }

const faltaTabela = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(e.message ?? ''));

export async function carregarRegras(clienteId: string): Promise<RegrasCarregadas> {
  const { data, error } = await supabase.from(TABELA).select('regras, meses, atualizado_em, atualizado_por').eq('cliente_id', clienteId).maybeSingle();
  if (error) {
    if (faltaTabela(error)) return { mem: memoriaVazia(), atualizadoEm: null, atualizadoPor: null, tabelaFalta: true };
    throw new Error(`Não foi possível carregar as regras: ${error.message}`);
  }
  if (!data) return { mem: memoriaVazia(), atualizadoEm: null, atualizadoPor: null, tabelaFalta: false };
  return {
    mem: { produtos: (data.regras as Memoria['produtos']) ?? {}, meses: (data.meses as string[]) ?? [] },
    atualizadoEm: data.atualizado_em ?? null, atualizadoPor: data.atualizado_por ?? null, tabelaFalta: false,
  };
}

export async function salvarRegras(clienteId: string, mem: Memoria): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from(TABELA).upsert({
    cliente_id: clienteId, regras: mem.produtos, meses: mem.meses,
    atualizado_em: new Date().toISOString(), atualizado_por: u.user?.email ?? null,
  }, { onConflict: 'cliente_id' });
  if (error) throw new Error(faltaTabela(error) ? 'A tabela de regras ainda não existe no Supabase.' : `Não foi possível gravar as regras: ${error.message}`);
}
