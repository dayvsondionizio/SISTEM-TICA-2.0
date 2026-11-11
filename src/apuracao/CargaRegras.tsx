import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Loader2, Check, AlertTriangle } from 'lucide-react';
import { carregarClientes, type Cliente } from '../storage';
import { lerArquivo, aprender, memoriaVazia, mesDoNome, type Memoria } from './motor';
import { carregarRegras, salvarRegras } from './regrasBanco';

/**
 * Carga única (endereço /#carga-regras, sem link no app): lê a pasta das apurações já feitas pela analista
 * (…\SISTEMÁTICA\1- SISTEMATICA\2026) e grava as regras de cada empresa no cliente correspondente.
 */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ordem = (m: string) => { const [mm, yy] = m.split('/').map(Number); return (yy || 0) * 100 + (mm || 0); };

interface Grupo { pasta: string; arquivos: File[]; porMes: Map<string, File>; ignorados: string[]; clienteId: string }

export default function CargaRegras() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [existentes, setExistentes] = useState<Record<string, string[]>>({});
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [substituir, setSubstituir] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => { carregarClientes().then(setClientes).catch(e => setErro((e as Error).message)); }, []);
  const clientesOrd = useMemo(() => [...clientes].sort((a, b) => a.nome.localeCompare(b.nome)), [clientes]);

  // regras que já existem no banco (para avisar antes de sobrescrever)
  useEffect(() => {
    if (!clientes.length) return;
    Promise.all(clientes.map(async c => [c.id, (await carregarRegras(c.id)).mem.meses] as const))
      .then(l => setExistentes(Object.fromEntries(l)))
      .catch(e => setErro((e as Error).message));
  }, [clientes]);

  function sugerir(pasta: string) {
    const [empresa, unidade] = pasta.split(' / ');
    const base = norm(`${empresa.split(' - ')[0]}${unidade ? ` ${unidade}` : ''}`);
    const exato = clientes.find(c => norm(c.nome) === base);
    if (exato) return exato.id;
    const parcial = clientes.filter(c => norm(c.nome).startsWith(base) || base.startsWith(norm(c.nome)));
    return parcial.length === 1 ? parcial[0].id : '';
  }

  function escolherPasta(files: FileList | null) {
    if (!files?.length) return;
    const mapa = new Map<string, File[]>();
    [...files].forEach(f => {
      const partes = (f.webkitRelativePath || f.name).split('/');
      if (partes.length < 3 || !f.name.toLowerCase().endsWith('.xlsx') || f.name.startsWith('~$')) return;
      // empresa com matriz e filial: …/EMPRESA/MATRIZ/MÊS/arquivo → cada unidade vira um grupo próprio
      const sub = partes.length >= 5 ? partes[2] : '';
      const pasta = /^(MATRIZ|FILIAL)/i.test(norm(sub)) ? `${partes[1]} / ${sub}` : partes[1];
      mapa.set(pasta, [...(mapa.get(pasta) ?? []), f]);
    });
    const gs: Grupo[] = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pasta, arquivos]) => {
      const porMes = new Map<string, File>(); const ignorados: string[] = [];
      arquivos.forEach(f => {
        if (/c[oó]pia/i.test(f.name)) { ignorados.push(`${f.name} (cópia)`); return; }
        const m = mesDoNome(f.name);
        if (!m) { ignorados.push(`${f.name} (sem mês no nome)`); return; }
        const atual = porMes.get(m);
        // mesmo mês em mais de um arquivo (ex.: revisada): fica o salvo por último
        if (!atual || f.lastModified > atual.lastModified) { if (atual) ignorados.push(`${atual.name} (substituído por versão mais nova de ${m})`); porMes.set(m, f); }
        else ignorados.push(`${f.name} (versão mais antiga de ${m})`);
      });
      return { pasta, arquivos, porMes, ignorados, clienteId: sugerir(pasta) };
    });
    setGrupos(gs); setLog([]);
  }

  async function gravar() {
    setRodando(true); setErro('');
    const add = (t: string) => setLog(l => [...l, t]);
    for (const g of grupos) {
      if (!g.clienteId) { add(`— ${g.pasta}: sem cliente escolhido, pulado.`); continue; }
      const nome = clientes.find(c => c.id === g.clienteId)?.nome ?? g.clienteId;
      if ((existentes[g.clienteId]?.length ?? 0) > 0 && !substituir) { add(`— ${nome}: já tem regras no banco, pulado.`); continue; }
      let mem: Memoria = memoriaVazia(); const lidos: string[] = [], falhas: string[] = [];
      for (const [mes, f] of [...g.porMes.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]))) {
        add(`… ${nome}: lendo ${mes}`);
        try {
          const a = await lerArquivo(f);
          if (!a.analista) { falhas.push(`${mes} (sem aba SISTEMATICA)`); continue; }
          mem = aprender(mem, a.itens, it => a.analista!.decisoes.get(it.id)!, mes);
          lidos.push(mes);
        } catch (e) { falhas.push(`${mes} (${(e as Error).message})`); }
      }
      try {
        await salvarRegras(g.clienteId, mem);
        setExistentes(x => ({ ...x, [g.clienteId]: mem.meses }));
        add(`✓ ${nome}: ${Object.keys(mem.produtos).length} produtos, ${lidos.length} mês(es) gravados${falhas.length ? ` · não lidos: ${falhas.join(', ')}` : ''}`);
      } catch (e) { add(`✗ ${nome}: ${(e as Error).message}`); }
    }
    setRodando(false);
  }

  const prontos = grupos.filter(g => g.clienteId).length;

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#17150F] font-report">
      <header className="bg-[#17150F] text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] font-semibold">Uso único</p>
          <h1 className="font-display text-2xl">Carga das regras da apuração</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <p className="text-sm text-stone-600">Escolha a pasta <b>2026</b> dentro de <code>SISTEMÁTICA\1- SISTEMATICA</code>. Cada subpasta é uma empresa; confira o cliente de cada uma antes de gravar. Nada é apagado: só cria ou atualiza a regra de cada cliente na tabela de regras.</p>
        {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{erro}</p>}

        <label className="inline-flex items-center gap-2 bg-[#17150F] text-white text-sm font-semibold px-4 py-2.5 rounded-lg cursor-pointer hover:bg-black">
          <FolderOpen className="w-4 h-4" />Escolher a pasta 2026
          <input type="file" hidden {...{ webkitdirectory: '' }} multiple onChange={e => escolherPasta(e.target.files)} />
        </label>

        {grupos.length > 0 && (
          <>
            <table className="w-full text-sm bg-white border border-[#E7E2D6] rounded-xl overflow-hidden">
              <thead className="bg-[#F7F4EC] text-[11px] uppercase tracking-wider text-stone-500">
                <tr><th className="text-left px-3 py-2">Pasta</th><th className="text-left px-3 py-2">Cliente no app</th><th className="text-left px-3 py-2">Meses</th><th className="text-left px-3 py-2">Situação no banco</th></tr>
              </thead>
              <tbody>
                {grupos.map((g, i) => (
                  <tr key={g.pasta} className="border-t border-[#F1EDE3] align-top">
                    <td className="px-3 py-2 font-medium">{g.pasta}
                      {g.ignorados.length > 0 && <details className="text-[11px] text-stone-400 font-normal"><summary>{g.ignorados.length} arquivo(s) ignorado(s)</summary>{g.ignorados.map(t => <div key={t}>{t}</div>)}</details>}
                    </td>
                    <td className="px-3 py-2">
                      <select value={g.clienteId} onChange={e => setGrupos(gs => gs.map((x, j) => (j === i ? { ...x, clienteId: e.target.value } : x)))}
                        className={`border rounded px-2 py-1 text-sm w-64 ${g.clienteId ? 'border-[#E7E2D6]' : 'border-amber-400 bg-amber-50'}`}>
                        <option value="">— não carregar —</option>
                        {clientesOrd.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs">{[...g.porMes.keys()].sort((a, b) => ordem(a) - ordem(b)).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-xs">{g.clienteId && (existentes[g.clienteId]?.length
                      ? <span className="text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />já tem {existentes[g.clienteId].length} mês(es)</span>
                      : <span className="text-stone-400">sem regras</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center gap-4">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={substituir} onChange={e => setSubstituir(e.target.checked)} />Substituir regras de clientes que já têm</label>
              <button onClick={gravar} disabled={rodando || !prontos}
                className="ml-auto flex items-center gap-2 bg-[#17150F] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-black disabled:opacity-30">
                {rodando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Ler planilhas e gravar regras de {prontos} cliente(s)
              </button>
            </div>
          </>
        )}

        {log.length > 0 && (
          <pre className="bg-white border border-[#E7E2D6] rounded-xl p-4 text-xs whitespace-pre-wrap max-h-96 overflow-auto">{log.filter((l, i, a) => !l.startsWith('…') || i === a.length - 1).join('\n')}</pre>
        )}
      </main>
    </div>
  );
}
