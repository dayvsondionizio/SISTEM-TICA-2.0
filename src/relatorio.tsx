import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { carregarClientes, type AuditoriaSalva, type SummaryRowSalvo } from './storage';

function useCnpjPorNome(nomeEmpresa: string | undefined): string | undefined {
  const [cnpj, setCnpj] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!nomeEmpresa) return;
    let ativo = true;
    carregarClientes().then(lista => {
      if (!ativo) return;
      const alvo = nomeEmpresa.trim().toLowerCase();
      const encontrado = lista.find(c => c.nome.trim().toLowerCase() === alvo);
      setCnpj(encontrado?.cnpj || undefined);
    });
    return () => { ativo = false; };
  }, [nomeEmpresa]);
  return cnpj;
}

// ─── TIPOS INTERNOS (espelham os de App.tsx) ─────────────────────────────────
interface SimplesSupplierData {
  name: string;
  productName?: string;
  originalValue: number;
  newValue: number;
  economy: number;
  productTotal: number;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── PADRÃO VISUAL · CONTADOR DE PADARIAS ────────────────────────────────────
// Paleta: papel off-white, tinta quase-preta, dourado de destaque, bloco escuro.
// Tipografia: Newsreader (serif, títulos/números) + IBM Plex Sans (corpo/tabelas).
const INK = '#17150F';
const GOLD = '#9A7B12';
const GOLD_LIGHT = '#E7C453';
const POSITIVE = '#3F6B4A';
const NEGATIVE = '#A33B3B';

const thCls = 'py-3 pr-3 text-left text-[10px] uppercase tracking-wider text-[#78736A] font-medium';
const thClsRight = 'py-3 pl-3 text-right text-[10px] uppercase tracking-wider text-[#78736A] font-medium';
const rowCls = (idx: number) => `border-b border-[#EFEBE3] ${idx % 2 === 0 ? 'bg-[#F7F5EF]' : 'bg-transparent'}`;

// ─── RELATÓRIO ICMS (idêntico ao PrintableReport de App.tsx) ─────────────────
interface IcmsReportProps {
  data: SimplesSupplierData[];
  summaryTable: SummaryRowSalvo[];
  fileName: string;
  mes?: string;
  wheatPrintData?: any;
}

export function PrintableIcmsReport({ data, summaryTable, fileName, mes, wheatPrintData }: IcmsReportProps) {
  const companyName = fileName.replace('AUDITORIA_', '').split('.')[0].replace(/_/g, ' ').toUpperCase();

  const totalSimples    = round(summaryTable.find(r => r.label.toUpperCase().includes('SIMPLES NACIONAL'))?.icmsAntecipado || 0);
  const totalNormal     = round(summaryTable.find(r =>
    r.label.toUpperCase() === 'NORMAL' ||
    (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO'))
  )?.icmsAntecipado || 0);
  const totalProjected  = round(summaryTable.find(r => r.label.includes('Projeção (Normal)'))?.icmsAntecipado || 0);
  const pagoRow = summaryTable.find(r => r.label.includes('Real'));
  const totalPagoReal   = pagoRow ? round(pagoRow.icmsAntecipado) : round(totalNormal + totalSimples);
  const totalProjetadoIdeal = round(totalPagoReal - totalSimples + totalProjected);
  const totalDiff       = round(totalPagoReal - totalProjetadoIdeal);

  return (
    <div className="bg-[#EDEAE2] py-12 print:p-0 print:bg-white text-[#17150F] font-report">
      <div className="max-w-[210mm] mx-auto space-y-12 print:space-y-0 shadow-2xl print:shadow-none">

        {/* Página 1: Capa */}
        <div className="min-h-[297mm] bg-[#17150F] text-[#FCFBF8] flex flex-col justify-between p-16 break-after-page">
          <div className="flex items-start justify-between">
            <img src="/logo-white.png" alt="Contador de Padarias" className="h-10 w-auto" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#CFC9BE]">Relatório Estratégico Tributário</p>
          </div>
          <div className="space-y-4 max-w-2xl">
            <h1 className="font-display text-[56px] leading-[1.05]">Impacto</h1>
            <h1 className="font-display text-[56px] leading-[1.05]">Tributário</h1>
            <p className="font-display italic text-xl text-[#E7C453] mt-6 pb-4 border-b border-white/15 inline-block max-w-lg leading-snug">
              nas Compras de Fornecedores do Simples Nacional
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-[#CFC9BE]">
              Análise estratégica para empresa <span className="text-[#FCFBF8] font-semibold">{companyName}</span>
            </p>
            {mes && <p className="text-base font-medium text-[#E7C453] mt-1">{mes}</p>}
          </div>
        </div>

        {/* Página 2: Introdução */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-16 flex flex-col justify-center break-after-page">
          <p className="font-display italic text-2xl text-[#5E594F] mb-10">Prezado(a) cliente,</p>
          <div className="space-y-7 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>
              Gostaríamos de compartilhar algumas informações importantes relacionadas aos fornecedores que você está adquirindo insumos ou mercadorias para revenda, os quais são optantes pelo regime tributário do Simples Nacional.
            </p>
            <p>
              Conforme mencionado anteriormente, quando sua empresa adquire produtos tributados de ICMS de fornecedores do Simples Nacional no estado de Pernambuco, a carga tributária média do ICMS aumenta de{' '}
              <span className="font-semibold text-[#17150F]">5,5% para 25,5%</span>, devido à sistemática de panificação à qual sua empresa é optante.
            </p>
            <p>
              Com base nessa informação, preparamos uma planilha contendo a lista dos fornecedores do Simples Nacional e os respectivos produtos tributados de ICMS que você está adquirindo. É importante ressaltar que o objetivo dessa lista é proporcionar uma maior transparência e auxiliá-lo(a) na análise das condições comerciais oferecidas pelos fornecedores.
            </p>
          </div>
        </div>

        {/* Página 3+: Tabela */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-14 break-after-page">
          <h2 className="font-display text-2xl text-[#17150F] mb-6">Fornecedores do Simples Nacional</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#17150F]">
                <th className={thCls}>Nome do Fornec do Simples Nacional</th>
                <th className={thCls}>Nome do Produto</th>
                <th className={thClsRight}>Valor Total Prod Período</th>
                <th className={thClsRight}>Valor do ICMS a Pagar</th>
                <th className={thClsRight}>Valor de ICMS que teria pago (Reg Normal)</th>
                <th className={thClsRight}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} className={rowCls(idx)}>
                  <td className="py-3 pr-3 font-medium text-[#17150F]">{item.name}</td>
                  <td className="py-3 pr-3 text-[#5E594F]">{item.productName}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-[#5E594F]">{fmtBRL(item.productTotal)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums font-medium text-[#17150F]">{fmtBRL(item.originalValue)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums font-medium text-[#9A7B12]">{fmtBRL(item.newValue)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums font-semibold text-[#17150F]">{fmtBRL(item.economy)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#17150F] font-semibold text-[12px]">
                <td colSpan={2} className="py-4 pr-3 text-right uppercase tracking-wide text-[10px] text-[#5E594F]">Total</td>
                <td className="py-4 pr-3 text-right tabular-nums">{fmtBRL(data.reduce((a, b) => a + b.productTotal, 0))}</td>
                <td className="py-4 pr-3 text-right tabular-nums">{fmtBRL(data.reduce((a, b) => a + b.originalValue, 0))}</td>
                <td className="py-4 pr-3 text-right tabular-nums text-[#9A7B12]">{fmtBRL(data.reduce((a, b) => a + b.newValue, 0))}</td>
                <td className="py-4 pl-3 text-right tabular-nums">{fmtBRL(data.reduce((a, b) => a + b.economy, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Página: Conclusão */}
        <div className="min-h-[297mm] bg-[#FCFBF8] px-16 py-14 flex flex-col justify-center break-after-page">
          <div className="space-y-6 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>
              Ao adquirir produtos tributados de ICMS de fornecedores enquadrados no Simples Nacional (conforme tabela), o valor total de ICMS gerado foi de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalSimples)}</span>.
            </p>
            <p>
              No entanto, se tivéssemos adquirido os mesmos produtos de fornecedores do Regime Normal de apuração, o ICMS seria de apenas{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalProjected)}</span>.
            </p>
            <p className="font-display italic text-[28px] leading-snug" style={{ color: NEGATIVE }}>
              Isso destaca uma diferença notável de {fmtBRL(totalDiff)}.
            </p>
            <p>
              Considerando o cenário global da empresa, o valor total pago de ICMS (Normal + Simples Nacional) foi de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalPagoReal)}</span>, enquanto o valor ideal projetado seria de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalProjetadoIdeal)}</span>.
            </p>

            {wheatPrintData?.isConfirmed && (
              <p className="border-l-2 border-[#C9A227] pl-6 py-1 text-[#5E594F] break-inside-avoid">
                A título de Validação Técnica da Sistemática de Panificação, registramos um montante total de compras para comercialização de{' '}
                <span className="font-semibold whitespace-nowrap text-[#17150F]">{fmtBRL(wheatPrintData.questorTotal || 0)}</span>, no qual identificamos{' '}
                <span className="font-semibold whitespace-nowrap text-[#17150F]">{fmtBRL(wheatPrintData.selectedTotal)}</span> em aquisições validadas pelo analista como insumos de panificação (trigo/pré-misturas). Isso{' '}
                <span className="font-semibold text-[#17150F]">{wheatPrintData.isOk ? 'atesta o cumprimento' : 'registra o não cumprimento'}</span> da regra dos 7%, alcançando o índice de{' '}
                <span className="font-display italic font-semibold ml-2" style={{ color: GOLD, fontSize: '1.4em' }}>
                  {wheatPrintData.percentage ? wheatPrintData.percentage.toFixed(2).replace('.', ',') : '0,00'}%
                </span>.
              </p>
            )}

            <p>
              Recomendamos que você verifique cuidadosamente os produtos listados na planilha e considere a possibilidade de negociar melhores condições com seus fornecedores. É possível que, ao estabelecer uma comunicação clara e transparente, seja viável obter descontos financeiros no boleto ou outras vantagens que possam equilibrar as contas e evitar uma operação onerosa.
            </p>
          </div>
        </div>

        {/* Página: Encerramento */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-16 flex flex-col justify-center">
          <div className="space-y-8 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>
              Caso necessite de suporte adicional para entender os aspectos tributários e as possibilidades de negociação, estamos à disposição para fornecer orientações personalizadas e auxiliá-lo(a) na busca por soluções que otimizem sua gestão financeira.
            </p>
            <p>
              Agradecemos pela confiança em nossos serviços e estamos comprometidos em ajudá-lo(a) a alcançar a eficiência tributária e a lucratividade sustentável em seu negócio.
            </p>
            <div className="pt-16 break-inside-avoid flex items-center gap-4">
              <span className="inline-flex items-center bg-[#17150F] px-4 py-2">
                <img src="/logo-white.png" alt="Contador de Padarias" className="h-7 w-auto" />
              </span>
              <p className="font-display italic text-lg text-[#17150F]">Atenciosamente,</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── RELATÓRIO TRIGO (idêntico ao bloco wheat de App.tsx) ────────────────────
interface TrigoReportProps {
  nomeEmpresa?: string;
  cnpj?: string;
  mesReferencia?: string;
  wheatPrintData: {
    selectedTotal: number;
    questorTotal: number | null;
    isOk: boolean;
    percentage: number | null;
    selectedItems: { description: string; supplier: string; ncm?: string; value: number }[];
  };
}

export function PrintableTrigoReport({ nomeEmpresa, cnpj, mesReferencia, wheatPrintData }: TrigoReportProps) {
  const questorTotal = wheatPrintData.questorTotal ?? 0;
  const faltaPontos = wheatPrintData.isOk || wheatPrintData.percentage === null
    ? 0
    : Math.max(0, round(7 - wheatPrintData.percentage));
  const faltaParaMeta = wheatPrintData.isOk
    ? 0
    : Math.max(0, round(questorTotal * 0.07 - wheatPrintData.selectedTotal));

  return (
    <div className="print:block p-14 bg-[#FCFBF8] min-h-screen text-[#17150F] font-report">
      <div className="max-w-[210mm] mx-auto">

        <div className="flex items-center justify-between border-b border-[#17150F] pb-6 mb-10">
          <div>
            <h1 className="font-display text-[30px] text-[#17150F] leading-tight">
              Validação Técnica <span className="text-[#A29C92]">–</span>{' '}
              <span className="italic" style={{ color: GOLD }}>Sistemática de Panificação</span>
            </h1>
            <p className="text-[14px] text-[#5E594F] font-medium mt-1">Relatório de auditoria e verificação da regra dos 7%</p>
            {nomeEmpresa && (
              <p className="text-[15px] font-semibold text-[#17150F] mt-3">
                {nomeEmpresa}
                {cnpj && <span className="text-[13px] font-normal text-[#78736A] ml-2">CNPJ {cnpj}</span>}
              </p>
            )}
            {mesReferencia && <p className="text-[12px] text-[#78736A] mt-0.5">Período de referência: {mesReferencia}</p>}
          </div>
          <span className="inline-flex items-center bg-[#17150F] px-4 py-2 shrink-0">
            <img src="/logo-white.png" alt="Contador de Padarias" className="h-7 w-auto" />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-12 pb-10 border-b border-[#E5E0D6]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#78736A] font-medium mb-2">Total Validado</p>
            <p className="font-display text-[38px] leading-none tabular-nums" style={{ color: GOLD }}>
              {fmtBRL(wheatPrintData.selectedTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#78736A] font-medium mb-2">Total Compras Comercialização</p>
            <p className="font-display text-[38px] text-[#17150F] leading-none tabular-nums">
              {wheatPrintData.questorTotal ? fmtBRL(wheatPrintData.questorTotal) : 'Não informado'}
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-10 mb-8">
          <div>
            <p className="text-lg font-medium text-[#17150F] mb-2">% Trigo Apurado no Mês:</p>
            <p className="font-display font-semibold text-[42px] leading-none tabular-nums" style={{ color: wheatPrintData.isOk ? POSITIVE : NEGATIVE }}>
              {wheatPrintData.percentage ? `${wheatPrintData.percentage.toFixed(2).replace('.', ',')}%` : '0,00%'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#78736A] font-medium mb-2">Meta de Referência</p>
            <p className="font-display text-[28px] text-[#17150F] leading-none tabular-nums">7,00%</p>
          </div>
        </div>

        <p className="text-[12px] text-[#5E594F] leading-relaxed mb-14">
          {wheatPrintData.isOk
            ? 'Resultado parcial do mês. O enquadramento definitivo na sistemática de panificação é apurado ao final do semestre.'
            : <>
                Resultado parcial do mês, abaixo da meta de referência. O enquadramento definitivo é apurado ao final do semestre
                {faltaPontos > 0 && (
                  <>, mas faltaram <span className="font-semibold" style={{ color: NEGATIVE }}>{faltaPontos.toFixed(2).replace('.', ',')} pontos percentuais</span> para atingir os 7% neste mês — o equivalente a aproximadamente{' '}
                    <span className="font-semibold" style={{ color: NEGATIVE }}>{fmtBRL(faltaParaMeta)}</span>
                    {' '}a mais em compras de insumos de panificação (farinha e pré-misturas), mantida a mesma base de compras. Recomendamos reforçar essas compras no próximo mês para compensar a diferença</>
                )}.
              </>}
        </p>

        <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#78736A] font-medium mb-4 pb-3 border-b border-[#17150F]">
          Itens Classificados como Panificação (Marcados com ✓)
        </h3>
        <table className="w-full text-left text-[12px] border-collapse">
          <thead>
            <tr className="border-b border-[#17150F]">
              <th className={thCls}>Descrição do Produto (NCM 1101/1901)</th>
              <th className={thCls}>Fornecedor</th>
              <th className={thClsRight}>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {wheatPrintData.selectedItems.map((item, i) => (
              <tr key={i} className={rowCls(i)}>
                <td className="py-3 pr-3 font-medium text-[#17150F]">
                  {item.description}
                  {item.ncm && <span className="font-normal text-[#A29C92] text-[11px] ml-2">NCM: {item.ncm}</span>}
                </td>
                <td className="py-3 pr-3 text-[#5E594F]">{item.supplier}</td>
                <td className="py-3 pl-3 text-right tabular-nums font-medium text-[#17150F]">{fmtBRL(item.value)}</td>
              </tr>
            ))}
            {wheatPrintData.selectedItems.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-[#A29C92] font-medium">Nenhum item marcado pelo analista.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── OVERLAY MULTI-MÊS ───────────────────────────────────────────────────────
interface PrintOverlayMultiProps {
  auditorias: AuditoriaSalva[];
  modo: 'icms' | 'trigo';
  onDone: () => void;
}

export function PrintOverlayMulti({ auditorias, modo, onDone }: PrintOverlayMultiProps) {
  const rnd = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const sorted = [...auditorias].sort((a, b) => {
    const toNum = (r: string) => { const [m, y] = r.split('/'); return parseInt(y||'0')*100+parseInt(m||'0'); };
    return toNum(a.mesReferencia) - toNum(b.mesReferencia);
  });

  const empresa = sorted[0]?.nomeEmpresa ?? '';
  const cnpjEmpresa = useCnpjPorNome(empresa);
  const periodoInicio = sorted[0]?.mesReferencia ?? '';
  const periodoFim = sorted[sorted.length - 1]?.mesReferencia ?? '';
  const periodo = periodoInicio === periodoFim ? periodoInicio : `${periodoInicio} a ${periodoFim}`;

  // Resultado da sistemática de panificação no período (enquadramento real, apurado no semestre)
  const totalQuestorTrigo = rnd(sorted.reduce((acc, a) => acc + (a.trigoQuestorTotal ?? 0), 0));
  const totalSelectedTrigo = rnd(sorted.reduce((acc, a) => acc + (a.trigoSelectedTotal ?? 0), 0));
  const totalPctTrigo = totalQuestorTrigo > 0 ? (totalSelectedTrigo / totalQuestorTrigo) * 100 : null;
  const totalOkTrigo = totalPctTrigo !== null && totalPctTrigo >= 7;
  const faltaPontosTotal = totalPctTrigo !== null && totalPctTrigo < 7 ? rnd(7 - totalPctTrigo) : 0;

  // Totais consolidados
  const totalSimples = rnd(sorted.reduce((acc, a) => {
    const ativos = a.fornecedores.filter(f => !f.descartado);
    return acc + ativos.reduce((s, f) => s + f.icmsPago, 0);
  }, 0));
  const totalProjetado = rnd(sorted.reduce((acc, a) => {
    const ativos = a.fornecedores.filter(f => !f.descartado);
    return acc + ativos.reduce((s, f) => s + f.icmsProjetado, 0);
  }, 0));
  const totalEconomia = rnd(sorted.reduce((acc, a) => {
    const ativos = a.fornecedores.filter(f => !f.descartado);
    return acc + ativos.reduce((s, f) => s + f.economia, 0);
  }, 0));
  const totalNormal = rnd(sorted.reduce((acc, a) => {
    const normalRow = (a.summaryTable ?? []).find(r =>
      r.label.toUpperCase() === 'NORMAL' ||
      (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO'))
    );
    return acc + (normalRow?.icmsAntecipado ?? 0);
  }, 0));
  const totalPagoReal = rnd(totalNormal + totalSimples);
  const totalProjetadoIdeal = rnd(totalNormal + totalProjetado);
  const totalDiff = rnd(totalPagoReal - totalProjetadoIdeal);

  const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  useEffect(() => {
    const originalTitle = document.title;

    // Monta label do período baseado na quantidade e posição dos meses
    const getPeriodoLabel = () => {
      const n = sorted.length;
      const ano = sorted[0]?.mesReferencia?.split('/')[1] ?? '';
      const primeiroMes = parseInt(sorted[0]?.mesReferencia?.split('/')[0] ?? '1');

      if (n === 6) {
        const sem = primeiroMes <= 6 ? '1º' : '2º';
        return `${sem} SEMESTRE ${ano}`;
      }
      if (n === 3) {
        const tri = Math.ceil(primeiroMes / 3);
        return `${tri}º TRIMESTRE ${ano}`;
      }
      if (n === 2) {
        const bi = Math.ceil(primeiroMes / 2);
        return `${bi}º BIMESTRE ${ano}`;
      }
      // Qualquer outra quantidade: usa o intervalo
      const fim = sorted[sorted.length - 1]?.mesReferencia ?? '';
      return sorted[0]?.mesReferencia === fim
        ? `${sorted[0]?.mesReferencia?.replace('/', '-')}`
        : `${sorted[0]?.mesReferencia?.replace('/', '-')} a ${fim.replace('/', '-')}`;
    };

    const tipoLabel = modo === 'trigo' ? 'SISTEMATICA PANIFICACAO CONSOLIDADO' : 'IMPACTO TRIBUTARIO CONSOLIDADO COMPRAS FOR SN';
    document.title = `${tipoLabel} - ${empresa} ${getPeriodoLabel()}`;

    let t: ReturnType<typeof setTimeout>;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        t = setTimeout(() => { window.print(); }, 800);
      });
    });
    const handleAfterPrint = () => { document.title = originalTitle; onDone(); };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', handleAfterPrint); document.title = originalTitle; };
  }, []);

  const contentIcms = (
    <div className="bg-[#EDEAE2] py-12 print:p-0 print:bg-white text-[#17150F] font-report">
      <div className="max-w-[210mm] mx-auto space-y-12 print:space-y-0 shadow-2xl print:shadow-none">

        {/* Capa */}
        <div className="min-h-[297mm] bg-[#17150F] text-[#FCFBF8] flex flex-col justify-between p-16 break-after-page">
          <div className="flex items-start justify-between">
            <img src="/logo-white.png" alt="Contador de Padarias" className="h-10 w-auto" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#CFC9BE]">Relatório Estratégico Tributário Consolidado</p>
          </div>
          <div className="space-y-3 max-w-2xl">
            <h1 className="font-display text-[46px] leading-[1.08]">Impacto</h1>
            <h1 className="font-display text-[46px] leading-[1.08]">Tributário</h1>
            <h1 className="font-display italic text-[46px] leading-[1.08]" style={{ color: GOLD_LIGHT }}>Consolidado</h1>
            <p className="font-display italic text-xl text-[#E7C453] mt-6 pb-4 border-b border-white/15 inline-block max-w-lg leading-snug">
              nas Compras de Fornecedores do Simples Nacional
            </p>
            <p className="text-base text-[#CFC9BE] font-medium mt-2">Período: {periodo}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-[#CFC9BE]">
              Análise estratégica para empresa <span className="text-[#FCFBF8] font-semibold">{empresa}</span>
            </p>
          </div>
        </div>

        {/* Introdução */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-16 flex flex-col justify-center break-after-page">
          <p className="font-display italic text-2xl text-[#5E594F] mb-10">Prezado(a) cliente,</p>
          <div className="space-y-7 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>
              Apresentamos o relatório consolidado referente ao período de <span className="font-semibold text-[#17150F]">{periodo}</span>, contemplando {sorted.length} {sorted.length === 1 ? 'mês' : 'meses'} de apuração.
            </p>
            <p>
              Quando sua empresa adquire produtos tributados de ICMS de fornecedores do Simples Nacional no estado de Pernambuco, a carga tributária média do ICMS aumenta de{' '}
              <span className="font-semibold text-[#17150F]">5,5% para 25,5%</span>, devido à sistemática de panificação à qual sua empresa é optante.
            </p>
            <p>
              No período analisado, o total de ICMS gerado pelas compras do Simples Nacional foi de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalSimples)}</span>, enquanto o valor projetado caso fossem fornecedores do Regime Normal seria de apenas{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalProjetado)}</span>.
            </p>
            <div className="bg-[#17150F] p-8 max-w-md">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#CFC9BE] mb-2">Economia potencial total</p>
              <p className="font-display italic text-[32px] leading-none" style={{ color: GOLD_LIGHT }}>{fmtBRL(totalDiff)}</p>
              <p className="text-[13px] text-[#CFC9BE] mt-3">{sorted.length} meses analisados</p>
            </div>
          </div>
        </div>

        {/* Resumo por mês */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-14 break-after-page">
          <h2 className="font-display text-2xl text-[#17150F] mb-6">Resumo por Mês</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#17150F]">
                <th className={thCls}>Mês</th>
                <th className={thClsRight}>ICMS Pago (Simples)</th>
                <th className={thClsRight}>ICMS Projetado</th>
                <th className={thClsRight}>Teria Economizado</th>
                <th className="py-3 pl-3 text-center text-[10px] uppercase tracking-wider text-[#78736A] font-medium">% Trigo</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, idx) => {
                const ativos = a.fornecedores.filter(f => !f.descartado);
                const eco = rnd(ativos.reduce((s, f) => s + f.economia, 0));
                const pago = rnd(ativos.reduce((s, f) => s + f.icmsPago, 0));
                const proj = rnd(ativos.reduce((s, f) => s + f.icmsProjetado, 0));
                const pct = a.percentualSistematica;
                return (
                  <tr key={a.id} className={rowCls(idx)}>
                    <td className="py-3 pr-3 font-medium text-[#17150F]">{a.mesReferencia}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[#17150F]">{fmtBRL(pago)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[#5E594F]">{fmtBRL(proj)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums font-semibold" style={{ color: GOLD }}>{fmtBRL(eco)}</td>
                    <td className="py-3 pl-3 text-center tabular-nums">
                      {pct !== null && pct !== undefined
                        ? <span className="font-bold" style={{ color: pct >= 7 ? POSITIVE : NEGATIVE }}>{pct.toFixed(2).replace('.', ',')}%</span>
                        : <span className="text-[#A29C92]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#17150F] font-semibold text-[12px]">
                <td className="py-4 pr-3 uppercase tracking-wide text-[10px] text-[#5E594F]">TOTAL / MÉDIA</td>
                <td className="py-4 pr-3 text-right tabular-nums">{fmtBRL(totalSimples)}</td>
                <td className="py-4 pr-3 text-right tabular-nums">{fmtBRL(totalProjetado)}</td>
                <td className="py-4 pr-3 text-right tabular-nums" style={{ color: GOLD }}>{fmtBRL(totalEconomia)}</td>
                <td className="py-4 pl-3 text-center tabular-nums">
                  {(() => {
                    const totalQuestorAll = sorted.reduce((acc, a) => acc + (a.trigoQuestorTotal ?? 0), 0);
                    const totalSelectedAll = sorted.reduce((acc, a) => acc + (a.trigoSelectedTotal ?? 0), 0);
                    if (!totalQuestorAll) return <span className="text-[#A29C92]">—</span>;
                    const media = rnd((totalSelectedAll / totalQuestorAll) * 100);
                    return <span className="font-bold" style={{ color: media >= 7 ? POSITIVE : NEGATIVE }}>{media.toFixed(2).replace('.', ',')}%</span>;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalhe por mês */}
        {sorted.map(a => {
          const ativos = a.fornecedores.filter(f => !f.descartado);
          const data: SimplesSupplierData[] = ativos.map(f => ({
            name: f.nome, productName: f.produto, productTotal: f.valorTotal,
            originalValue: f.icmsPago, newValue: f.icmsProjetado, economy: f.economia,
          }));
          return (
            <div key={a.id} className="bg-[#FCFBF8] p-14 break-after-page">
              <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-[#17150F]">
                <h2 className="font-display text-xl text-[#17150F]">{a.mesReferencia}</h2>
                <span className="text-[13px] text-[#78736A]">Fornecedores do Simples Nacional</span>
                {a.percentualSistematica !== null && a.percentualSistematica !== undefined && (
                  <span
                    className="ml-auto text-[13px] font-bold"
                    style={{ color: a.regra7pctAtendida ? POSITIVE : NEGATIVE }}
                  >
                    {a.percentualSistematica.toFixed(2).replace('.', ',')}%
                  </span>
                )}
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#17150F]">
                    <th className={thCls}>Fornecedor</th>
                    <th className={thCls}>Produto</th>
                    <th className={thClsRight}>Valor Total</th>
                    <th className={thClsRight}>ICMS Pago</th>
                    <th className={thClsRight}>ICMS Projetado</th>
                    <th className={thClsRight}>Economia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx} className={rowCls(idx)}>
                      <td className="py-2 pr-3 font-medium text-[#17150F]">{item.name}</td>
                      <td className="py-2 pr-3 text-[#5E594F]">{item.productName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[#5E594F]">{fmtBRL(item.productTotal)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium text-[#17150F]">{fmtBRL(item.originalValue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium" style={{ color: GOLD }}>{fmtBRL(item.newValue)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums font-semibold text-[#17150F]">{fmtBRL(item.economy)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#17150F] font-semibold text-[11px]">
                    <td colSpan={2} className="py-3 pr-3 text-right uppercase tracking-wide text-[10px] text-[#5E594F]">Total {a.mesReferencia}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{fmtBRL(data.reduce((s,i)=>s+i.productTotal,0))}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{fmtBRL(data.reduce((s,i)=>s+i.originalValue,0))}</td>
                    <td className="py-3 pr-3 text-right tabular-nums" style={{ color: GOLD }}>{fmtBRL(data.reduce((s,i)=>s+i.newValue,0))}</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{fmtBRL(data.reduce((s,i)=>s+i.economy,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Conclusão consolidada */}
        <div className="min-h-[297mm] bg-[#FCFBF8] px-16 py-14 flex flex-col justify-center break-after-page">
          <h2 className="font-display text-2xl text-[#17150F] mb-8">Conclusão do Período</h2>
          <div className="space-y-6 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>
              No período de <span className="font-semibold text-[#17150F]">{periodo}</span>, o ICMS gerado exclusivamente pelas compras de fornecedores do <span className="font-semibold text-[#17150F]">Simples Nacional</span> foi de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalSimples)}</span>.
            </p>
            <p>
              Se esses mesmos produtos tivessem sido adquiridos de fornecedores do <span className="font-semibold text-[#17150F]">Regime Normal</span>, o ICMS projetado seria de apenas{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalProjetado)}</span>.
            </p>
            <div className="bg-[#17150F] p-8 max-w-md">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#CFC9BE] mb-2">Diferença acumulada no período</p>
              <p className="font-display italic text-[32px] leading-none" style={{ color: GOLD_LIGHT }}>{fmtBRL(totalDiff)}</p>
              <p className="text-[13px] text-[#CFC9BE] mt-3">{sorted.length} {sorted.length === 1 ? 'mês analisado' : 'meses analisados'}</p>
            </div>
            <p>
              Considerando o cenário global da empresa, o valor total pago de ICMS (Normal + Simples Nacional) foi de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalPagoReal)}</span>, enquanto o valor ideal projetado seria de{' '}
              <span className="font-semibold text-[#17150F]">{fmtBRL(totalProjetadoIdeal)}</span>.
            </p>
            <p>
              Recomendamos a análise dos fornecedores listados e a busca por condições comerciais mais favoráveis, como descontos financeiros ou migração para fornecedores do Regime Normal.
            </p>
          </div>
        </div>

        {/* Encerramento */}
        <div className="min-h-[297mm] bg-[#FCFBF8] p-16 flex flex-col justify-center">
          <div className="space-y-8 text-[15px] leading-[1.8] text-[#5E594F] max-w-2xl">
            <p>Caso necessite de suporte adicional, estamos à disposição para fornecer orientações personalizadas e auxiliá-lo(a) na busca por soluções que otimizem sua gestão financeira.</p>
            <p>Agradecemos pela confiança em nossos serviços e estamos comprometidos em ajudá-lo(a) a alcançar a eficiência tributária e a lucratividade sustentável em seu negócio.</p>
            <div className="pt-16 flex items-center gap-4">
              <span className="inline-flex items-center bg-[#17150F] px-4 py-2">
                <img src="/logo-white.png" alt="Contador de Padarias" className="h-7 w-auto" />
              </span>
              <p className="font-display italic text-lg text-[#17150F]">Atenciosamente,</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  const contentTrigo = (
    <div className="print:block p-14 bg-[#FCFBF8] min-h-screen text-[#17150F] font-report">
      <div className="max-w-[210mm] mx-auto space-y-16">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#17150F] pb-6">
          <div>
            <h1 className="font-display text-[28px] text-[#17150F] leading-tight">
              Validação Técnica <span className="text-[#A29C92]">—</span>{' '}
              <span className="italic" style={{ color: GOLD }}>Sistemática de Panificação</span>
            </h1>
            <p className="text-[15px] font-semibold text-[#17150F] mt-1">
              {empresa}
              {cnpjEmpresa && <span className="text-[13px] font-normal text-[#78736A] ml-2">CNPJ {cnpjEmpresa}</span>}
            </p>
            <p className="text-[13px] text-[#5E594F] font-medium">Relatório consolidado · Período: {periodo} · {sorted.length} meses</p>
          </div>
          <span className="inline-flex items-center bg-[#17150F] px-4 py-2 shrink-0">
            <img src="/logo-white.png" alt="Contador de Padarias" className="h-7 w-auto" />
          </span>
        </div>

        {/* Resultado do semestre — enquadramento real */}
        <div className="pb-10 border-b border-[#E5E0D6]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-[#17150F] mb-2">Resultado da Regra dos 7% no Período:</p>
              <p className="font-display font-semibold text-[42px] leading-none tabular-nums" style={{ color: totalPctTrigo === null ? INK : totalOkTrigo ? POSITIVE : NEGATIVE }}>
                {totalPctTrigo !== null ? `${totalPctTrigo.toFixed(2).replace('.', ',')}%` : '—'}
              </p>
            </div>
            <div className="text-right">
              {totalPctTrigo !== null && (
                totalOkTrigo
                  ? <span className="font-display italic font-semibold text-[36px]" style={{ color: POSITIVE }}>APROVADO</span>
                  : <span className="font-display italic font-semibold text-[36px]" style={{ color: NEGATIVE }}>REPROVADO</span>
              )}
            </div>
          </div>
          {!totalOkTrigo && faltaPontosTotal > 0 && (
            <p className="text-[12px] text-[#5E594F] leading-relaxed mt-4">
              Faltaram <span className="font-semibold" style={{ color: NEGATIVE }}>{faltaPontosTotal.toFixed(2).replace('.', ',')} pontos percentuais</span> para atingir os 7% no período — o equivalente a aproximadamente{' '}
              <span className="font-semibold" style={{ color: NEGATIVE }}>{fmtBRL(rnd(totalQuestorTrigo * 0.07 - totalSelectedTrigo))}</span>{' '}
              a mais em compras de insumos de panificação, mantida a mesma base de compras do período.
            </p>
          )}
        </div>

        {/* Tabela resumo por mês */}
        <div>
          <h2 className="font-display text-xl text-[#17150F] mb-5">Resumo por Mês</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#17150F]">
                <th className={thCls}>Mês</th>
                <th className={thClsRight}>Total Compras</th>
                <th className={thClsRight}>Trigo Validado</th>
                <th className={thClsRight}>% Trigo</th>
                <th className={thClsRight}>Falta p/ Meta</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, idx) => {
                const pct = a.percentualSistematica;
                const temTrigo = a.trigoItens && a.trigoItens.length > 0;
                const faltaPontosMes = pct !== null && pct !== undefined && pct < 7 ? round(7 - pct) : 0;
                return (
                  <tr key={a.id} className={rowCls(idx)}>
                    <td className="py-3 pr-3 font-medium text-[#17150F]">{a.mesReferencia}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[#5E594F]">
                      {a.trigoQuestorTotal ? fmtBRL(a.trigoQuestorTotal) : <span className="text-[#A29C92]">—</span>}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums font-medium" style={{ color: GOLD }}>
                      {temTrigo ? fmtBRL(a.trigoSelectedTotal ?? 0) : <span className="text-[#A29C92]">—</span>}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {pct !== null && pct !== undefined
                        ? <span className="font-bold" style={{ color: pct >= 7 ? POSITIVE : NEGATIVE }}>{pct.toFixed(2).replace('.', ',')}%</span>
                        : <span className="text-[#A29C92]">—</span>}
                    </td>
                    <td className="py-3 pl-3 text-right tabular-nums">
                      {pct === null || pct === undefined
                        ? <span className="text-[#A29C92]">—</span>
                        : faltaPontosMes > 0
                          ? <span className="font-medium" style={{ color: NEGATIVE }}>{faltaPontosMes.toFixed(2).replace('.', ',')} p.p.</span>
                          : <span className="text-[#A29C92]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#17150F] font-semibold text-[12px]">
                <td className="py-4 pr-3 uppercase tracking-wide text-[10px] text-[#5E594F]">TOTAL</td>
                <td className="py-4 pr-3 text-right tabular-nums">{totalQuestorTrigo > 0 ? fmtBRL(totalQuestorTrigo) : <span className="text-[#A29C92]">—</span>}</td>
                <td className="py-4 pr-3 text-right tabular-nums" style={{ color: GOLD }}>{totalSelectedTrigo > 0 ? fmtBRL(totalSelectedTrigo) : <span className="text-[#A29C92]">—</span>}</td>
                <td className="py-4 pr-3 text-right tabular-nums">
                  {totalPctTrigo !== null
                    ? <span className="font-bold" style={{ color: totalOkTrigo ? POSITIVE : NEGATIVE }}>{totalPctTrigo.toFixed(2).replace('.', ',')}%</span>
                    : <span className="text-[#A29C92]">—</span>}
                </td>
                <td className="py-4 pl-3 text-right tabular-nums">
                  {totalPctTrigo === null
                    ? <span className="text-[#A29C92]">—</span>
                    : faltaPontosTotal > 0
                      ? <span className="font-bold" style={{ color: NEGATIVE }}>{faltaPontosTotal.toFixed(2).replace('.', ',')} p.p.</span>
                      : <span className="text-[#A29C92]">—</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalhe por mês */}
        {sorted.map(a => {
          const itens = a.trigoItens ?? [];
          if (itens.length === 0) return null;
          return (
            <div key={a.id} className="break-inside-avoid">
              <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-[#E5E0D6]">
                <h3 className="font-display text-lg text-[#17150F]">{a.mesReferencia}</h3>
                {a.percentualSistematica !== null && a.percentualSistematica !== undefined && (
                  <span className="text-[13px] font-bold" style={{ color: a.regra7pctAtendida ? POSITIVE : NEGATIVE }}>
                    {a.percentualSistematica.toFixed(2).replace('.', ',')}%
                  </span>
                )}
              </div>
              <div className="flex gap-10 mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#78736A] font-medium mb-1">Total Compras</p>
                  <p className="font-display text-xl text-[#17150F] tabular-nums">{a.trigoQuestorTotal ? fmtBRL(a.trigoQuestorTotal) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium mb-1" style={{ color: GOLD }}>Trigo Validado</p>
                  <p className="font-display text-xl tabular-nums" style={{ color: GOLD }}>{fmtBRL(a.trigoSelectedTotal ?? 0)}</p>
                </div>
              </div>
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[#17150F]">
                    <th className={thCls}>Produto</th>
                    <th className={thCls}>Fornecedor</th>
                    <th className={thClsRight}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, i) => (
                    <tr key={i} className="border-b border-[#EFEBE3]">
                      <td className="py-2 pr-3 font-medium text-[#17150F]">
                        {item.description}
                        {item.ncm && <span className="font-normal text-[#A29C92] ml-2">NCM: {item.ncm}</span>}
                      </td>
                      <td className="py-2 pr-3 text-[#5E594F]">{item.supplier}</td>
                      <td className="py-2 pl-3 text-right tabular-nums font-medium text-[#17150F]">{fmtBRL(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

      </div>
    </div>
  );

  const content = (
    <>
      <style>{`
        @media print {
          body > *:not(#print-overlay-root) { display: none !important; }
          #print-overlay-root { display: block !important; position: static !important; overflow: visible !important; }
        }
      `}</style>
      <div id="print-overlay-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'white', overflowY: 'auto' }}>
        <button
          onClick={onDone}
          className="print:hidden font-report"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, background: INK, color: '#FCFBF8', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}
        >
          ✕ Fechar prévia
        </button>
        {modo === 'icms' ? contentIcms : contentTrigo}
      </div>
    </>
  );

  return createPortal(content, document.body);
}

// ─── OVERLAY DE IMPRESSÃO (usado no DetalheAuditoria) ────────────────────────
interface PrintOverlayProps {
  auditoria: AuditoriaSalva;
  modo: 'icms' | 'trigo';
  onDone: () => void;
  incluirTrigo?: boolean;
}

export function PrintOverlay({ auditoria, modo, onDone, incluirTrigo = true }: PrintOverlayProps) {
  const cnpjEmpresa = useCnpjPorNome(auditoria.nomeEmpresa);

  // monta dados de fornecedores ativos → formato SimplesSupplierData
  const rnd = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const ativos = auditoria.fornecedores.filter(f => !f.descartado);
  const data: SimplesSupplierData[] = ativos.map(f => ({
    name: f.nome,
    productName: f.produto,
    productTotal: f.valorTotal,
    originalValue: f.icmsPago,
    newValue: f.icmsProjetado,
    economy: f.economia,
  }));

  // Recalcula summaryTable com base nos fornecedores ATIVOS (após descartes)
  const originalTable: SummaryRowSalvo[] = auditoria.summaryTable ?? [];
  const normalRow = originalTable.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')));
  const totalSimplesAtivo = rnd(ativos.reduce((a, f) => a + f.icmsPago, 0));
  const totalSimplesValor = rnd(ativos.reduce((a, f) => a + f.valorTotal, 0));
  const totalProjetadoAtivo = rnd(ativos.reduce((a, f) => a + f.icmsProjetado, 0));
  const totalNormalIcms = normalRow?.icmsAntecipado ?? 0;
  const totalNormalValor = normalRow?.valorTotal ?? 0;
  const origPagoRow = originalTable.find(r => r.label.includes('Real'));
  const totalPagoReal = origPagoRow ? origPagoRow.icmsAntecipado : rnd(totalNormalIcms + totalSimplesAtivo);
  const totalPagoValor = origPagoRow ? origPagoRow.valorTotal : rnd(totalNormalValor + totalSimplesValor);
  const totalProjetadoIdeal = rnd(totalPagoReal - totalSimplesAtivo + totalProjetadoAtivo);

  const summaryTable: SummaryRowSalvo[] = [
    ...(normalRow ? [normalRow] : []),
    { label: 'Simples Nacional', valorTotal: totalSimplesValor, icmsAntecipado: totalSimplesAtivo },
    { label: 'Projeção (Normal)', valorTotal: totalSimplesValor, icmsAntecipado: totalProjetadoAtivo },
    { label: 'Total ICMS Pago (Real)', valorTotal: totalPagoValor, icmsAntecipado: totalPagoReal },
    { label: 'Total ICMS Projetado (Cenário Ideal)', valorTotal: totalPagoValor, icmsAntecipado: totalProjetadoIdeal },
    { label: 'Diferença (Economia)', valorTotal: 0, icmsAntecipado: rnd(totalPagoReal - totalProjetadoIdeal) },
  ];

  const wheatForIcms = incluirTrigo && auditoria.trigoItens && auditoria.trigoItens.length > 0
    ? {
        isConfirmed: true,
        questorTotal: auditoria.trigoQuestorTotal,
        selectedTotal: auditoria.trigoSelectedTotal ?? 0,
        isOk: auditoria.regra7pctAtendida ?? false,
        percentage: auditoria.percentualSistematica,
        selectedItems: auditoria.trigoItens,
      }
    : undefined;

  const wheatForTrigo = auditoria.trigoItens && auditoria.trigoItens.length > 0
    ? {
        questorTotal: auditoria.trigoQuestorTotal ?? null,
        selectedTotal: auditoria.trigoSelectedTotal ?? 0,
        isOk: auditoria.regra7pctAtendida ?? false,
        percentage: auditoria.percentualSistematica,
        selectedItems: auditoria.trigoItens,
      }
    : null;

  useEffect(() => {
    const mes = auditoria.mesReferencia?.replace('/', '-') ?? '';
    const empresa = auditoria.nomeEmpresa ?? '';
    const tipoLabel = modo === 'trigo' ? 'SISTEMATICA PANIFICACAO' : 'IMPACTO TRIBUTARIO COMPRAS FOR SN';
    const originalTitle = document.title;
    document.title = `${tipoLabel} - ${empresa} ${mes}`;

    let t: ReturnType<typeof setTimeout>;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        t = setTimeout(() => {
          window.print();
        }, 800);
      });
    });

    const handleAfterPrint = () => { document.title = originalTitle; onDone(); };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.title = originalTitle;
    };
  }, []);

  const content = (
    <>
      {/* CSS inline: esconde tudo EXCETO o overlay durante impressão.
          O overlay é portado direto para body, então body > #print-overlay-root funciona. */}
      <style>{`
        @media print {
          body > *:not(#print-overlay-root) { display: none !important; }
          #print-overlay-root { display: block !important; position: static !important; overflow: visible !important; }
        }
      `}</style>

      <div
        id="print-overlay-root"
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'white', overflowY: 'auto' }}
      >
        {/* botão fechar — some na impressão */}
        <button
          onClick={onDone}
          className="print:hidden font-report"
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10000,
            background: INK, color: '#FCFBF8', fontSize: 12,
            fontWeight: 600, padding: '8px 16px', borderRadius: 4,
            border: 'none', cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          ✕ Fechar prévia
        </button>

        {modo === 'icms' && (
          <PrintableIcmsReport
            data={data}
            summaryTable={summaryTable}
            fileName={auditoria.nomeEmpresa}
            mes={auditoria.mesReferencia}
            wheatPrintData={wheatForIcms}
          />
        )}

        {modo === 'trigo' && wheatForTrigo && (
          <PrintableTrigoReport
            nomeEmpresa={auditoria.nomeEmpresa}
            cnpj={cnpjEmpresa}
            mesReferencia={auditoria.mesReferencia}
            wheatPrintData={wheatForTrigo}
          />
        )}
      </div>
    </>
  );

  // Portal: renderiza como filho direto de body para o CSS @media print funcionar
  return createPortal(content, document.body);
}
