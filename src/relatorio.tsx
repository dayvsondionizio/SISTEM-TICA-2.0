import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import type { AuditoriaSalva, SummaryRowSalvo } from './storage';

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

// ─── RELATÓRIO ICMS (idêntico ao PrintableReport de App.tsx) ─────────────────
interface IcmsReportProps {
  data: SimplesSupplierData[];
  summaryTable: SummaryRowSalvo[];
  fileName: string;
  wheatPrintData?: any;
}

export function PrintableIcmsReport({ data, summaryTable, fileName, wheatPrintData }: IcmsReportProps) {
  const dateStr     = new Date().toLocaleDateString('pt-BR');
  const companyName = fileName.replace('AUDITORIA_', '').split('.')[0].replace(/_/g, ' ').toUpperCase();

  const totalSimples    = round(summaryTable.find(r => r.label.toUpperCase().includes('SIMPLES NACIONAL'))?.icmsAntecipado || 0);
  const totalNormal     = round(summaryTable.find(r =>
    r.label.toUpperCase() === 'NORMAL' ||
    (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO'))
  )?.icmsAntecipado || 0);
  const totalProjected  = round(summaryTable.find(r => r.label.includes('Projeção (Normal)'))?.icmsAntecipado || 0);
  const totalPagoReal   = round(totalNormal + totalSimples);
  const totalProjetadoIdeal = round(totalNormal + totalProjected);
  const totalDiff       = round(totalPagoReal - totalProjetadoIdeal);

  return (
    <div className="bg-slate-200 py-12 print:p-0 print:bg-white text-slate-900 font-sans">
      <div className="max-w-[210mm] mx-auto space-y-12 print:space-y-0 shadow-2xl print:shadow-none">

        {/* Página 1: Capa */}
        <div className="min-h-[297mm] bg-[#001F3F] text-white flex flex-col justify-between p-20 relative overflow-hidden break-after-page">
          <div className="relative z-10">
            <div className="mt-40 space-y-4">
              <h1 className="text-[120px] font-black leading-[0.8] tracking-tighter">Impacto</h1>
              <h1 className="text-[120px] font-black leading-[0.8] tracking-tighter">Tributário</h1>
              <p className="text-2xl font-bold mt-12 border-b-2 border-white/20 pb-4 inline-block">
                nas Compras de Fornecedores do Simples Nacional
              </p>
            </div>
          </div>
          <div className="relative z-10 text-right">
            <p className="text-lg font-medium text-slate-300">
              Análise estratégica para empresa <span className="text-white font-bold">{companyName}</span>
            </p>
          </div>
        </div>

        {/* Página 2: Introdução */}
        <div className="min-h-[297mm] bg-white p-20 flex flex-col justify-center space-y-12 break-after-page">
          <p className="text-2xl font-medium text-slate-700">Prezado(a) cliente,</p>
          <div className="space-y-8 text-xl leading-relaxed text-slate-600">
            <p>
              Gostaríamos de compartilhar algumas informações importantes relacionadas aos fornecedores que você está adquirindo insumos ou mercadorias para revenda, os quais são optantes pelo regime tributário do Simples Nacional.
            </p>
            <p>
              Conforme mencionado anteriormente, quando sua empresa adquire produtos tributados de ICMS de fornecedores do Simples Nacional no estado de Pernambuco, a carga tributária média do ICMS aumenta de{' '}
              <span className="font-bold text-[#001F3F]">5,5% para 25,5%</span>, devido à sistemática de panificação à qual sua empresa é optante.
            </p>
            <p>
              Com base nessa informação, preparamos uma planilha contendo a lista dos fornecedores do Simples Nacional e os respectivos produtos tributados de ICMS que você está adquirindo. É importante ressaltar que o objetivo dessa lista é proporcionar uma maior transparência e auxiliá-lo(a) na análise das condições comerciais oferecidas pelos fornecedores.
            </p>
          </div>
        </div>

        {/* Página 3+: Tabela */}
        <div className="min-h-[297mm] bg-white p-10 break-after-page">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-[#334155] text-white">
                <th className="p-4 text-left uppercase tracking-wider border border-slate-200">Nome do Fornec do Simples Nacional</th>
                <th className="p-4 text-left uppercase tracking-wider border border-slate-200">Nome do Produto</th>
                <th className="p-4 text-right uppercase tracking-wider border border-slate-200">Valor Total Prod Período</th>
                <th className="p-4 text-right uppercase tracking-wider border border-slate-200">Valor do ICMS a Pagar</th>
                <th className="p-4 text-right uppercase tracking-wider border border-slate-200">Valor de ICMS que teria pago (Reg Normal)</th>
                <th className="p-4 text-right uppercase tracking-wider border border-slate-200">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="p-4 border border-slate-200 font-bold">{item.name}</td>
                  <td className="p-4 border border-slate-200">{item.productName}</td>
                  <td className="p-4 border border-slate-200 text-right">{fmtBRL(item.productTotal)}</td>
                  <td className="p-4 border border-slate-200 text-right bg-red-100 text-red-700 font-bold">{fmtBRL(item.originalValue)}</td>
                  <td className="p-4 border border-slate-200 text-right bg-emerald-100 text-emerald-700 font-bold">{fmtBRL(item.newValue)}</td>
                  <td className="p-4 border border-slate-200 text-right font-bold">{fmtBRL(item.economy)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black text-xs">
                <td colSpan={2} className="p-4 border border-slate-200 text-right uppercase">Total</td>
                <td className="p-4 border border-slate-200 text-right">{fmtBRL(data.reduce((a, b) => a + b.productTotal, 0))}</td>
                <td className="p-4 border border-slate-200 text-right">{fmtBRL(data.reduce((a, b) => a + b.originalValue, 0))}</td>
                <td className="p-4 border border-slate-200 text-right">{fmtBRL(data.reduce((a, b) => a + b.newValue, 0))}</td>
                <td className="p-4 border border-slate-200 text-right">{fmtBRL(data.reduce((a, b) => a + b.economy, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Página: Conclusão */}
        <div className="min-h-[297mm] bg-white px-20 py-10 flex flex-col justify-center space-y-8 break-after-page">
          <div className="space-y-6 text-xl leading-relaxed text-slate-600">
            <p>
              Ao adquirir produtos tributados de ICMS de fornecedores enquadrados no Simples Nacional (conforme tabela), o valor total de ICMS gerado foi de{' '}
              <span className="font-bold text-slate-900">{fmtBRL(totalSimples)}</span>.
            </p>
            <p>
              No entanto, se tivéssemos adquirido os mesmos produtos de fornecedores do Regime Normal de apuração, o ICMS seria de apenas{' '}
              <span className="font-bold text-slate-900">{fmtBRL(totalProjected)}</span>.
            </p>
            <p className="text-3xl font-black text-red-600">
              Isso destaca uma diferença notável de {fmtBRL(totalDiff)}.
            </p>
            <p>
              Considerando o cenário global da empresa, o valor total pago de ICMS (Normal + Simples Nacional) foi de{' '}
              <span className="font-bold text-slate-900">{fmtBRL(totalPagoReal)}</span>, enquanto o valor ideal projetado seria de{' '}
              <span className="font-bold text-slate-900">{fmtBRL(totalProjetadoIdeal)}</span>.
            </p>

            {wheatPrintData?.isConfirmed && (
              <p className="bg-[#001F3F]/5 text-slate-700 p-6 rounded-2xl border-l-4 border-emerald-500 font-medium break-inside-avoid">
                A título de Validação Técnica da Sistemática de Panificação, registramos um montante total de compras para comercialização de{' '}
                <span className="font-bold whitespace-nowrap text-slate-900">{fmtBRL(wheatPrintData.questorTotal || 0)}</span>, no qual identificamos{' '}
                <span className="font-bold whitespace-nowrap text-slate-900">{fmtBRL(wheatPrintData.selectedTotal)}</span> em aquisições validadas pelo analista como insumos de panificação (trigo/pré-misturas). Isso{' '}
                <span className="font-bold text-slate-900">{wheatPrintData.isOk ? 'atesta o cumprimento' : 'registra o não cumprimento'}</span> da regra dos 7%, alcançando o índice de{' '}
                <span className="font-bold font-mono text-emerald-700 text-2xl ml-2">
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
        <div className="min-h-[297mm] bg-white p-20 flex flex-col justify-center space-y-12">
          <div className="space-y-8 text-xl leading-relaxed text-slate-600">
            <p>
              Caso necessite de suporte adicional para entender os aspectos tributários e as possibilidades de negociação, estamos à disposição para fornecer orientações personalizadas e auxiliá-lo(a) na busca por soluções que otimizem sua gestão financeira.
            </p>
            <p>
              Agradecemos pela confiança em nossos serviços e estamos comprometidos em ajudá-lo(a) a alcançar a eficiência tributária e a lucratividade sustentável em seu negócio.
            </p>
            <div className="pt-20 break-inside-avoid">
              <p>Atenciosamente,</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── RELATÓRIO TRIGO (idêntico ao bloco wheat de App.tsx) ────────────────────
interface TrigoReportProps {
  wheatPrintData: {
    selectedTotal: number;
    questorTotal: number | null;
    isOk: boolean;
    percentage: number | null;
    selectedItems: { description: string; supplier: string; ncm?: string; value: number }[];
  };
}

export function PrintableTrigoReport({ wheatPrintData }: TrigoReportProps) {
  return (
    <div className="print:block p-10 bg-white min-h-screen text-slate-800">
      <div className="max-w-[210mm] mx-auto">
        <div className="border-b-4 border-amber-600 pb-6 mb-10 flex items-center gap-4">
          <span className="text-5xl">🌾</span>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Validação Técnica - Sistemática de Panificação</h1>
            <p className="text-lg text-slate-500 font-medium">Relatório de auditoria e verificação da regra dos 7%</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl mb-12 flex items-center justify-between">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-widest font-bold text-slate-400">Total Validado</p>
            <p className="text-4xl font-mono font-black text-amber-600">
              {fmtBRL(wheatPrintData.selectedTotal)}
            </p>
          </div>
          <div className="text-right space-y-4">
            <p className="text-sm uppercase tracking-widest font-bold text-slate-400">Total Compras Comercialização</p>
            <p className="text-4xl font-mono font-bold text-slate-800">
              {wheatPrintData.questorTotal ? fmtBRL(wheatPrintData.questorTotal) : 'Não informado'}
            </p>
          </div>
        </div>

        <div className={`p-8 border-l-8 rounded-r-2xl mb-12 flex items-center justify-between ${wheatPrintData.isOk ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-500'}`}>
          <div>
            <p className="text-xl font-bold text-slate-900 mb-2">Resultado da Regra dos 7%:</p>
            <p className={`text-4xl font-black ${wheatPrintData.isOk ? 'text-emerald-700' : 'text-red-700'}`}>
              {wheatPrintData.percentage ? `${wheatPrintData.percentage.toFixed(2).replace('.', ',')}%` : '0,00%'}
            </p>
          </div>
          <div className="text-6xl text-right font-black">
            {wheatPrintData.isOk
              ? <span className="text-emerald-500">APROVADO</span>
              : <span className="text-red-500">REPROVADO</span>}
          </div>
        </div>

        <h3 className="text-2xl font-bold bg-[#001F3F] text-white p-4 rounded-t-xl uppercase tracking-widest text-center mt-12">
          Itens Classificados como Panificação (Marcados com ✓)
        </h3>
        <table className="w-full text-left text-sm border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 uppercase tracking-widest text-xs font-bold text-slate-500">
              <th className="p-4 border-b">Descrição do Produto (NCM 1101/1901)</th>
              <th className="p-4 border-b">Fornecedor</th>
              <th className="p-4 border-b text-right">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {wheatPrintData.selectedItems.map((item, i) => (
              <tr key={i} className="border-b hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-800">
                  {item.description}
                  {item.ncm && <span className="font-normal text-slate-500 text-xs ml-2">NCM: {item.ncm}</span>}
                </td>
                <td className="p-4 text-slate-600 text-xs">{item.supplier}</td>
                <td className="p-4 text-right font-mono font-bold text-slate-900">{fmtBRL(item.value)}</td>
              </tr>
            ))}
            {wheatPrintData.selectedItems.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400 font-bold">Nenhum item marcado pelo analista.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-20 text-center text-xs text-slate-400 uppercase tracking-widest">
          Relatório gerado em {new Date().toLocaleString('pt-BR')} • Assinatura Eletrônica do Analista: _______________________________
        </div>
      </div>
    </div>
  );
}

// ─── OVERLAY DE IMPRESSÃO (usado no DetalheAuditoria) ────────────────────────
interface PrintOverlayProps {
  auditoria: AuditoriaSalva;
  modo: 'icms' | 'trigo';
  onDone: () => void;
}

export function PrintOverlay({ auditoria, modo, onDone }: PrintOverlayProps) {
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
  const totalPagoReal = rnd(totalNormalIcms + totalSimplesAtivo);
  const totalProjetadoIdeal = rnd(totalNormalIcms + totalProjetadoAtivo);

  const summaryTable: SummaryRowSalvo[] = [
    ...(normalRow ? [normalRow] : []),
    { label: 'Simples Nacional', valorTotal: totalSimplesValor, icmsAntecipado: totalSimplesAtivo },
    { label: 'Projeção (Normal)', valorTotal: totalSimplesValor, icmsAntecipado: totalProjetadoAtivo },
    { label: 'Total ICMS Pago (Real)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalPagoReal },
    { label: 'Total ICMS Projetado (Cenário Ideal)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalProjetadoIdeal },
    { label: 'Diferença (Economia)', valorTotal: 0, icmsAntecipado: rnd(totalPagoReal - totalProjetadoIdeal) },
  ];

  const wheatForIcms = auditoria.trigoItens && auditoria.trigoItens.length > 0
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
    // Aguarda 2 frames de pintura + 800ms para Tailwind aplicar estilos,
    // depois imprime. Usar rAF duplo garante que o DOM foi pintado.
    let t: ReturnType<typeof setTimeout>;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        t = setTimeout(() => {
          window.print();
          // onDone é chamado via afterprint para não fechar antes de salvar
        }, 800);
      });
    });

    const handleAfterPrint = () => onDone();
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handleAfterPrint);
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
          className="print:hidden"
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 10000,
            background: '#1e293b', color: 'white', fontSize: 12,
            fontWeight: 700, padding: '8px 16px', borderRadius: 12,
            border: 'none', cursor: 'pointer',
          }}
        >
          ✕ Fechar prévia
        </button>

        {modo === 'icms' && (
          <PrintableIcmsReport
            data={data}
            summaryTable={summaryTable}
            fileName={auditoria.nomeEmpresa}
            wheatPrintData={wheatForIcms}
          />
        )}

        {modo === 'trigo' && wheatForTrigo && (
          <PrintableTrigoReport wheatPrintData={wheatForTrigo} />
        )}
      </div>
    </>
  );

  // Portal: renderiza como filho direto de body para o CSS @media print funcionar
  return createPortal(content, document.body);
}
