/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Table as TableIcon,
  Calculator,
  ShieldCheck,
  ArrowRightLeft,
  LayoutDashboard,
  Building2,
  PieChart,
  Printer,
  FileText,
  History,
  Save,
  ChevronRight,
  Trash2,
  Clock,
  Layers,
  Plus,
  PlayCircle,
  XCircle as XCircleIcon,
  Edit3,
  Wheat,
  BarChart2
} from 'lucide-react';
import { ModalSalvar, TelaHistorico, DetalheAuditoria, type AuditoriaSalva, type FornecedorSalvo } from './historico';
import { TelaPainelGeral } from './painel';
import { PrintOverlay, PrintOverlayMulti } from './relatorio';
import { salvarAuditoria, carregarClientes, carregarHistorico, excluirAuditoria, salvarRascunho, carregarRascunhos, excluirRascunho, type Cliente, type RascunhoAuditoria, type BakeryItemSalvo } from './storage';
import { groqChat } from './groqClient';
import { ModalSalvarRascunho, EditorRascunho, CardRascunho } from './rascunho';
import { TelaClientes } from './clientes';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

interface SimplesSupplierData {
  name: string;
  productName?: string;
  originalValue: number;
  newValue: number;
  economy: number;
  productTotal: number;
}

interface SummaryRow {
  label: string;
  valorTotal: number;
  icmsAntecipado: number;
}

interface BakeryItem {
  rowIndex: number;
  description: string;
  supplier: string;
  value: number;
  ncm?: string;
  selected: boolean;
  aiConfidence: 'high' | 'medium' | 'low';
}

interface AuditSummary {
  totalEconomy: number;
  recordCount: number;
  inconsistencies: string[];
  simplesSuppliers: SimplesSupplierData[];
  summaryTable: SummaryRow[];
}

interface ProcessedData {
  workbook: XLSX.WorkBook;
  filteredWorkbook?: XLSX.WorkBook;
  summary: AuditSummary;
  fileName: string;
  allProducts?: { description: string; supplier: string; value: number; ncm?: string; rowIndex: number }[];
}

function PrintableReport({ data, summaryTable, fileName, isFullReport = false, wheatPrintData }: { data: SimplesSupplierData[], summaryTable: SummaryRow[], fileName: string, isFullReport?: boolean, wheatPrintData?: any }) {
  const limit = 300;
  const isLimited = !isFullReport && data.length > limit;
  const displayData = isLimited ? data.slice(0, limit) : data;
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
  const dateStr = new Date().toLocaleDateString('pt-BR');
  
  // Try to extract company name from fileName or summary
  const companyName = fileName.replace('AUDITORIA_', '').split('.')[0].replace(/_/g, ' ').toUpperCase();

  const totalSimples = round(summaryTable.find(r => r.label.toUpperCase().includes('SIMPLES NACIONAL'))?.icmsAntecipado || 0);
  const totalNormal = round(summaryTable.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')))?.icmsAntecipado || 0);
  const totalProjected = round(summaryTable.find(r => r.label.includes('Projeção (Normal)'))?.icmsAntecipado || 0);
  
  const totalPagoReal = round(totalNormal + totalSimples);
  const totalProjetadoIdeal = round(totalNormal + totalProjected);
  const totalDiff = round(totalPagoReal - totalProjetadoIdeal);

  return (
    <div className="bg-slate-200 py-12 print:p-0 print:bg-white text-slate-900 font-sans">
      <div className="max-w-[210mm] mx-auto space-y-12 print:space-y-0 shadow-2xl print:shadow-none">
        {/* Page 1: Cover */}
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

        {/* Page 2: Introduction */}
        <div className="min-h-[297mm] bg-white p-20 flex flex-col justify-center space-y-12 break-after-page">
        <p className="text-2xl font-medium text-slate-700">Prezado(a) cliente,</p>
        
        <div className="space-y-8 text-xl leading-relaxed text-slate-600">
          <p>
            Gostaríamos de compartilhar algumas informações importantes relacionadas aos fornecedores que você está adquirindo insumos ou mercadorias para revenda, os quais são optantes pelo regime tributário do Simples Nacional.
          </p>
          <p>
            Conforme mencionado anteriormente, quando sua empresa adquire produtos tributados de ICMS de fornecedores do Simples Nacional no estado de Pernambuco, a carga tributária média do ICMS aumenta de <span className="font-bold text-[#001F3F]">5,5% para 25,5%</span>, devido à sistemática de panificação à qual sua empresa é optante.
          </p>
          <p>
            Com base nessa informação, preparamos uma planilha contendo a lista dos fornecedores do Simples Nacional e os respectivos produtos tributados de ICMS que você está adquirindo. É importante ressaltar que o objetivo dessa lista é proporcionar uma maior transparência e auxiliá-lo(a) na análise das condições comerciais oferecidas pelos fornecedores.
          </p>
        </div>
      </div>

        {/* Page 3+: Data Table */}
        <div className="min-h-[297mm] bg-white p-10 break-after-page">
        {isLimited && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-8 print:hidden">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-700 font-medium">
                Esta é uma prévia do relatório (primeiras {limit} de {data.length} linhas). 
                O <strong>relatório completo</strong> será gerado automaticamente ao clicar em <strong>Imprimir Agora</strong> ou ao <strong>Baixar a Planilha</strong>.
              </p>
            </div>
          </div>
        )}
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
            {displayData.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="p-4 border border-slate-200 font-bold">{item.name}</td>
                <td className="p-4 border border-slate-200">{item.productName}</td>
                <td className="p-4 border border-slate-200 text-right">{formatCurrency(item.productTotal)}</td>
                <td className="p-4 border border-slate-200 text-right bg-red-100 text-red-700 font-bold">{formatCurrency(item.originalValue)}</td>
                <td className="p-4 border border-slate-200 text-right bg-emerald-100 text-emerald-700 font-bold">{formatCurrency(item.newValue)}</td>
                <td className="p-4 border border-slate-200 text-right font-bold">{formatCurrency(item.economy)}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-black text-xs">
              <td colSpan={2} className="p-4 border border-slate-200 text-right uppercase">Total</td>
              <td className="p-4 border border-slate-200 text-right">{formatCurrency(data.reduce((a, b) => a + b.productTotal, 0))}</td>
              <td className="p-4 border border-slate-200 text-right">{formatCurrency(data.reduce((a, b) => a + b.originalValue, 0))}</td>
              <td className="p-4 border border-slate-200 text-right">{formatCurrency(data.reduce((a, b) => a + b.newValue, 0))}</td>
              <td className="p-4 border border-slate-200 text-right">{formatCurrency(data.reduce((a, b) => a + b.economy, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

        {/* Page Conclusion */}
        <div className="min-h-[297mm] bg-white px-20 py-10 flex flex-col justify-center space-y-8 break-after-page">
          <div className="space-y-6 text-xl leading-relaxed text-slate-600">
            <p>
              Ao adquirir produtos tributados de ICMS de fornecedores enquadrados no Simples Nacional (conforme tabela), o valor total de ICMS gerado foi de <span className="font-bold text-slate-900">{formatCurrency(totalSimples)}</span>.
            </p>
            <p>
              No entanto, se tivéssemos adquirido os mesmos produtos de fornecedores do Regime Normal de apuração, o ICMS seria de apenas <span className="font-bold text-slate-900">{formatCurrency(totalProjected)}</span>.
            </p>
            <p className="text-3xl font-black text-red-600">
              Isso destaca uma diferença notável de {formatCurrency(totalDiff)}.
            </p>
            <p>
              Considerando o cenário global da empresa, o valor total pago de ICMS (Normal + Simples Nacional) foi de <span className="font-bold text-slate-900">{formatCurrency(totalPagoReal)}</span>, enquanto o valor ideal projetado seria de <span className="font-bold text-slate-900">{formatCurrency(totalProjetadoIdeal)}</span>.
            </p>

            {wheatPrintData?.isConfirmed && (
               <p className="bg-[#001F3F]/5 text-slate-700 p-6 rounded-2xl border-l-4 border-emerald-500 font-medium break-inside-avoid">
                  A título de Validação Técnica da Sistemática de Panificação, registramos um montante total de compras para comercialização de <span className="font-bold whitespace-nowrap text-slate-900">{formatCurrency(wheatPrintData.questorTotal || 0)}</span>, no qual identificamos <span className="font-bold whitespace-nowrap text-slate-900">{formatCurrency(wheatPrintData.selectedTotal)}</span> em aquisições validadas pelo analista como insumos de panificação (trigo/pré-misturas). Isso <span className="font-bold text-slate-900">{wheatPrintData.isOk ? 'atesta o cumprimento' : 'registra o não cumprimento'}</span> da regra dos 7%, alcançando o índice de <span className="font-bold font-mono text-emerald-700 text-2xl ml-2">{wheatPrintData.percentage ? wheatPrintData.percentage.toFixed(2).replace('.', ',') : '0,00'}%</span>.
               </p>
            )}

            <p>
              Recomendamos que você verifique cuidadosamente os produtos listados na planilha e considere a possibilidade de negociar melhores condições com seus fornecedores. É possível que, ao estabelecer uma comunicação clara e transparente, seja viável obter descontos financeiros no boleto ou outras vantagens que possam equilibrar as contas e evitar uma operação onerosa.
            </p>
          </div>
        </div>

        {/* Page Closing */}
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

function SimplesDashboard({ data, summaryTable, fileName, descartados, onToggleDescartar }: { data: SimplesSupplierData[], summaryTable: SummaryRow[], fileName: string, descartados?: Set<number>, onToggleDescartar?: (idx: number) => void }) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  // Recalcula summaryTable dinamicamente se houver descartes
  const ativos = descartados && descartados.size > 0
    ? data.filter((_, i) => !descartados.has(i))
    : data;

  const displaySummaryTable = React.useMemo(() => {
    if (!descartados || descartados.size === 0) return summaryTable;
    const normalRow = summaryTable.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')));
    const totalSimplesIcms = round(ativos.reduce((a, s) => a + s.originalValue, 0));
    const totalSimplesValor = round(ativos.reduce((a, s) => a + s.productTotal, 0));
    const totalProjetado = round(ativos.reduce((a, s) => a + s.newValue, 0));
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
  }, [descartados, summaryTable, ativos]);

  return (
    <div className="mt-12 space-y-12 p-10 bg-white rounded-[3rem] border border-slate-200 shadow-2xl relative overflow-hidden print:overflow-visible">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
      
      {/* Premium Header */}
      <div className="relative pl-10 flex items-center justify-between">
        <div>
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#001F3F] rounded-full shadow-[0_0_15px_rgba(0,31,63,0.3)]" />
          <h3 className="text-5xl font-black text-[#001F3F] tracking-tight leading-tight">Relatório de Auditoria Comparativa</h3>
          <div className="flex items-center gap-4 mt-4">
            <div className="px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Certificado de Auditoria</span>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.4em]">
              Simples Nacional vs. Regime Normal
            </p>
          </div>
        </div>
      </div>

      {/* Summary Table from 3rd Tab - Premium Navy Style */}
      {displaySummaryTable.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,31,63,0.1)] overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-[#001F3F] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PieChart className="w-5 h-5 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-widest">Resumo Consolidado (Aba ICMS)</span>
            </div>
            <div className="px-3 py-1 bg-white/10 rounded-full">
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-tighter">Valores Arredondados (2 casas)</span>
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-4 text-[11px] font-bold text-slate-400 text-left uppercase tracking-widest">Tipo Fornecedor</th>
                <th className="px-8 py-4 text-[11px] font-bold text-slate-400 text-right uppercase tracking-widest">Soma de Valor Total</th>
                <th className="px-8 py-4 text-[11px] font-bold text-slate-400 text-right uppercase tracking-widest">Soma de ICMS Antecipado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySummaryTable.map((row, idx) => {
                const isProjection = row.label.includes('Projeção');
                const isDiff = row.label.includes('Diferença');
                const isTotal = row.label.includes('Total');
                
                return (
                  <tr key={idx} className={`transition-colors ${isDiff ? 'bg-emerald-50/50' : isProjection ? 'bg-blue-50/30' : isTotal ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50/50'}`}>
                    <td className={`px-8 py-5 text-sm ${isDiff || isProjection || isTotal ? 'font-bold text-[#001F3F]' : 'font-medium text-slate-700'}`}>
                      {row.label}
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-sm text-slate-500">
                      {row.valorTotal > 0 ? formatCurrency(round(row.valorTotal)) : '—'}
                    </td>
                    <td className={`px-8 py-5 text-right font-mono text-sm ${isDiff ? 'text-emerald-600 font-bold' : isProjection ? 'text-blue-600 font-bold' : isTotal ? 'text-[#001F3F] font-black' : 'text-slate-900'}`}>
                      {formatCurrency(round(row.icmsAntecipado))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de fornecedores com descarte */}
      {onToggleDescartar && data.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-[#001F3F] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TableIcon className="w-5 h-5 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-widest">Fornecedores Simples Nacional</span>
            </div>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">
              {descartados && descartados.size > 0 ? `${descartados.size} descartado(s)` : 'Passe o mouse para descartar'}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {data.map((item, idx) => {
              const isDescartado = descartados?.has(idx) ?? false;
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center gap-4 px-6 py-3 transition-all ${isDescartado ? 'opacity-40 bg-red-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isDescartado ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">{item.productName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-red-500">{formatCurrency(round(item.originalValue))}</p>
                    <p className="text-xs text-emerald-600">{formatCurrency(round(item.economy))} eco.</p>
                  </div>
                  {(hoveredIdx === idx || isDescartado) && (
                    <button
                      onClick={() => onToggleDescartar(idx)}
                      className={`flex-shrink-0 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all ${
                        isDescartado
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {isDescartado ? '↩ Restaurar' : '✕ Descartar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// =====================================================
// BAKERY PANEL COMPONENT (AUTO-TRIGGER, NCM-FILTERED)
// =====================================================
function BakeryPanel({ allProducts, questorTotal, onUpdatePrintData, onPrint, workbook, fileName }: { allProducts: ProcessedData['allProducts']; questorTotal: number | null; onUpdatePrintData?: (data: any) => void; onPrint?: () => void; workbook?: XLSX.WorkBook; fileName?: string }) {
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('groqApiKey') || '';
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [bakeryItems, setBakeryItems] = React.useState<BakeryItem[]>([]);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Auto-trigger analysis when allProducts is available
  React.useEffect(() => {
    if (allProducts && allProducts.length > 0 && !analyzed) {
      setAnalyzed(true);
      runAnalysis(allProducts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts]);

  React.useEffect(() => {
    const selectedItems = bakeryItems.filter(i => i.selected);
    const selectedTotal = selectedItems.reduce((acc, i) => acc + i.value, 0);
    const percentage = questorTotal && questorTotal > 0 ? (selectedTotal / questorTotal) * 100 : null;
    const isOk = percentage !== null && percentage >= 7;

    onUpdatePrintData?.({
      bakeryItems,
      selectedItems,
      selectedTotal,
      percentage,
      isOk,
      questorTotal,
      isConfirmed
    });
  }, [bakeryItems, questorTotal, onUpdatePrintData, isConfirmed]);

  const runAnalysis = async (products: NonNullable<ProcessedData['allProducts']>) => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const BATCH_SIZE = 50;
      const results: { index: number; shouldCount: boolean; confidence: 'high' | 'medium' | 'low'; reason: string }[] = [];

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const productList = batch.map((p, idx) =>
          `${i + idx}: ${p.description}${p.ncm ? ` [NCM: ${p.ncm}]` : ''} - Fornecedor: ${p.supplier}`
        ).join('\n');

        const prompt = `Você é um auditor fiscal especializado em panificação. Os produtos abaixo já foram pré-filtrados por NCM (1101.00.10 = farinha de trigo, 1901.20.00 = pré-misturas). Avalie cada item e recomende se deve ou não ser contado na sistemática de panificação para cálculo da regra dos 7%.\n\nRegras:\n- Contar: farinhas de trigo, pré-misturas, semolina, trigo em grão diretamente relacionados à panificação\n- Não contar: itens com NCM incorreto, produtos só de nome similar mas diferentes, ou que claramente não são insumo de panificação\n\nIMPORTANTE: Responda SOMENTE com JSON array sem texto adicional:\n[{"index":0,"shouldCount":true,"confidence":"high","reason":"Farinha de trigo tipo 1"}, ...]\n\nProdutos:\n${productList}`;

        const response = await groqChat({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 2000
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || `Erro Groq ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices[0].message.content.trim();
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          results.push(...JSON.parse(jsonMatch[0]));
        }
      }

      const items: BakeryItem[] = results.map(r => {
        const p = products[r.index];
        if (!p) return null;
        return {
          rowIndex: p.rowIndex,
          description: p.description,
          supplier: p.supplier,
          value: p.value,
          ncm: p.ncm,
          selected: r.shouldCount,
          aiConfidence: r.confidence
        };
      }).filter(Boolean) as BakeryItem[];

      setBakeryItems(items);
    } catch (err) {
      // IA indisponível (rate limit ou erro) → fallback: todos desmarcados para revisão manual
      const fallbackItems: BakeryItem[] = products.map(p => ({
        rowIndex: p.rowIndex,
        description: p.description,
        supplier: p.supplier,
        value: p.value,
        ncm: p.ncm,
        selected: false,
        aiConfidence: 'low' as const,
      }));
      setBakeryItems(fallbackItems);
      setAnalysisError('⚠️ IA indisponível (limite atingido) — itens carregados desmarcados. Marque manualmente e salve o rascunho.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadExcelHelper = (wb: XLSX.WorkBook, name: string) => {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const s2ab = (s: string) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    };
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name.endsWith('.xlsx') ? name : name + '.xlsx';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
  };

  // Excel Simples: apenas os itens marcados pelo analista
  const exportExcelSimples = () => {
    const selected = bakeryItems.filter(i => i.selected);
    if (selected.length === 0) return;
    const rows: any[][] = [
      ['Descrição', 'Fornecedor', 'NCM', 'Valor (R$)', 'Confiança IA', 'Status']
    ];
    selected.forEach(item => {
      rows.push([
        item.description,
        item.supplier,
        item.ncm || '',
        item.value,
        item.aiConfidence === 'high' ? 'Alta' : item.aiConfidence === 'medium' ? 'Média' : 'Baixa',
        'Validado pelo Analista'
      ]);
    });
    // Totalizador
    rows.push([]);
    rows.push(['TOTAL VALIDADO', '', '', selected.reduce((acc, i) => acc + i.value, 0), '', '']);
    if (questorTotal) {
      const pct = (selected.reduce((acc, i) => acc + i.value, 0) / questorTotal * 100).toFixed(2);
      rows.push(['Total Questor (Comercialização)', '', '', questorTotal, '', '']);
      rows.push([`Percentual da Sistemática`, '', '', `${pct}%`, '', '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 50 }, { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Itens Validados');
    const baseName = fileName ? fileName.replace('AUDITORIA_', '').replace('.xlsx', '') : 'export';
    downloadExcelHelper(wb, `SISTEMATICA_SIMPLES_${baseName}`);
  };

  // Excel Completo: planilha original da 1ª aba com coluna extra de marcação
  const exportExcelCompleto = () => {
    if (!workbook || !allProducts) return;
    const selectedRowIndexes = new Set(bakeryItems.filter(i => i.selected).map(i => i.rowIndex));
    const allRowIndexes = new Set(bakeryItems.map(i => i.rowIndex));
    const firstSheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    // Adiciona coluna de marcação
    const newData = data.map((row, i) => {
      if (i === 0) return [...row, 'SISTEMÁTICA PANIFICAÇÃO'];
      if (selectedRowIndexes.has(i)) return [...row, '✓ VALIDADO ANALISTA'];
      if (allRowIndexes.has(i)) return [...row, '— IDENTIFICADO / NÃO VALIDADO'];
      return [...row, ''];
    });
    const newWs = XLSX.utils.aoa_to_sheet(newData);
    const newWb = XLSX.utils.book_new();
    // Copia todas as abas originais
    workbook.SheetNames.forEach(name => {
      if (name === firstSheetName) {
        XLSX.utils.book_append_sheet(newWb, newWs, name);
      } else {
        XLSX.utils.book_append_sheet(newWb, workbook.Sheets[name], name);
      }
    });
    const baseName = fileName ? fileName.replace('AUDITORIA_', '').replace('.xlsx', '') : 'export';
    downloadExcelHelper(newWb, `SISTEMATICA_COMPLETO_${baseName}`);
  };

  const toggleItem = (idx: number) => {
    if (isConfirmed) return;
    setBakeryItems(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const selectedItems = bakeryItems.filter(i => i.selected);
  const selectedTotal = selectedItems.reduce((acc, i) => acc + i.value, 0);
  const percentage = questorTotal && questorTotal > 0 ? (selectedTotal / questorTotal) * 100 : null;
  const isOk = percentage !== null && percentage >= 7;

  const confidenceBadge = (c: BakeryItem['aiConfidence']) => {
    if (c === 'high') return <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">IA Alta</span>;
    if (c === 'medium') return <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">IA Média</span>;
    return <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">IA Baixa</span>;
  };

  // Removed early return to always show the panel
  // if (!allProducts || allProducts.length === 0) return null;

  return (
    <div className="bg-white border border-amber-200 rounded-3xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌾</span>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Sistemática de Panificação</h3>
              <p className="text-amber-100 text-sm">Itens NCM 1101.00.10 e 1901.20.00 — Classificação fiscal de farinha e pré-misturas</p>
            </div>
          </div>
          {bakeryItems.length > 0 && (
            <div className="text-right bg-white/10 rounded-2xl px-6 py-3">
              <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Selecionados</p>
              <p className="text-3xl font-black">{selectedItems.length}<span className="text-lg text-amber-200">/{bakeryItems.length}</span></p>
              <p className="text-amber-200 text-sm font-bold">{new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(selectedTotal)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Loading */}
        {isAnalyzing && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <span className="text-2xl animate-spin">⚙️</span>
            <div>
              <p className="font-bold text-amber-800">Analisando {allProducts.length} itens com IA...</p>
              <p className="text-sm text-amber-600">O Groq está verificando cada item. Aguarde.</p>
            </div>
          </div>
        )}

        {/* Error / Aviso IA indisponível */}
        {analysisError && (
          <div className={`border rounded-xl p-4 text-sm font-medium space-y-2 ${bakeryItems.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="font-bold">{analysisError}</p>
            {bakeryItems.length === 0 && (
              <button onClick={() => { setAnalyzed(false); }} className="text-xs underline text-red-600">Tentar novamente</button>
            )}
          </div>
        )}

        {/* Items Panel */}
        {bakeryItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Revisão do Analista — Clique para marcar/desmarcar</p>
              {!isConfirmed && (
                <div className="flex gap-3">
                  <button onClick={() => setBakeryItems(p => p.map(i => ({...i, selected: true})))} className="text-xs font-bold text-amber-700 hover:underline">Marcar todos</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setBakeryItems(p => p.map(i => ({...i, selected: false})))} className="text-xs font-bold text-gray-500 hover:underline">Desmarcar todos</button>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {bakeryItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  className={`flex items-center gap-4 p-4 rounded-xl border select-none transition-all ${
                    isConfirmed ? (item.selected ? 'bg-amber-100 border-amber-400 opacity-90' : 'bg-gray-100 border-gray-200 opacity-40') :
                    item.selected ? 'bg-amber-50 border-amber-300 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-60 cursor-pointer hover:bg-white hover:border-amber-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    item.selected ? 'bg-amber-600 border-amber-600' : 'border-gray-300 bg-white'
                  }`}>
                    {item.selected && <span className="text-white text-xs font-black">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{item.description}</p>
                    <p className="text-xs text-gray-400">{item.supplier}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {confidenceBadge(item.aiConfidence)}
                    {item.ncm && <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item.ncm}</span>}
                    <span className="text-sm font-bold text-gray-700 min-w-[90px] text-right">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7% Result */}
        {percentage !== null && (
          <div className={`rounded-2xl p-6 border-2 ${
            isOk ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className={`text-5xl font-black mb-1 ${isOk ? 'text-emerald-700' : 'text-red-700'}`}>
                  {percentage.toFixed(2).replace('.', ',')}%
                </p>
                <p className={`text-sm font-bold ${isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                  da sistemática no total de compras para comercialização
                </p>
              </div>
              <div className="flex items-center gap-6">
                {!isConfirmed ? (
                  <button onClick={() => setIsConfirmed(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 font-bold py-3 px-8 rounded-2xl flex items-center gap-2 transition-all transform hover:scale-105">
                    Confirmar Validação
                  </button>
                ) : (
                  <>
                    <button onClick={() => setIsConfirmed(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 shadow-md font-bold py-3 px-4 rounded-2xl flex items-center gap-2 transition-all text-sm">
                      Editar
                    </button>
                    <button onClick={onPrint} className="bg-amber-600 hover:bg-amber-700 text-white shadow-md font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all">
                      <Printer className="w-5 h-5" />
                      Imprimir Validação
                    </button>
                  </>
                )}
                <div className="text-5xl">{isOk ? '✅' : '❌'}</div>
              </div>
            </div>
            <div className="mt-4 bg-white/60 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Valor sistemática selecionado:</span><span className="font-bold">{formatCurrency(selectedTotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total compras Questor (comercialização):</span><span className="font-bold">{formatCurrency(questorTotal!)}</span></div>
              <div className={`flex justify-between font-bold pt-2 border-t border-gray-200 ${ isOk ? 'text-emerald-700' : 'text-red-700' }`}>
                <span>Regra dos 7%:</span>
                <span>{isOk
                  ? `✅ Atendida (${percentage.toFixed(2).replace('.', ',')}%)`
                  : `❌ NÃO Atendida — faltam ${formatCurrency(Math.max(0, (0.07 * questorTotal!) - selectedTotal))} para atingir 7%`
                }</span>
              </div>
            </div>
          </div>
        )}

        {/* Botões de exportação Excel */}
        {bakeryItems.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-amber-100">
            <p className="w-full text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Exportar para Excel</p>
            <button
              onClick={exportExcelSimples}
              disabled={bakeryItems.filter(i => i.selected).length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel Simples
              <span className="ml-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">{bakeryItems.filter(i => i.selected).length} itens</span>
            </button>
            <button
              onClick={exportExcelCompleto}
              disabled={!workbook || !allProducts}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#001F3F] hover:bg-[#002d5c] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow transition-all"
            >
              <Download className="w-4 h-4" />
              Excel Completo
              <span className="ml-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">planilha + marcação</span>
            </button>
          </div>
        )}

        {!isAnalyzing && bakeryItems.length === 0 && !analysisError && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-3">🌾</p>
            <p className="font-bold text-gray-600">Nenhum item com NCM 1101.00.10 ou 1901.20.00 encontrado na primeira aba.</p>
            <p className="text-sm mt-2">Verifique se a planilha contém a coluna NCM preenchida com os códigos de sistemática de panificação.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TELA HOME ────────────────────────────────────────────────────────────────
function TelaHome({ onSelectCliente, onOpenClientes, onOpenHistorico, onOpenPainel, reloadKey }: {
  onSelectCliente: (c: Cliente) => void;
  onOpenClientes: () => void;
  onOpenHistorico: () => void;
  onOpenPainel: () => void;
  reloadKey?: number;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rascunhosNomes, setRascunhosNomes] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  React.useEffect(() => { carregarClientes().then(setClientes); }, [reloadKey]);
  React.useEffect(() => {
    carregarRascunhos().then(lista => {
      setRascunhosNomes(new Set(lista.map(r => r.nomeEmpresa)));
    });
  }, [reloadKey]);

  const handleEditar = (e: React.MouseEvent, c: Cliente) => {
    e.stopPropagation();
    setEditandoId(c.id); setEditNome(c.nome); setEditCnpj(c.cnpj);
  };
  const handleSalvarEdicao = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nova = clientes.map(c => c.id === editandoId ? { ...c, nome: editNome.trim(), cnpj: editCnpj.trim() } : c);
    await (await import('./storage')).persistirClientes(nova);
    setClientes(nova); setEditandoId(null);
  };
  const handleExcluir = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await (await import('./storage')).excluirCliente(id);
    setClientes(prev => prev.filter(c => c.id !== id)); setConfirmDelete(null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001022 0%, #001F3F 50%, #002d5c 100%)' }}>

      {/* Header com botão Painel Geral */}
      <div className="h-8 relative">
        <button
          onClick={onOpenPainel}
          className="absolute top-3 right-6 flex items-center gap-2 bg-white/10 hover:bg-[#F5C000] border border-white/20 hover:border-[#F5C000] text-white hover:text-[#001F3F] text-xs font-bold px-4 py-2 rounded-xl transition-all group"
        >
          <BarChart2 className="w-4 h-4" />
          Painel Geral
        </button>
      </div>

      {/* Hero central com logo */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16">

        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <img
            src="/logo-white.png"
            alt="Contador de Padarias"
            className="h-28 w-auto object-contain drop-shadow-2xl"
          />
        </div>

        {/* Título do módulo */}
        <div className="text-center mb-12 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5C000]/10 border border-[#F5C000]/20 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F5C000]" />
            <span className="text-[10px] font-black text-[#F5C000] uppercase tracking-[0.3em]">Módulo ICMS · Sistemática de Panificação</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Para qual cliente vamos auditar?
          </h2>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Selecione um cliente cadastrado ou adicione um novo para iniciar a análise.
          </p>
        </div>

        {/* Grid de clientes */}
        {clientes.length === 0 ? (
          <div className="text-center py-8 space-y-6 max-w-sm">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8 text-white/30" />
            </div>
            <div>
              <p className="text-base font-bold text-white/70">Nenhum cliente cadastrado ainda.</p>
              <p className="text-white/30 text-sm mt-1">Cadastre seu primeiro cliente para começar.</p>
            </div>
            <button
              onClick={onOpenClientes}
              className="inline-flex items-center gap-2 bg-[#F5C000] hover:bg-[#e6b400] text-[#001F3F] font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-[#F5C000]/20 hover:scale-105"
            >
              <span className="text-lg">+</span>
              Cadastrar Primeiro Cliente
            </button>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientes.map(c => (
                <div
                  key={c.id}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#F5C000]/50 rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-2xl hover:shadow-[#F5C000]/10 hover:-translate-y-1 backdrop-blur-sm overflow-hidden cursor-pointer"
                  onClick={() => editandoId !== c.id && confirmDelete !== c.id && onSelectCliente(c)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#F5C000]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                  {editandoId === c.id ? (
                    /* Modo edição */
                    <div className="relative space-y-2" onClick={e => e.stopPropagation()}>
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm font-bold outline-none focus:border-[#F5C000]"
                        value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome"
                      />
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white/60 text-xs font-mono outline-none focus:border-[#F5C000]"
                        value={editCnpj} onChange={e => setEditCnpj(e.target.value)} placeholder="CNPJ (opcional)"
                      />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSalvarEdicao} className="flex-1 bg-[#F5C000] text-[#001F3F] text-xs font-black py-2 rounded-xl">Salvar</button>
                        <button onClick={e => { e.stopPropagation(); setEditandoId(null); }} className="flex-1 bg-white/10 text-white/60 text-xs font-bold py-2 rounded-xl">Cancelar</button>
                      </div>
                    </div>
                  ) : confirmDelete === c.id ? (
                    /* Confirmar exclusão */
                    <div className="relative space-y-3" onClick={e => e.stopPropagation()}>
                      <p className="text-white/80 text-sm font-bold">Excluir <span className="text-white">{c.nome}</span>?</p>
                      <p className="text-white/40 text-xs">Esta ação não pode ser desfeita.</p>
                      <div className="flex gap-2">
                        <button onClick={e => handleExcluir(e, c.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-black py-2 rounded-xl">Excluir</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }} className="flex-1 bg-white/10 text-white/60 text-xs font-bold py-2 rounded-xl">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    /* Visualização normal */
                    <>
                      <div className="relative flex items-start justify-between mb-4">
                        <div className="relative">
                          <div className="bg-white/10 group-hover:bg-[#F5C000] p-3 rounded-xl transition-all duration-200">
                            <Building2 className="w-5 h-5 text-white group-hover:text-[#001F3F] transition-colors duration-200" />
                          </div>
                          {rascunhosNomes.has(c.nome) && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#F5C000] rounded-full border-2 border-[#001F3F] shadow-lg shadow-[#F5C000]/50 animate-pulse" title="Rascunho pendente" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => handleEditar(e, c)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Editar">
                            <Edit3 className="w-3.5 h-3.5 text-white/60" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(c.id); }} className="p-1.5 bg-white/10 hover:bg-red-500/40 rounded-lg transition-colors" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5 text-white/60" />
                          </button>
                        </div>
                      </div>
                      <p className="relative font-black text-white text-base leading-tight truncate">{c.nome}</p>
                      {c.cnpj && <p className="relative text-xs text-white/30 font-mono mt-1">{c.cnpj}</p>}
                      <div className="relative mt-4 pt-4 border-t border-white/10">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-[#F5C000]/70 transition-colors">
                          Iniciar auditoria →
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Card novo cliente */}
              <button
                onClick={onOpenClientes}
                className="group bg-white/[0.03] hover:bg-[#F5C000]/10 border-2 border-dashed border-white/10 hover:border-[#F5C000]/40 rounded-2xl p-6 text-left transition-all duration-200 backdrop-blur-sm"
              >
                <div className="mb-4">
                  <div className="w-11 h-11 bg-white/10 group-hover:bg-[#F5C000] rounded-xl flex items-center justify-center transition-all duration-200">
                    <span className="text-xl text-white group-hover:text-[#001F3F] font-black leading-none transition-colors">+</span>
                  </div>
                </div>
                <p className="font-black text-white/40 group-hover:text-[#F5C000] text-base transition-colors">Novo Cliente</p>
                <p className="text-xs text-white/20 mt-1">Cadastrar empresa</p>
              </button>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={onOpenClientes}
                className="flex items-center gap-2 text-xs font-bold text-white/30 hover:text-white/60 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Gerenciar clientes cadastrados
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé com versão */}
      <footer className="relative z-10 text-center pb-6">
        <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold">
          Economia ICMS Sistemática · V3.0 · contadordepadaria.com.br
        </p>
      </footer>
    </div>
  );
}

// ─── DASHBOARD DO CLIENTE ─────────────────────────────────────────────────────
function DashboardCliente({ cliente, onNovaApuracao, onVoltar, onFinalizarRascunho }: {
  cliente: Cliente;
  onNovaApuracao: () => void;
  onVoltar: () => void;
  onFinalizarRascunho: (r: RascunhoAuditoria) => void;
}) {
  const [auditorias, setAuditorias] = useState<AuditoriaSalva[]>([]);
  const [rascunhos, setRascunhos] = useState<RascunhoAuditoria[]>([]);
  React.useEffect(() => {
    carregarHistorico().then(all => setAuditorias(all.filter(a => a.nomeEmpresa === cliente.nome)));
    carregarRascunhos().then(all => setRascunhos(all.filter(r => r.nomeEmpresa === cliente.nome)));
  }, [cliente.nome]);
  const [rascunhoAberto, setRascunhoAberto] = useState<RascunhoAuditoria | null>(null);
  const [rascunhoFinalizando, setRascunhoFinalizando] = useState<RascunhoAuditoria | null>(null);
  const [filtroAno, setFiltroAno] = useState<string | null>(String(new Date().getFullYear()));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [auditoriaSelecionada, setAuditoriaSelecionada] = useState<AuditoriaSalva | null>(null);
  const [dropdownDownloadId, setDropdownDownloadId] = useState<string | null>(null);
  const [printCardAuditoria, setPrintCardAuditoria] = useState<AuditoriaSalva | null>(null);
  const [printCardModo, setPrintCardModo] = useState<'icms' | 'trigo'>('icms');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [printMultiList, setPrintMultiList] = useState<AuditoriaSalva[] | null>(null);
  const [printMultiModo, setPrintMultiModo] = useState<'icms' | 'trigo'>('icms');

  const recarregar = () => {
    carregarHistorico().then(all => setAuditorias(all.filter(a => a.nomeEmpresa === cliente.nome)));
    carregarRascunhos().then(all => setRascunhos(all.filter(r => r.nomeEmpresa === cliente.nome)));
  };

  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const downloadExcel = (auditoria: AuditoriaSalva) => {
    const ativos = auditoria.fornecedores.filter(f => !f.descartado);
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
    link.download = `AUDITORIA_${cliente.nome.replace(/\s+/g,'_')}_${auditoria.mesReferencia.replace('/','_')}.xlsx`;
    document.body.appendChild(link); link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
  };

  const fmtXlsx = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const downloadExcelMulti = (lista: AuditoriaSalva[]) => {
    const wb = XLSX.utils.book_new();
    const sorted = [...lista].sort((a, b) => {
      const toNum = (r: string) => { const [m, y] = r.split('/'); return parseInt(y||'0')*100+parseInt(m||'0'); };
      return toNum(a.mesReferencia) - toNum(b.mesReferencia);
    });
    // Aba Resumo — apenas Mês, ICMS Pago, ICMS Projetado, Economia
    const resumoRows: any[][] = [
      ['Mês', 'ICMS Pago (Simples)', 'ICMS Projetado', 'Economia'],
      ...sorted.map(a => {
        const ativos = a.fornecedores.filter(f => !f.descartado);
        return [
          a.mesReferencia,
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.icmsPago,0))),
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.icmsProjetado,0))),
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.economia,0))),
        ];
      }),
      [],
      ['TOTAL', '', '',
        fmtXlsx(round(sorted.reduce((acc,a)=>acc+a.fornecedores.filter(f=>!f.descartado).reduce((s,f)=>s+f.economia,0),0)))],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo['!cols'] = [{wch:12},{wch:22},{wch:18},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    // Uma aba por mês
    sorted.forEach(a => {
      const ativos = a.fornecedores.filter(f => !f.descartado);
      const rows: any[][] = [
        ['Fornecedor', 'Produto', 'Valor Total', 'ICMS Pago', 'ICMS Projetado', 'Economia'],
        ...ativos.map(f => [f.nome, f.produto, fmtXlsx(f.valorTotal), fmtXlsx(f.icmsPago), fmtXlsx(f.icmsProjetado), fmtXlsx(f.economia)]),
        [],
        ['TOTAL','',
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.valorTotal,0))),
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.icmsPago,0))),
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.icmsProjetado,0))),
          fmtXlsx(round(ativos.reduce((s,f)=>s+f.economia,0)))],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{wch:40},{wch:40},{wch:16},{wch:16},{wch:18},{wch:16}];
      const nomeMes = a.mesReferencia.replace('/', '-');
      XLSX.utils.book_append_sheet(wb, ws, nomeMes.length > 31 ? nomeMes.slice(0,31) : nomeMes);
    });
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const s2ab = (s: string) => { const buf = new ArrayBuffer(s.length); const view = new Uint8Array(buf); for (let i=0;i<s.length;++i) view[i]=s.charCodeAt(i)&0xFF; return buf; };
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodoInicio = sorted[0]?.mesReferencia.replace('/','_') ?? '';
    const periodoFim = sorted[sorted.length-1]?.mesReferencia.replace('/','_') ?? '';
    link.download = `CONSOLIDADO_${cliente.nome.replace(/\s+/g,'_')}_${periodoInicio}_${periodoFim}.xlsx`;
    document.body.appendChild(link); link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
  };

  const economiaTotal = round(auditorias.reduce((acc, a) => {
    const ativos = a.fornecedores.filter(f => !f.descartado);
    return acc + ativos.reduce((s, f) => s + f.economia, 0);
  }, 0));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Dashboard */}
      <header className="bg-[#001F3F] border-b border-[#002d5c] py-4 px-8 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={onVoltar} title="Voltar" className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/10 transition-all">
            <ArrowRightLeft className="text-[#F5C000] w-5 h-5" />
          </button>
          <img src="/logo-white.png" alt="Contador de Padarias" className="h-9 w-auto object-contain" />
          <div className="border-l border-white/10 pl-4">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Cliente</p>
            <p className="text-sm font-black text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#F5C000]" />
              {cliente.nome}
              {cliente.cnpj && <span className="text-white/30 font-mono text-[10px]">· {cliente.cnpj}</span>}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full py-10 px-6 space-y-8">
        {/* KPIs do cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#001F3F] rounded-3xl p-7 text-white shadow-xl shadow-[#001F3F]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400 rounded-full blur-3xl opacity-10 -mr-8 -mt-8" />
            <p className="text-sky-200 text-[10px] font-bold uppercase tracking-widest mb-2">Economia Total Acumulada</p>
            <p className="text-4xl font-black tracking-tight">{fmt(economiaTotal)}</p>
            <p className="text-sky-300/60 text-xs mt-3 font-bold">{auditorias.length} apuração{auditorias.length !== 1 ? 'ões' : ''} salva{auditorias.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onNovaApuracao}
            className="group bg-white hover:bg-[#001F3F] border-2 border-dashed border-[#001F3F]/30 hover:border-[#001F3F] rounded-3xl p-7 flex flex-col items-start justify-between transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-[#001F3F]/20"
          >
            <div className="bg-[#001F3F]/10 group-hover:bg-white/20 p-3 rounded-2xl transition-all">
              <FileUp className="w-6 h-6 text-[#001F3F] group-hover:text-white transition-colors" />
            </div>
            <div>
              <p className="font-black text-[#001F3F] group-hover:text-white text-lg mt-4 transition-colors">Nova Apuração</p>
              <p className="text-xs text-slate-400 group-hover:text-white/60 transition-colors mt-0.5">Importar planilha de compras</p>
            </div>
          </button>
        </div>

        {/* Rascunhos em aberto */}
        {rascunhos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-black text-amber-600 uppercase tracking-tight">Rascunhos em Aberto</h3>
              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full">{rascunhos.length}</span>
            </div>
            <div className="space-y-2">
              {rascunhos.map(r => (
                <CardRascunho key={r.id} rascunho={r} onClick={() => setRascunhoAberto(r)} />
              ))}
            </div>
          </div>
        )}

        {/* Lista de apurações */}
        <div>
          {(() => {
            const anosUnicos = [...new Set(auditorias.map(a => a.mesReferencia.split('/')[1]).filter(Boolean))].sort().reverse();
            const auditoriasFiltradas = (filtroAno ? auditorias.filter(a => a.mesReferencia.endsWith(filtroAno)) : auditorias)
              .slice()
              .sort((a, b) => {
                const toNum = (ref: string) => { const [m, y] = ref.split('/'); return parseInt(y || '0') * 100 + parseInt(m || '0'); };
                return toNum(b.mesReferencia) - toNum(a.mesReferencia);
              });
            return (
              <>
                {anosUnicos.length > 1 && (
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setFiltroAno(null)}
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-full transition-colors ${filtroAno === null ? 'bg-[#001F3F] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Todos
                    </button>
                    {anosUnicos.map(ano => (
                      <button
                        key={ano}
                        onClick={() => setFiltroAno(ano)}
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full transition-colors ${filtroAno === ano ? 'bg-[#001F3F] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {ano}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Apurações Anteriores</h3>
                  <div className="flex items-center gap-2">
                    {auditorias.length >= 2 && !modoSelecao && (
                      <button
                        onClick={() => { setModoSelecao(true); setSelecionados(new Set()); }}
                        className="flex items-center gap-1.5 text-xs font-bold bg-[#001F3F]/8 hover:bg-[#001F3F] hover:text-white border border-[#001F3F]/20 hover:border-[#001F3F] text-[#001F3F] px-3 py-1.5 rounded-xl transition-all"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        Relatório de Período
                      </button>
                    )}
                    {modoSelecao && (
                      <button
                        onClick={() => { setModoSelecao(false); setSelecionados(new Set()); }}
                        className="text-xs font-bold text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all"
                      >
                        Cancelar seleção
                      </button>
                    )}
                    {auditorias.length > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full">{auditoriasFiltradas.length} registro{auditoriasFiltradas.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {(() => {
            const auditoriasFiltradas = (filtroAno ? auditorias.filter(a => a.mesReferencia.endsWith(filtroAno)) : auditorias)
              .slice()
              .sort((a, b) => {
                const toNum = (ref: string) => { const [m, y] = ref.split('/'); return parseInt(y || '0') * 100 + parseInt(m || '0'); };
                return toNum(b.mesReferencia) - toNum(a.mesReferencia);
              });
            return auditorias.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl py-16 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="font-bold text-slate-500">Nenhuma apuração salva ainda para este cliente.</p>
              <p className="text-sm text-slate-400">Clique em <strong>Nova Apuração</strong> para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditoriasFiltradas.map(a => {
                const ativos = a.fornecedores.filter(f => !f.descartado);
                const economiaAtiva = round(ativos.reduce((acc, f) => acc + f.economia, 0));
                const estaSelecionado = selecionados.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`bg-white border rounded-2xl p-5 flex items-center gap-5 transition-all cursor-default ${
                      modoSelecao
                        ? estaSelecionado
                          ? 'border-[#001F3F] shadow-md ring-2 ring-[#001F3F]/20'
                          : 'border-slate-200 hover:border-[#001F3F]/40 cursor-pointer'
                        : 'border-slate-200 hover:border-[#001F3F]/30 hover:shadow-sm'
                    }`}
                    onClick={modoSelecao ? () => setSelecionados(prev => {
                      const next = new Set(prev);
                      if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                      return next;
                    }) : undefined}
                  >
                    {/* Checkbox seleção */}
                    {modoSelecao && (
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${estaSelecionado ? 'bg-[#001F3F] border-[#001F3F]' : 'border-slate-300'}`}>
                        {estaSelecionado && <span className="text-white text-xs font-black">✓</span>}
                      </div>
                    )}
                    {/* Mês */}
                    <div className="bg-[#001F3F]/5 rounded-2xl px-5 py-4 flex-shrink-0 text-center min-w-[90px]">
                      <p className="text-xs font-black text-[#001F3F]/60 uppercase tracking-widest leading-none mb-1">{a.mesReferencia.split('/')[1]}</p>
                      <p className="text-xl font-black text-[#001F3F] leading-none uppercase">{['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][parseInt(a.mesReferencia.split('/')[0] || '1') - 1] ?? a.mesReferencia.split('/')[0]}</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-700">{a.mesReferencia}</span>
                        {a.percentualSistematica !== null && a.percentualSistematica !== undefined ? (
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${a.regra7pctAtendida ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            🌾 {a.percentualSistematica.toFixed(2).replace('.', ',')}%
                          </span>
                        ) : a.regra7pctAtendida !== null && (
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${a.regra7pctAtendida ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            🌾 {a.regra7pctAtendida ? '≥7%' : '<7%'}
                          </span>
                        )}
                        {a.fornecedores.filter(f => f.descartado).length > 0 && (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {a.fornecedores.filter(f => f.descartado).length} descartado{a.fornecedores.filter(f => f.descartado).length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{a.totalRegistros} fornecedores · Salvo em {new Date(a.criadoEm).toLocaleDateString('pt-BR')}</p>
                    </div>

                    {/* Economia */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Economia</p>
                      <p className="text-2xl font-black text-emerald-600">{fmt(economiaAtiva)}</p>
                      {economiaAtiva !== a.economiaTotal && (
                        <p className="text-xs text-slate-300 line-through">{fmt(a.economiaTotal)}</p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className={`flex items-center gap-2 flex-shrink-0 ${modoSelecao ? 'hidden' : ''}`} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setAuditoriaSelecionada(a)}
                        className="flex items-center gap-1.5 bg-[#001F3F] hover:bg-[#002d5c] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                      >
                        Abrir <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      {/* Botão download — expande inline ao clicar */}
                      {dropdownDownloadId === a.id ? (
                        <>
                          <button
                            onClick={() => { setPrintCardModo('icms'); setPrintCardAuditoria(a); setDropdownDownloadId(null); }}
                            className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText className="w-3 h-3" />PDF ICMS
                          </button>
                          {a.trigoItens && a.trigoItens.length > 0 && (
                            <button
                              onClick={() => { setPrintCardModo('trigo'); setPrintCardAuditoria(a); setDropdownDownloadId(null); }}
                              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Wheat className="w-3 h-3" />PDF Trigo
                            </button>
                          )}
                          <button
                            onClick={() => { downloadExcel(a); setDropdownDownloadId(null); }}
                            className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <Download className="w-3 h-3" />Excel
                          </button>
                          <button
                            onClick={() => setDropdownDownloadId(null)}
                            className="p-1.5 text-slate-300 hover:text-slate-500 rounded-lg transition-colors text-xs font-bold"
                          >✕</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDropdownDownloadId(a.id)}
                          title="Baixar"
                          className="p-2.5 hover:bg-slate-100 text-slate-300 hover:text-slate-600 rounded-xl transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {confirmDelete === a.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { excluirAuditoria(a.id).then(() => { recarregar(); setConfirmDelete(null); }); }} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl">Sim</button>
                          <button onClick={() => setConfirmDelete(null)} className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(a.id)} className="p-2.5 hover:bg-red-50 hover:text-red-400 text-slate-200 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
          })()}
        </div>
      </main>

      {/* Barra flutuante de seleção múltipla */}
      {modoSelecao && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${selecionados.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="bg-[#001F3F] text-white rounded-2xl shadow-2xl shadow-[#001F3F]/40 px-5 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="bg-[#F5C000] text-[#001F3F] text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">{selecionados.size}</span>
              <span className="text-sm font-bold text-white/80">{selecionados.size === 1 ? 'mês selecionado' : 'meses selecionados'}</span>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <button
              onClick={() => {
                const lista = auditorias.filter(a => selecionados.has(a.id));
                setPrintMultiModo('icms');
                setPrintMultiList(lista);
              }}
              className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />PDF ICMS
            </button>
            {auditorias.filter(a => selecionados.has(a.id)).some(a => a.trigoItens && a.trigoItens.length > 0) && (
              <button
                onClick={() => {
                  const lista = auditorias.filter(a => selecionados.has(a.id));
                  setPrintMultiModo('trigo');
                  setPrintMultiList(lista);
                }}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <Wheat className="w-3.5 h-3.5" />PDF Trigo
              </button>
            )}
            <button
              onClick={() => {
                const lista = auditorias.filter(a => selecionados.has(a.id));
                downloadExcelMulti(lista);
              }}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />Excel
            </button>
            <button
              onClick={() => { setModoSelecao(false); setSelecionados(new Set()); }}
              className="text-white/50 hover:text-white text-xs font-bold px-2 py-2 rounded-xl hover:bg-white/10 transition-colors"
            >✕</button>
          </div>
        </div>
      )}

      {printCardAuditoria && (
        <PrintOverlay auditoria={printCardAuditoria} modo={printCardModo} onDone={() => setPrintCardAuditoria(null)} />
      )}
      {printMultiList && (
        <PrintOverlayMulti auditorias={printMultiList} modo={printMultiModo} onDone={() => setPrintMultiList(null)} />
      )}
      {auditoriaSelecionada && (
        <DetalheAuditoria
          auditoria={auditoriaSelecionada}
          onClose={() => { setAuditoriaSelecionada(null); recarregar(); }}
          onUpdate={(a) => { setAuditoriaSelecionada(a); recarregar(); }}
        />
      )}
      {rascunhoAberto && (
        <EditorRascunho
          rascunho={rascunhoAberto}
          onSalvarAlteracoes={(r) => { salvarRascunho(r).then(() => { setRascunhoAberto(r); recarregar(); }); }}
          onFinalizar={(r) => {
            setRascunhoAberto(null);
            setRascunhoFinalizando(r);
          }}
          onClose={() => { setRascunhoAberto(null); recarregar(); }}
        />
      )}

      {/* Modal Finalizar Rascunho → salva no histórico */}
      {rascunhoFinalizando && (
        <ModalSalvar
          economiaTotal={round(rascunhoFinalizando.fornecedores.filter(f => !f.descartado).reduce((a, f) => a + f.economia, 0))}
          nomeCliente={cliente.nome}
          mesInicial={rascunhoFinalizando.mesReferencia || undefined}
          onConfirm={(_empresa, mes) => {
            const ativos = rascunhoFinalizando.fornecedores.filter(f => !f.descartado);
            const selecionados = rascunhoFinalizando.bakeryItems.filter(i => i.selected);
            const selectedTotal = round(selecionados.reduce((a, i) => a + i.value, 0));
            const qt = rascunhoFinalizando.questorTotal;
            const pct = qt && qt > 0 ? (selectedTotal / qt) * 100 : null;
            const auditoria: AuditoriaSalva = {
              id: `${Date.now()}`,
              criadoEm: new Date().toISOString(),
              nomeEmpresa: cliente.nome,
              mesReferencia: mes,
              totalIcmsPago: round(ativos.reduce((a, f) => a + f.icmsPago, 0)),
              totalIcmsProjetado: round(ativos.reduce((a, f) => a + f.icmsProjetado, 0)),
              economiaTotal: round(ativos.reduce((a, f) => a + f.economia, 0)),
              totalRegistros: rascunhoFinalizando.fornecedores.length,
              percentualSistematica: pct,
              regra7pctAtendida: pct !== null ? pct >= 7 : null,
              fornecedores: rascunhoFinalizando.fornecedores,
              trigoQuestorTotal: qt,
              trigoSelectedTotal: selectedTotal,
              trigoItens: selecionados.map(i => ({
                description: i.description,
                supplier: i.supplier,
                ncm: i.ncm,
                value: i.value,
              })),
              summaryTable: rascunhoFinalizando.summaryTable,
            };
            salvarAuditoria(auditoria).then(() =>
              excluirRascunho(rascunhoFinalizando.id).then(() => {
                setRascunhoFinalizando(null);
                recarregar();
              })
            );
          }}
          onClose={() => setRascunhoFinalizando(null)}
        />
      )}

      {showHistorico && <TelaHistorico onClose={() => setShowHistorico(false)} />}
    </div>
  );
}

export default function App() {
  // Navegação: 'home' | 'dashboard' | 'auditoria'
  const [tela, setTela] = useState<'home' | 'dashboard' | 'auditoria'>('home');
  const [clienteAtivo, setClienteAtivo] = useState<Cliente | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingQuestor, setIsDraggingQuestor] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [printMode, setPrintMode] = useState<'none' | 'icms' | 'wheat'>('none');
  const [wheatPrintData, setWheatPrintData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const questorInputRef = useRef<HTMLInputElement>(null);
  const [questorTotal, setQuestorTotal] = useState<number | null>(null);
  const [isParsingQuestor, setIsParsingQuestor] = useState(false);
  const [questorFileName, setQuestorFileName] = useState<string | null>(null);
  const [questorError, setQuestorError] = useState<string | null>(null);

  // Pending file (awaiting manual "Analisar" click)
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Batch mode
  type BatchEntry = { id: string; file: File | null; questorVal: number | null; questorImageName?: string; isParsingQuestor?: boolean; mes: string; status: 'idle' | 'processing' | 'done' | 'error'; errorMsg?: string };
  const [batchMode, setBatchMode] = useState(false);
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([
    { id: 'b1', file: null, questorVal: null, mes: '', status: 'idle' },
    { id: 'b2', file: null, questorVal: null, mes: '', status: 'idle' },
  ]);
  const [batchDone, setBatchDone] = useState(0);
  const [batchRunning, setBatchRunning] = useState(false);

  const [showHistorico, setShowHistorico] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [showPainel, setShowPainel] = useState(false);
  const [showModalSalvar, setShowModalSalvar] = useState(false);
  const [showModalRascunho, setShowModalRascunho] = useState(false);
  const [rascunhoParaFinalizar, setRascunhoParaFinalizar] = useState<RascunhoAuditoria | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [descartadosTemp, setDescartadosTemp] = useState<Set<number>>(new Set());
  const [homeReloadKey, setHomeReloadKey] = React.useState(0);

  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('groqApiKey') || '';

  const resetUploadState = () => {
    setProcessedData(null);
    setError(null);
    setQuestorTotal(null);
    setQuestorFileName(null);
    setQuestorError(null);
    setPendingFile(null);
    setBatchMode(false);
    setBatchEntries([
      { id: 'b1', file: null, questorVal: null, mes: '', status: 'idle' },
      { id: 'b2', file: null, questorVal: null, mes: '', status: 'idle' },
    ]);
    setBatchDone(0);
    setBatchRunning(false);
    setDescartadosTemp(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (questorInputRef.current) questorInputRef.current.value = '';
  };

  const voltarHome = () => {
    setTela('home');
    setClienteAtivo(null);
    resetUploadState();
  };

  const voltarDashboard = () => {
    setTela('dashboard');
    resetUploadState();
  };

  // Summary table efetiva — recalcula quando há descartes (deve ficar ANTES dos early returns)
  const summaryTableEfetiva = React.useMemo(() => {
    if (!processedData) return [];
    const orig = processedData.summary.summaryTable;
    if (!descartadosTemp || descartadosTemp.size === 0) return orig;
    const rnd = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const ativos = processedData.summary.simplesSuppliers.filter((_, i) => !descartadosTemp.has(i));
    const normalRow = orig.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')));
    const totalSimplesIcms = rnd(ativos.reduce((a, s) => a + s.originalValue, 0));
    const totalSimplesValor = rnd(ativos.reduce((a, s) => a + s.productTotal, 0));
    const totalProjetado = rnd(ativos.reduce((a, s) => a + s.newValue, 0));
    const totalNormalIcms = normalRow?.icmsAntecipado ?? 0;
    const totalNormalValor = normalRow?.valorTotal ?? 0;
    const totalPagoReal = rnd(totalNormalIcms + totalSimplesIcms);
    const totalProjetadoIdeal = rnd(totalNormalIcms + totalProjetado);
    return [
      ...(normalRow ? [normalRow] : []),
      { label: 'Simples Nacional', valorTotal: totalSimplesValor, icmsAntecipado: totalSimplesIcms },
      { label: 'Projeção (Normal)', valorTotal: totalSimplesValor, icmsAntecipado: totalProjetado },
      { label: 'Total ICMS Pago (Real)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalPagoReal },
      { label: 'Total ICMS Projetado (Cenário Ideal)', valorTotal: totalNormalValor + totalSimplesValor, icmsAntecipado: totalProjetadoIdeal },
      { label: 'Diferença (Economia)', valorTotal: 0, icmsAntecipado: rnd(totalPagoReal - totalProjetadoIdeal) },
    ];
  }, [processedData, descartadosTemp]);

  // Tela Home
  if (tela === 'home') {
    return (
      <>
        <TelaHome
          onSelectCliente={(c) => { setClienteAtivo(c); setTela('dashboard'); }}
          onOpenClientes={() => setShowClientes(true)}
          onOpenHistorico={() => setShowHistorico(true)}
          onOpenPainel={() => setShowPainel(true)}
          reloadKey={homeReloadKey}
        />
        {showClientes && <TelaClientes onClose={() => { setShowClientes(false); setHomeReloadKey(k => k + 1); }} />}
        {showHistorico && <TelaHistorico onClose={() => setShowHistorico(false)} />}
        {showPainel && <TelaPainelGeral onClose={() => setShowPainel(false)} />}
      </>
    );
  }

  // Tela Dashboard do Cliente
  if (tela === 'dashboard' && clienteAtivo) {
    return (
      <DashboardCliente
        cliente={clienteAtivo}
        onNovaApuracao={() => setTela('auditoria')}
        onVoltar={voltarHome}
        onFinalizarRascunho={(r) => {
          setRascunhoParaFinalizar(r);
          setTela('auditoria');
        }}
      />
    );
  }

  const handleSalvarHistorico = (_empresa: string, mes: string) => {
    if (!processedData || !clienteAtivo) return;
    setSalvando(true);
    const fornecedores: FornecedorSalvo[] = processedData.summary.simplesSuppliers.map((s, i) => ({
      id: `${Date.now()}-${i}`,
      nome: s.name,
      produto: s.productName || '—',
      valorTotal: s.productTotal,
      icmsPago: s.originalValue,
      icmsProjetado: s.newValue,
      economia: s.economy,
      descartado: descartadosTemp.has(i),
    }));
    const auditoria: AuditoriaSalva = {
      id: `${Date.now()}`,
      criadoEm: new Date().toISOString(),
      nomeEmpresa: clienteAtivo.nome,
      mesReferencia: mes,
      totalIcmsPago: summaryTableEfetiva.find(r => r.label.includes('Real'))?.icmsAntecipado || 0,
      totalIcmsProjetado: summaryTableEfetiva.find(r => r.label.includes('Ideal'))?.icmsAntecipado || 0,
      economiaTotal: processedData.summary.totalEconomy,
      totalRegistros: processedData.summary.recordCount,
      percentualSistematica: wheatPrintData?.percentage ?? null,
      regra7pctAtendida: wheatPrintData?.isOk ?? null,
      fornecedores,
      trigoQuestorTotal: wheatPrintData?.questorTotal ?? null,
      trigoSelectedTotal: wheatPrintData?.selectedTotal ?? null,
      trigoItens: wheatPrintData?.selectedItems?.map((i: any) => ({
        description: i.description,
        supplier: i.supplier,
        ncm: i.ncm,
        value: i.value,
      })) ?? [],
      summaryTable: summaryTableEfetiva,
    };
    salvarAuditoria(auditoria).then(() => {
      setSalvando(false);
      setShowModalSalvar(false);
    });
  };

  const parseQuestorImage = async (file: File) => {
    setIsParsingQuestor(true);
    setQuestorError(null);
    setQuestorFileName(file.name);
    try {
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const base64 = await toBase64(file);
      const prompt = `Aja como um transcritor OCR especializado em matrizes fiscais. Encontre estritamente as linhas cuja natureza de operação comece com 1.102, 1.403, 2.102 ou 2.403 (e também seus derivados como 1.102.001, 1.403.001 etc). 
Extraia o código e o valor exato formatado na coluna "Vlr Contábil" (na extrema direita da linha).
Não tente realizar nenhum cálculo ou soma. Sua resposta DEVE SER UNICAMENTE, OBRIGATORIAMENTE E ESTRITAMENTE um array JSON puro. Exemplo válido:
[
  {"cfop": "1.102", "valor": 519544.17},
  {"cfop": "1.102.001", "valor": 61796.88}
]
NENHUMA PALAVRA OU EXPLICAÇÃO DEVE SER ESCRITA NA RESPOSTA ALÉM DO ARRAY JSON.`;
      const response = await groqChat({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } }
        ]}],
        temperature: 0, max_tokens: 500
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || `Erro ${response.status}`); }
      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      const match = text.match(/\[.*\]/s);
      if (match) { 
        const items = JSON.parse(match[0]);
        const sum = items.reduce((acc: number, curr: any) => acc + (curr.valor || 0), 0);
        setQuestorTotal(sum); 
      }
      else throw new Error('A IA não conseguiu estruturar as linhas do relatório.');
    } catch (err) {
      setQuestorError(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    } finally { setIsParsingQuestor(false); }
  };

  // Parse Questor image for a specific batch entry
  const parseQuestorForEntry = async (file: File, entryId: string) => {
    setBatchEntries(prev => prev.map(e => e.id === entryId ? { ...e, isParsingQuestor: true, questorImageName: file.name } : e));
    try {
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const base64 = await toBase64(file);
      const prompt = `Aja como um transcritor OCR especializado em matrizes fiscais. Encontre estritamente as linhas cuja natureza de operação comece com 1.102, 1.403, 2.102 ou 2.403 (e também seus derivados como 1.102.001, 1.403.001 etc).
Extraia o código e o valor exato formatado na coluna "Vlr Contábil" (na extrema direita da linha).
Não tente realizar nenhum cálculo ou soma. Sua resposta DEVE SER UNICAMENTE, OBRIGATORIAMENTE E ESTRITAMENTE um array JSON puro. Exemplo válido:
[
  {"cfop": "1.102", "valor": 519544.17},
  {"cfop": "1.102.001", "valor": 61796.88}
]
NENHUMA PALAVRA OU EXPLICAÇÃO DEVE SER ESCRITA NA RESPOSTA ALÉM DO ARRAY JSON.`;
      const response = await groqChat({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } }
        ]}],
        temperature: 0, max_tokens: 500
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || `Erro ${response.status}`); }
      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      const match = text.match(/\[.*\]/s);
      if (match) {
        const items = JSON.parse(match[0]);
        const sum = items.reduce((acc: number, curr: any) => acc + (curr.valor || 0), 0);
        setBatchEntries(prev => prev.map(e => e.id === entryId ? { ...e, questorVal: sum, isParsingQuestor: false } : e));
      } else {
        throw new Error('A IA não conseguiu estruturar as linhas do relatório.');
      }
    } catch (err) {
      setBatchEntries(prev => prev.map(e => e.id === entryId ? {
        ...e, isParsingQuestor: false, questorVal: null, questorImageName: undefined,
        errorMsg: err instanceof Error ? err.message : 'Erro ao processar imagem'
      } : e));
    }
  };

  // Core processing logic — returns Promise<ProcessedData>
  const processFileData = (file: File): Promise<ProcessedData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (workbook.SheetNames.length < 4) {
            throw new Error('A planilha deve conter pelo menos 4 abas.');
          }

          const lastSheetName = workbook.SheetNames[workbook.SheetNames.length - 1];
          const icmsSheetName = workbook.SheetNames[2] || workbook.SheetNames[workbook.SheetNames.length - 2]; // Try 3rd tab or penultimate
          
          const worksheet = workbook.Sheets[lastSheetName];
          const icmsWorksheet = workbook.Sheets[icmsSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const icmsData = icmsWorksheet ? XLSX.utils.sheet_to_json(icmsWorksheet, { header: 1 }) as any[][] : [];

          if (jsonData.length < 2) {
            throw new Error('A última aba está vazia ou não possui dados suficientes.');
          }

          const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

          const parseVisualValue = (val: any) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return round(val);
            
            let s = String(val).trim();
            
            // Heuristic for Brazilian currency format: "1.234,56" or "1234,56"
            if (s.includes(',')) {
              // Remove thousands separator (dot) and replace decimal separator (comma) with dot
              s = s.replace(/\./g, '').replace(',', '.');
              // Remove any remaining non-numeric characters except dot and minus
              s = s.replace(/[^\d.-]/g, '');
            } else {
              // Standard number format "1234.56" or just "1234"
              s = s.replace(/[^\d.-]/g, '');
            }
            
            return round(parseFloat(s) || 0);
          };

          // Extract summary from 3rd tab (ICMS)
          const summaryTable: SummaryRow[] = [];
          if (icmsData.length > 0) {
            // Find the start of the table (usually row 3 in screenshot, index 2 or 3)
            // Let's look for "Tipo Fornecedor" in the icmsData
            let startRow = -1;
            for (let i = 0; i < icmsData.length; i++) {
              if (icmsData[i].some(cell => String(cell).includes('Tipo Fornecedor'))) {
                startRow = i;
                break;
              }
            }

            if (startRow !== -1) {
              const headers = icmsData[startRow];
              const tipoIdx = headers.findIndex(h => String(h).includes('Tipo Fornecedor'));
              const valorTotalIdx = headers.findIndex(h => String(h).includes('Valor Total'));
              const icmsIdx = headers.findIndex(h => String(h).includes('VALOR DO ICMS ANTECIPADO'));

              for (let i = startRow + 1; i < icmsData.length; i++) {
                const row = icmsData[i];
                const label = String(row[tipoIdx] || '');
                if (!label || label.toLowerCase().includes('total geral')) break;
                
                summaryTable.push({
                  label,
                  valorTotal: parseVisualValue(row[valorTotalIdx]),
                  icmsAntecipado: parseVisualValue(row[icmsIdx])
                });
              }
            }
          }

          const headers = jsonData[0];
          const findCol = (name: string) => headers.findIndex((h: any) => String(h || '').trim().toUpperCase() === name.toUpperCase());

          const tipoFornecedorIdx = findCol('Tipo Fornecedor');
          const fornecedorIdx = [
            'NOME', 'RAZAO SOCIAL', 'RAZÃO SOCIAL', 'NOME FANTASIA', 'NOME DO FORNECEDOR', 'NOME FORNECEDOR', 'CLIENTE', 'NOME CLIENTE', 'Fornecedor'
          ].reduce((acc, name) => acc !== -1 ? acc : findCol(name), -1);
          
          const produtoIdx = [
            'DESCRIÇÃO', 'DESCRICAO', 'Produto', 'PRODUTO', 'NOME DO PRODUTO', 'ITEM', 'NOME ITEM'
          ].reduce((acc, name) => acc !== -1 ? acc : findCol(name), -1);

          const valorTotalIdx = findCol('Valor Total');
          const valorIcmsIdx = findCol('Valor ICMS');
          const valorTotalLiquidoIdx = findCol('VALOR TOTAL LIQUIDO');
          const valorIcmsDescIdx = findCol('VALOR DO ICMS DESC');
          const credSimplesNacionalIdx = findCol('CRED SIMPLES NACIONAL');
          const percSistematica25Idx = findCol('PERC SISTEMATICA 25%');
          const bcSistematicaIdx = findCol('BASE DE CALC SISTEMATICA');
          const bcSistematicaAliqIdx = findCol('BC SISTEMATICA * ALIQ INTERN');
          const valorIcmsAntecipadoIdx = findCol('VALOR DO ICMS ANTECIPADO');

          if (tipoFornecedorIdx === -1 || valorTotalIdx === -1 || valorIcmsIdx === -1) {
            throw new Error('Colunas obrigatórias ("Tipo Fornecedor", "Valor Total", "Valor ICMS") não encontradas.');
          }

          // Determine which column to lock. Usually it's "VALOR DO ICMS ANTECIPADO" or the last one.
          const colToLockIdx = valorIcmsAntecipadoIdx !== -1 ? valorIcmsAntecipadoIdx : headers.length - 1;

          // 2. TRAVAMENTO DE RESULTADO (CRÍTICO)
          // 3. REORGANIZAÇÃO DAS COLUNAS
          // We create a new structure adding the locked column at the end
          const newJsonData = jsonData.map((row, i) => {
            if (i === 0) {
              return [...row, 'VALOR ANTECIPADO ORIGINAL (TRAVADO)'];
            }
            // Lock the current value of the target column
            const lockedValue = row[colToLockIdx];
            return [...row, lockedValue];
          });

          const newLastColIdx = newJsonData[0].length - 1;

          let totalEconomy = 0;
          let recordCount = 0;
          const inconsistencies: string[] = [];
          const simplesSuppliers: SimplesSupplierData[] = [];

          // 4. CRIAÇÃO DA NOVA LÓGICA DE ICMS
          // 5. REPROCESSAMENTO AUTOMÁTICO DA CADEIA
          const filteredRows: any[][] = [newJsonData[0]]; // Include headers

          for (let i = 1; i < newJsonData.length; i++) {
            const row = newJsonData[i];
            const tipoFornecedor = String(row[tipoFornecedorIdx] || '').trim().toUpperCase();
            
            // FILTRO: Apenas Simples Nacional
            if (tipoFornecedor !== 'SIMPLES NACIONAL') {
              continue;
            }

            const valorTotal = parseVisualValue(row[valorTotalIdx]);
            if (isNaN(valorTotal) || valorTotal === 0) {
              // If valorTotal is 0, it might be a header or empty row
              continue;
            }

            // --- INÍCIO DA CADEIA DE RECÁLCULO ---
            
            // 1. Valor ICMS = Valor Total * 20,5%
            const newIcms = round(valorTotal * 0.205);
            row[valorIcmsIdx] = newIcms;

            // 2. VALOR TOTAL LIQUIDO = Valor Total
            if (valorTotalLiquidoIdx !== -1) row[valorTotalLiquidoIdx] = valorTotal;

            // 3. VALOR DO ICMS DESC = Valor ICMS (novo)
            if (valorIcmsDescIdx !== -1) row[valorIcmsDescIdx] = newIcms;

            // 4. PERC SISTEMATICA 25% = VALOR TOTAL LIQUIDO * 25%
            const percSistematica = round(valorTotal * 0.25);
            if (percSistematica25Idx !== -1) row[percSistematica25Idx] = percSistematica;

            // 5. BASE DE CALC SISTEMATICA = VALOR TOTAL LIQUIDO + PERC SISTEMATICA 25%
            const bcSistematica = round(valorTotal + percSistematica);
            if (bcSistematicaIdx !== -1) row[bcSistematicaIdx] = bcSistematica;

            // 6. BC SISTEMATICA * ALIQ INTERN = BASE DE CALC SISTEMATICA * 20,5%
            const bcSistematicaAliq = round(bcSistematica * 0.205);
            if (bcSistematicaAliqIdx !== -1) row[bcSistematicaAliqIdx] = bcSistematicaAliq;

            // 7. VALOR DO ICMS ANTECIPADO = BC SISTEMATICA * ALIQ INTERN - VALOR DO ICMS DESC - CRED SIMPLES NACIONAL
            const credSimples = parseVisualValue(row[credSimplesNacionalIdx]);
            const newValorAntecipado = round(Math.max(0, bcSistematicaAliq - newIcms - credSimples));
            
            if (valorIcmsAntecipadoIdx !== -1) {
              row[valorIcmsAntecipadoIdx] = newValorAntecipado;
            } else {
              // If we didn't find the column by name, update the one we locked (which was the last one)
              row[colToLockIdx] = newValorAntecipado;
            }

            // --- FIM DA CADEIA DE RECÁLCULO ---

            const originalValue = parseVisualValue(row[newLastColIdx]);
            const economy = round(originalValue - newValorAntecipado);
            
            totalEconomy += economy;
            recordCount++;

            // Add to dashboard list
            simplesSuppliers.push({
              name: fornecedorIdx !== -1 ? String(row[fornecedorIdx] || 'Fornecedor Desconhecido') : `Linha ${i + 1}`,
              productName: produtoIdx !== -1 ? String(row[produtoIdx] || '—') : '—',
              productTotal: parseVisualValue(row[valorTotalIdx]),
              originalValue,
              newValue: newValorAntecipado,
              economy
            });

            filteredRows.push(row);
          }

          // Calculate projected total for Simples Nacional
          const projectedIcmsAntecipado = round(simplesSuppliers.reduce((acc, curr) => acc + curr.newValue, 0));
          const simplesRow = summaryTable.find(r => r.label.toUpperCase().includes('SIMPLES NACIONAL'));
          const normalRow = summaryTable.find(r => r.label.toUpperCase() === 'NORMAL' || (r.label.toUpperCase().includes('NORMAL') && !r.label.toUpperCase().includes('SIMPLES') && !r.label.toUpperCase().includes('PROJEÇÃO')));

          // Update summaryTable with projection
          const finalSummaryTable = [...summaryTable];
          const emBrancoIdx = finalSummaryTable.findIndex(r => r.label.includes('(em branco)'));
          
          if (emBrancoIdx !== -1) {
            finalSummaryTable[emBrancoIdx] = {
              label: 'Projeção (Normal)',
              valorTotal: simplesRow ? simplesRow.valorTotal : 0,
              icmsAntecipado: projectedIcmsAntecipado
            };
          } else {
            finalSummaryTable.push({
              label: 'Projeção (Normal)',
              valorTotal: simplesRow ? simplesRow.valorTotal : 0,
              icmsAntecipado: projectedIcmsAntecipado
            });
          }

          const totalNormalIcms = normalRow ? normalRow.icmsAntecipado : 0;
          const totalSimplesIcms = simplesRow ? simplesRow.icmsAntecipado : 0;
          const totalPagoReal = round(totalNormalIcms + totalSimplesIcms);
          const totalProjetadoIdeal = round(totalNormalIcms + projectedIcmsAntecipado);

          // Add Total Pago Real
          finalSummaryTable.push({
            label: 'Total ICMS Pago (Real)',
            valorTotal: (normalRow?.valorTotal || 0) + (simplesRow?.valorTotal || 0),
            icmsAntecipado: totalPagoReal
          });

          // Add Total Projetado Ideal
          finalSummaryTable.push({
            label: 'Total ICMS Projetado (Cenário Ideal)',
            valorTotal: (normalRow?.valorTotal || 0) + (simplesRow?.valorTotal || 0),
            icmsAntecipado: totalProjetadoIdeal
          });

          // Add Difference Row
          finalSummaryTable.push({
            label: 'Diferença (Economia)',
            valorTotal: 0,
            icmsAntecipado: round(totalPagoReal - totalProjetadoIdeal)
          });

          const formatWorksheet = (ws: XLSX.WorkSheet) => {
            Object.keys(ws).forEach(key => {
              if (key.startsWith('!')) return;
              const cell = ws[key];
              if (cell && typeof cell.v === 'number') {
                cell.z = '#,##0.00';
              }
            });
          };

          // Update the worksheet with new values and ensure no formulas in the locked column
          const newWorksheet = XLSX.utils.aoa_to_sheet(newJsonData);
          formatWorksheet(newWorksheet);
          
          const filteredWorksheet = XLSX.utils.aoa_to_sheet(filteredRows);
          formatWorksheet(filteredWorksheet);

          // Clone ALL original sheets into finalWorkbook to preserve every tab
          const finalWorkbook = XLSX.utils.book_new();
          workbook.SheetNames.forEach(sheetName => {
            finalWorkbook.SheetNames.push(sheetName);
            finalWorkbook.Sheets[sheetName] = workbook.Sheets[sheetName];
          });

          // Replace only the last sheet with the recalculated version
          finalWorkbook.Sheets[lastSheetName] = newWorksheet;

          // Update the ICMS summary sheet in the workbook
          if (icmsSheetName) {
            // Find where the summary table starts in icmsData
            let startRow = -1;
            for (let i = 0; i < icmsData.length; i++) {
              if (icmsData[i].some(cell => String(cell).includes('Tipo Fornecedor'))) {
                startRow = i;
                break;
              }
            }

            if (startRow !== -1) {
              const headers = icmsData[startRow];
              const tipoIdx = headers.findIndex(h => String(h).includes('Tipo Fornecedor'));
              const valorTotalIdx = headers.findIndex(h => String(h).includes('Valor Total'));
              const icmsIdx = headers.findIndex(h => String(h).includes('VALOR DO ICMS ANTECIPADO'));

              // Reconstruct the ICMS data array
              const newIcmsData = icmsData.slice(0, startRow + 1);
              
              // Add the summary rows (Normal, Simples, Projeção, Diferença)
              finalSummaryTable.forEach(row => {
                const newRow = new Array(headers.length).fill('');
                newRow[tipoIdx] = row.label;
                newRow[valorTotalIdx] = row.valorTotal;
                newRow[icmsIdx] = row.icmsAntecipado;
                newIcmsData.push(newRow);
              });

              // Add Total Geral at the end
              const totalGeralRow = new Array(headers.length).fill('');
              totalGeralRow[tipoIdx] = 'Total geral';
              const originalCategories = ['Normal', 'Simples Nacional'];
              totalGeralRow[valorTotalIdx] = finalSummaryTable
                .filter(row => originalCategories.some(cat => row.label.toUpperCase().includes(cat.toUpperCase())))
                .reduce((acc, curr) => acc + curr.valorTotal, 0);
              totalGeralRow[icmsIdx] = finalSummaryTable
                .filter(row => originalCategories.some(cat => row.label.toUpperCase().includes(cat.toUpperCase())))
                .reduce((acc, curr) => acc + curr.icmsAntecipado, 0);
              newIcmsData.push(totalGeralRow);

              const icmsSheet = XLSX.utils.aoa_to_sheet(newIcmsData);
              formatWorksheet(icmsSheet);
              finalWorkbook.Sheets[icmsSheetName] = icmsSheet;
            }
          }

          // Extract products from first sheet — filter ONLY NCM 1101.00.10 and 1901.20.00
          const firstSheetName2 = workbook.SheetNames[0];
          const firstSheet2 = workbook.Sheets[firstSheetName2];
          const firstSheetData2 = XLSX.utils.sheet_to_json(firstSheet2, { header: 1 }) as any[][];
          let allProducts: ProcessedData['allProducts'] = [];
          if (firstSheetData2.length > 1) {
            const fHeaders = firstSheetData2[0];
            const fFindCol = (name: string) => fHeaders.findIndex((h: any) => String(h || '').trim().toUpperCase().includes(name.toUpperCase()));
            const fDescIdx = ['DESCRIÇÃO', 'DESCRICAO', 'PRODUTO', 'ITEM', 'NOME DO PRODUTO', 'DESCRIPTION'].reduce((acc, n) => acc !== -1 ? acc : fFindCol(n), -1);
            const fSupplierIdx = ['NOME', 'RAZAO SOCIAL', 'RAZÃO SOCIAL', 'FORNECEDOR', 'CLIENTE'].reduce((acc, n) => acc !== -1 ? acc : fFindCol(n), -1);
            const fValueIdx = ['VALOR TOTAL', 'VLR CONTABIL', 'VALOR CONTÁBIL'].reduce((acc, n) => acc !== -1 ? acc : fFindCol(n), -1);
            const fNcmIdx = ['NCM', 'CLASSIFICAÇÃO FISCAL', 'CLASSIFICACAO FISCAL'].reduce((acc, n) => acc !== -1 ? acc : fFindCol(n), -1);

            const BAKERY_NCMS = ['11010010', '19012000'];

            if (fDescIdx !== -1 && fNcmIdx !== -1) {
              for (let i = 1; i < firstSheetData2.length; i++) {
                const row = firstSheetData2[i];
                const ncmRaw = String(row[fNcmIdx] || '').trim().replace(/\D/g, '');
                const ncmFmt = String(row[fNcmIdx] || '').trim();
                // Check if the raw NCM starts with exactly the 8 digits requested to avoid catching 1901.90.90
                const isBakeryNcm = BAKERY_NCMS.some(n => ncmRaw.startsWith(n));
                const desc = String(row[fDescIdx] || '').trim();
                if (isBakeryNcm && desc) {
                  allProducts.push({
                    rowIndex: i,
                    description: desc,
                    supplier: fSupplierIdx !== -1 ? String(row[fSupplierIdx] || '') : '',
                    value: fValueIdx !== -1 ? parseVisualValue(row[fValueIdx]) : 0,
                    ncm: ncmFmt
                  });
                }
              }
            }
          }

          // Create a filtered workbook
          const filteredWorkbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(filteredWorkbook, filteredWorksheet, "Simples Nacional Corrigido");

          resolve({
            workbook: finalWorkbook,
            summary: {
              totalEconomy: round(totalEconomy),
              recordCount,
              inconsistencies,
              simplesSuppliers,
              summaryTable: finalSummaryTable
            },
            fileName: `AUDITORIA_${file.name}`,
            filteredWorkbook: filteredWorkbook,
            allProducts
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Erro ao processar o arquivo.'));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Process single file — sets UI state
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setIsDragging(false);
    setPendingFile(null);
    try {
      const result = await processFileData(file);
      setProcessedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // File input handler — just stores file, does NOT start processing
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('target' in event && (event.target as HTMLInputElement).files) {
      file = (event.target as HTMLInputElement).files?.[0];
    } else if ('dataTransfer' in event) {
      event.preventDefault();
      file = event.dataTransfer.files?.[0];
    }
    if (file) {
      setPendingFile(file);
      setError(null);
    }
    setIsDragging(false);
  };

  // Batch processing — process all valid entries and save each to history
  // Classifica itens de trigo via Groq IA — mesma lógica do BakeryPanel
  const classifyBakeryItemsForBatch = async (
    products: NonNullable<ProcessedData['allProducts']>
  ): Promise<BakeryItemSalvo[]> => {
    if (!products.length) {
      return [];
    }

    const BATCH_SIZE = 50;
    const results: { index: number; shouldCount: boolean; confidence: 'high' | 'medium' | 'low'; reason: string }[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const productList = batch.map((p, idx) =>
        `${i + idx}: ${p.description}${p.ncm ? ` [NCM: ${p.ncm}]` : ''} - Fornecedor: ${p.supplier}`
      ).join('\n');

      const prompt = `Você é um auditor fiscal especializado em panificação. Os produtos abaixo já foram pré-filtrados por NCM (1101.00.10 = farinha de trigo, 1901.20.00 = pré-misturas). Avalie cada item e recomende se deve ou não ser contado na sistemática de panificação para cálculo da regra dos 7%.\n\nRegras:\n- Contar: farinhas de trigo, pré-misturas, semolina, trigo em grão diretamente relacionados à panificação\n- Não contar: itens com NCM incorreto, produtos só de nome similar mas diferentes, ou que claramente não são insumo de panificação\n\nIMPORTANTE: Responda SOMENTE com JSON array sem texto adicional:\n[{"index":0,"shouldCount":true,"confidence":"high","reason":"Farinha de trigo tipo 1"}, ...]\n\nProdutos:\n${productList}`;

      const response = await groqChat({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0, max_tokens: 2000
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `Erro Groq ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) results.push(...JSON.parse(jsonMatch[0]));
    }

    return results.map(r => {
      const p = products[r.index];
      if (!p) return null;
      return {
        description: p.description, supplier: p.supplier || '—',
        value: p.value, ncm: p.ncm || '',
        selected: r.shouldCount,
        aiConfidence: r.confidence,
      };
    }).filter(Boolean) as BakeryItemSalvo[];
  };

  const processBatch = async () => {
    if (batchRunning || !clienteAtivo) return;
    const validEntries = batchEntries.filter(e => e.file && e.mes.trim());
    if (!validEntries.length) return;

    setBatchRunning(true);
    setBatchDone(0);
    setBatchEntries(prev => prev.map(e =>
      e.file && e.mes.trim() ? { ...e, status: 'idle', errorMsg: undefined } : e
    ));

    let done = 0;
    for (const entry of validEntries) {
      setBatchEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'processing' } : e));
      try {
        const result = await processFileData(entry.file!);
        const rnd = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
        const ss = result.summary.simplesSuppliers as any[];

        // Classifica itens de trigo via IA — se falhar (rate limit), salva desmarcados para revisão manual
        let bakeryClassified: BakeryItemSalvo[] = [];
        if (result.allProducts?.length) {
          try {
            bakeryClassified = await classifyBakeryItemsForBatch(result.allProducts);
          } catch {
            bakeryClassified = result.allProducts.map(p => ({
              description: p.description, supplier: p.supplier || '—',
              value: p.value, ncm: p.ncm || '',
              selected: false, aiConfidence: 'low' as const,
            }));
          }
        }

        // Salva como RASCUNHO — já com itens de trigo classificados e pré-selecionados pela IA
        const rascunho: RascunhoAuditoria = {
          id: `rascunho_batch_${Date.now()}_${entry.id}`,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          nomeEmpresa: clienteAtivo.nome,
          mesReferencia: entry.mes.trim(),
          observacao: 'Importado em lote',
          fornecedores: ss.map((s: any, i: number) => ({
            id: `${Date.now()}-${i}`, nome: s.name, produto: s.productName || '—',
            valorTotal: rnd(s.productTotal), icmsPago: rnd(s.originalValue),
            icmsProjetado: rnd(s.newValue), economia: rnd(s.economy), descartado: false,
          })),
          summaryTable: result.summary.summaryTable ?? [],
          bakeryItems: bakeryClassified,
          questorTotal: entry.questorVal,
        };
        await salvarRascunho(rascunho);
        done++;
        setBatchDone(done);
        setBatchEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done' } : e));
      } catch (err) {
        setBatchEntries(prev => prev.map(e => e.id === entry.id ? {
          ...e, status: 'error', errorMsg: err instanceof Error ? err.message : 'Erro'
        } : e));
      }
    }

    setBatchRunning(false);
  };

  const downloadExcel = (wb: XLSX.WorkBook, fileName: string) => {
    // 1. Gerar string binária do workbook
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

    // 2. Converter string para ArrayBuffer
    const s2ab = (s: string) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i !== s.length; ++i) {
        view[i] = s.charCodeAt(i) & 0xFF;
      }
      return buf;
    };

    // 3. Criar Blob com tipo octet-stream para forçar o navegador a tratar como arquivo para download
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    
    // 4. Sanitizar nome do arquivo e garantir extensão .xlsx
    let safeName = fileName.replace(/[^\w\s\.-]/gi, '').replace(/\s+/g, '_');
    if (!safeName.toLowerCase().endsWith('.xlsx')) {
      safeName += '.xlsx';
    }

    // 5. Criar link temporário e disparar download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();

    // 6. Limpeza
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const downloadFile = () => {
    if (!processedData) return;
    downloadExcel(processedData.workbook, processedData.fileName);
  };

  const downloadFiltered = () => {
    if (!processedData?.filteredWorkbook) return;
    const baseName = processedData.fileName.replace('AUDITORIA_', '');
    downloadExcel(processedData.filteredWorkbook, `SIMPLES_NACIONAL_CORRIGIDO_${baseName}`);
  };

  const reset = () => {
    setProcessedData(null);
    setError(null);
    setQuestorTotal(null);
    setQuestorFileName(null);
    setQuestorError(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (questorInputRef.current) questorInputRef.current.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setPendingFile(file);
      setError(null);
    }
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#001F3F] selection:text-white">
      <div className="print:hidden">
        {/* Premium Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#001F3F]/95 backdrop-blur-md flex flex-col items-center justify-center gap-8 text-white print:hidden"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-white/10 rounded-full" />
              <div className="absolute inset-0 w-24 h-24 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(52,211,153,0.4)]" />
              <ShieldCheck className="absolute inset-0 m-auto w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black tracking-tighter uppercase">Processando Auditoria</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">Validando consistência de ICMS...</p>
            </div>
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-full h-full bg-emerald-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Auditoria */}
      <header className="bg-[#001F3F] border-b border-[#002d5c] py-4 px-8 flex items-center justify-between sticky top-0 z-10 shadow-lg print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={voltarDashboard}
            title="Voltar ao Dashboard"
            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-white/10 transition-all"
          >
            <ArrowRightLeft className="text-[#F5C000] w-5 h-5" />
          </button>
          <img src="/logo-white.png" alt="Contador de Padarias" className="h-9 w-auto object-contain" />
          {clienteAtivo && (
            <div className="border-l border-white/10 pl-4">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Auditando</p>
              <p className="text-sm font-black text-white flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#F5C000]" />
                {clienteAtivo.nome}
                {clienteAtivo.cnpj && <span className="text-white/30 font-mono text-[10px]">· {clienteAtivo.cnpj}</span>}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-12 px-6 print:hidden">
        <AnimatePresence mode="wait">
          {!processedData ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="text-center space-y-4 mb-8 pt-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#001F3F]/5 border border-[#001F3F]/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
                  <span className="text-xs font-black text-[#001F3F] uppercase tracking-[0.25em]">Painel do Auditor</span>
                </div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  Auditoria de<br />
                  <span className="text-[#001F3F]">Consistência de ICMS</span>
                </h2>
                <p className="text-slate-400 max-w-xl mx-auto text-base leading-relaxed">
                  Análise com validação automática da{' '}
                  <span className="text-slate-600 font-semibold">Sistemática de Panificação</span>{' '}
                  guiada por IA.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1">
                  <button
                    onClick={() => { setBatchMode(false); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all ${!batchMode ? 'bg-white text-[#001F3F] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Mês Único
                  </button>
                  <button
                    onClick={() => { setBatchMode(true); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all ${batchMode ? 'bg-white text-[#001F3F] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Layers className="w-4 h-4" />
                    Vários Meses
                  </button>
                </div>
              </div>

              {/* Steps (single mode only) */}
              {!batchMode && (
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${questorTotal ? 'bg-emerald-500 text-white' : 'bg-[#001F3F] text-white'}`}>1</div>
                  <span className={`text-sm font-bold ${questorTotal ? 'text-emerald-600' : 'text-slate-700'}`}>Totais Questor</span>
                  {questorTotal && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="w-12 h-px bg-slate-200" />
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${pendingFile ? 'bg-[#F5C000] text-[#001F3F]' : 'bg-slate-200 text-slate-500'}`}>2</div>
                  <span className={`text-sm font-bold ${pendingFile ? 'text-[#001F3F]' : 'text-slate-500'}`}>Planilha de Compras</span>
                  {pendingFile && <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full uppercase">Pronto</span>}
                </div>
              </div>
              )}

              {/* TWO UPLOAD FIELDS (single mode) */}
              {!batchMode && <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Field 1: Questor */}
                <div
                  className={`relative group cursor-pointer bg-white rounded-3xl shadow-sm border transition-all duration-300 min-h-[260px] flex flex-col overflow-hidden ${
                    isDraggingQuestor
                      ? 'border-amber-400 shadow-amber-100 shadow-lg scale-[1.01]'
                      : questorTotal
                      ? 'border-emerald-300 shadow-emerald-50 shadow-md'
                      : 'border-slate-200 hover:border-amber-300 hover:shadow-md'
                  }`}
                  onClick={() => questorInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingQuestor(true); }}
                  onDragLeave={() => setIsDraggingQuestor(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingQuestor(false); const f = e.dataTransfer.files?.[0]; if (f) parseQuestorImage(f); }}
                >
                  {/* Top accent */}
                  <div className={`h-1.5 w-full transition-all ${questorTotal ? 'bg-emerald-400' : 'bg-amber-400'}`} />

                  <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all ${
                      questorTotal ? 'bg-emerald-50 shadow-emerald-100' : 'bg-amber-50 group-hover:bg-amber-100'
                    }`}>
                      {isParsingQuestor ? <span className="animate-spin">⚙️</span> : questorTotal ? '✅' : '📷'}
                    </div>

                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Passo 1</p>
                      <p className="text-lg font-black text-slate-800">Totais Questor</p>
                      {isParsingQuestor ? (
                        <p className="text-sm text-amber-600 font-semibold animate-pulse">Lendo com IA...</p>
                      ) : (
                        <p className="text-xs text-slate-400">Envie o print ou digite o valor</p>
                      )}
                    </div>

                    {!isParsingQuestor && (
                      <div onClick={e => e.stopPropagation()} className="w-full flex flex-col items-center gap-2">
                        <div className="relative w-full max-w-[200px]">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">R$</span>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={questorTotal !== null ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(questorTotal) : ''}
                            onChange={(e) => {
                              setQuestorFileName(null);
                              const numericStr = e.target.value.replace(/\D/g, '');
                              if (!numericStr) { setQuestorTotal(null); return; }
                              const val = parseInt(numericStr, 10) / 100;
                              setQuestorTotal(val > 0 ? val : null);
                            }}
                            className={`w-full pl-10 pr-4 py-3 border-2 rounded-2xl text-center font-black text-lg outline-none transition-all placeholder:text-slate-200 placeholder:font-normal ${
                              questorTotal
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50 focus:border-emerald-500'
                                : 'border-slate-200 text-[#001F3F] bg-slate-50 focus:border-amber-400'
                            }`}
                          />
                        </div>
                        {questorTotal && (
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                            {questorFileName ? 'Extraído via IA ✅' : 'Inserido manualmente ✅'}
                          </p>
                        )}
                        {questorError && <p className="text-xs text-red-500 font-medium text-center">{questorError}</p>}
                      </div>
                    )}
                  </div>
                  <input ref={questorInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseQuestorImage(f); }} />
                </div>

                {/* Field 2: Excel */}
                <div
                  className={`relative group bg-white rounded-3xl shadow-sm border transition-all duration-300 min-h-[260px] flex flex-col overflow-hidden ${
                    pendingFile
                      ? 'border-[#F5C000] shadow-amber-50 shadow-md cursor-default'
                      : isDragging
                      ? 'border-[#001F3F] shadow-slate-200 shadow-lg scale-[1.01] cursor-pointer'
                      : 'border-slate-200 hover:border-[#001F3F] hover:shadow-md cursor-pointer'
                  }`}
                  onClick={() => { if (!pendingFile) fileInputRef.current?.click(); }}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  {/* Top accent */}
                  <div className={`h-1.5 w-full transition-all ${pendingFile ? 'bg-[#F5C000]' : isDragging ? 'bg-[#001F3F]' : 'bg-slate-200 group-hover:bg-[#001F3F]'}`} />

                  <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
                      pendingFile ? 'bg-emerald-500' : isDragging ? 'bg-[#001F3F]' : 'bg-slate-100 group-hover:bg-[#001F3F]'
                    }`}>
                      {pendingFile
                        ? <CheckCircle2 className="w-7 h-7 text-white" />
                        : <FileUp className={`w-7 h-7 transition-colors ${isDragging ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                      }
                    </div>

                    {pendingFile ? (
                      <>
                        <div className="text-center space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Arquivo pronto</p>
                          <p className="text-sm font-black text-slate-800 truncate max-w-[220px]">{pendingFile.name}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                          >× trocar arquivo</button>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); processFile(pendingFile); }}
                          className="w-full bg-[#001F3F] hover:bg-[#002d5c] text-white font-black text-sm py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-[#001F3F]/20 hover:-translate-y-0.5"
                        >
                          <PlayCircle className="w-5 h-5" />
                          INICIAR ANÁLISE
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-center space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Passo 2</p>
                          <p className="text-lg font-black text-slate-800">
                            {isDragging ? 'Solte aqui!' : 'Planilha de Compras'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {isDragging ? '' : 'Clique ou arraste o arquivo .xlsx'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">.xlsx / .xls — Mín. 4 abas</span>
                        </div>
                      </>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                </div>
              </div>}

              {/* BATCH MODE UI */}
              {batchMode && (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Header */}
                    <div className="h-1.5 bg-[#001F3F]" />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Modo Vários Meses</p>
                          <p className="text-sm text-slate-500">Cada mês vira um <span className="font-bold text-amber-600">rascunho</span> — você abre depois para fazer a contagem do trigo e finalizar</p>
                        </div>
                        {batchDone > 0 && !batchRunning && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 font-black px-3 py-1.5 rounded-full">
                            ✅ {batchDone} {batchDone === 1 ? 'mês salvo' : 'meses salvos'}
                          </span>
                        )}
                      </div>

                      {/* Table rows */}
                      <div className="space-y-3 mb-4">
                        {batchEntries.map((entry, idx) => (
                          <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            entry.status === 'done' ? 'bg-emerald-50 border-emerald-200' :
                            entry.status === 'error' ? 'bg-red-50 border-red-200' :
                            entry.status === 'processing' ? 'bg-amber-50 border-amber-200 animate-pulse' :
                            entry.isParsingQuestor ? 'bg-amber-50 border-amber-200' :
                            'bg-slate-50 border-slate-200'
                          }`}>
                            {/* Row number */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                              entry.status === 'done' ? 'bg-emerald-500 text-white' :
                              entry.status === 'error' ? 'bg-red-400 text-white' :
                              entry.status === 'processing' ? 'bg-amber-400 text-white' :
                              'bg-[#001F3F] text-white'
                            }`}>{idx + 1}</div>

                            {/* File selector */}
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer flex-shrink-0 min-w-[180px] transition-all ${
                              entry.file ? 'bg-white border-[#001F3F]/30 text-[#001F3F]' : 'bg-white border-slate-200 text-slate-400 hover:border-[#001F3F]/30'
                            }`}>
                              <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-[11px] font-bold truncate max-w-[130px]">
                                {entry.file ? entry.file.name : 'Selecionar planilha'}
                              </span>
                              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                setBatchEntries(prev => prev.map(en => en.id === entry.id ? { ...en, file: f } : en));
                              }} />
                            </label>

                            {/* Questor total — tipo + campo */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Digitar */}
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold select-none">R$</span>
                                <input
                                  type="text"
                                  placeholder="0,00"
                                  disabled={entry.isParsingQuestor}
                                  value={entry.questorVal !== null ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entry.questorVal) : ''}
                                  onChange={(e) => {
                                    const numStr = e.target.value.replace(/\D/g, '');
                                    const val = numStr ? parseInt(numStr, 10) / 100 : null;
                                    setBatchEntries(prev => prev.map(en => en.id === entry.id ? { ...en, questorVal: val && val > 0 ? val : null, questorImageName: undefined } : en));
                                  }}
                                  className={`pl-7 pr-2 py-2 border rounded-xl text-xs font-bold w-28 bg-white focus:outline-none placeholder:text-slate-300 transition-all ${
                                    entry.questorVal ? 'border-emerald-300 text-emerald-700' : 'border-slate-200 focus:border-[#001F3F]/40'
                                  } disabled:opacity-50`}
                                />
                              </div>
                              {/* Ou: enviar foto */}
                              <label title="Enviar print do Questor (IA extrai o valor)" className={`flex items-center justify-center w-8 h-8 rounded-xl border cursor-pointer transition-all flex-shrink-0 ${
                                entry.isParsingQuestor
                                  ? 'bg-amber-50 border-amber-200 cursor-wait'
                                  : entry.questorImageName && entry.questorVal
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-500'
                              }`}>
                                {entry.isParsingQuestor
                                  ? <span className="text-[11px] animate-spin">⚙️</span>
                                  : entry.questorImageName && entry.questorVal
                                  ? <span className="text-[11px]">📷</span>
                                  : <span className="text-[13px]">📷</span>
                                }
                                <input
                                  type="file" accept="image/*" className="hidden"
                                  disabled={entry.isParsingQuestor || batchRunning}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parseQuestorForEntry(f, entry.id); e.target.value = ''; }}
                                />
                              </label>
                              {entry.questorImageName && entry.questorVal && (
                                <span className="text-[9px] text-emerald-600 font-black hidden" title={entry.questorImageName}>IA ✅</span>
                              )}
                            </div>

                            {/* Month reference */}
                            <input
                              type="text"
                              placeholder="MM/AAAA"
                              maxLength={7}
                              value={entry.mes}
                              onChange={(e) => {
                                let v = e.target.value.replace(/\D/g, '');
                                if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 6);
                                setBatchEntries(prev => prev.map(en => en.id === entry.id ? { ...en, mes: v } : en));
                              }}
                              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold w-28 bg-white focus:outline-none focus:border-[#001F3F]/40 placeholder:text-slate-300"
                            />

                            {/* Status / remove */}
                            {entry.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                            {entry.status === 'error' && <span className="text-[10px] text-red-600 font-bold flex-shrink-0">{entry.errorMsg}</span>}
                            {entry.status === 'processing' && <span className="text-[10px] text-amber-600 font-black animate-pulse flex-shrink-0">⚙️ Planilha + IA trigo...</span>}
                            {entry.status === 'idle' && batchEntries.length > 1 && (
                              <button
                                onClick={() => setBatchEntries(prev => prev.filter(en => en.id !== entry.id))}
                                className="ml-auto text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                              >
                                <XCircleIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add row + Process */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setBatchEntries(prev => [...prev, { id: `b${Date.now()}`, file: null, questorVal: null, mes: '', status: 'idle' }])}
                          disabled={batchRunning}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar mês
                        </button>
                        <button
                          onClick={processBatch}
                          disabled={batchRunning || !batchEntries.some(e => e.file && e.mes.trim())}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#001F3F] hover:bg-[#002d5c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-2xl transition-all shadow-md shadow-[#001F3F]/20"
                        >
                          {batchRunning ? (
                            <><span className="animate-spin">⚙️</span> Processando...</>
                          ) : (
                            <><PlayCircle className="w-4 h-4" /> Processar e Salvar como Rascunho</>
                          )}
                        </button>
                      </div>
                      {batchDone > 0 && !batchRunning && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                          <p className="text-sm font-black text-emerald-700">✅ {batchDone} {batchDone === 1 ? 'rascunho salvo' : 'rascunhos salvos'}!</p>
                          <p className="text-xs text-emerald-600 mt-1">Abra cada rascunho no Dashboard para fazer a contagem do trigo e finalizar.</p>
                          <button onClick={voltarDashboard} className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 font-bold underline">Ir para o Dashboard →</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium">{error}</p>
                </motion.div>
              )}


            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-2xl">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Auditoria Concluída</h2>
                    <p className="text-gray-500">O arquivo foi reprocessado seguindo as normas fiscais solicitadas.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowModalSalvar(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Save className="w-4 h-4" />
                    Salvar no Histórico
                  </button>
                  <button
                    onClick={() => setShowModalRascunho(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-xs py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Clock className="w-4 h-4" />
                    Salvar Rascunho
                  </button>
                  <button
                    onClick={voltarDashboard}
                    className="bg-white border-2 border-slate-200 hover:border-[#001F3F] text-[#001F3F] font-black uppercase tracking-widest text-xs py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Voltar ao Cliente
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#001F3F] p-8 rounded-3xl text-white shadow-xl shadow-[#001F3F]/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400 rounded-full blur-3xl opacity-20 -mr-10 -mt-10" />
                  <p className="relative text-sky-200 text-[10px] font-bold uppercase tracking-widest mb-2">Economia Total</p>
                  <p className="relative text-4xl font-black tracking-tight drop-shadow-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processedData.summary.totalEconomy)}
                  </p>
                  <p className="relative text-sky-100/70 text-xs mt-4 font-bold tracking-wide italic">Simulação: Normal vs Simples</p>
                </div>
                
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Registros</p>
                    <p className="text-4xl font-black text-gray-800">{processedData.summary.recordCount}</p>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 font-bold text-sm mt-4">
                    <TableIcon className="w-4 h-4" />
                    <span>100% Processado</span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Processamento</p>
                    <p className="text-4xl font-black text-green-600">Completo</p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mt-4">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Integridade Auditada</span>
                  </div>
                </div>
              </div>

              {/* Dashboard Section */}
              <SimplesDashboard
                data={processedData.summary.simplesSuppliers}
                summaryTable={summaryTableEfetiva}
                fileName={processedData.fileName}
                descartados={descartadosTemp}
                onToggleDescartar={(idx) => setDescartadosTemp(prev => {
                  const next = new Set(prev);
                  next.has(idx) ? next.delete(idx) : next.add(idx);
                  return next;
                })}
              />

              {/* Bakery Systematic Panel */}
              <BakeryPanel 
                allProducts={processedData.allProducts} 
                questorTotal={questorTotal} 
                onUpdatePrintData={setWheatPrintData}
                onPrint={() => {
                  setPrintMode('wheat');
                  setTimeout(() => {
                    window.print();
                    setPrintMode('none');
                  }, 500);
                }}
              />

              {/* Inconsistencies List */}

              {/* Actions */}
              <div className="bg-white border border-gray-200 rounded-3xl p-10 flex flex-col items-center gap-6 shadow-sm">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4 w-full max-w-md">
                  <FileSpreadsheet className="w-10 h-10 text-green-600" />
                  <div className="truncate">
                    <p className="font-bold text-gray-800 truncate">{processedData.fileName}</p>
                    <p className="text-xs text-gray-400">Pronto para download • Formato Excel</p>
                  </div>
                </div>
                <button 
                  onClick={downloadFile}
                  className="bg-[#001F3F] hover:bg-[#002d5c] text-white font-bold py-4 px-12 rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg shadow-blue-200 w-full justify-center"
                >
                  <Download className="w-6 h-6" />
                  BAIXAR PLANILHA COMPLETA
                </button>
                
                <button 
                  onClick={downloadFiltered}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-12 rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg shadow-emerald-100 w-full justify-center"
                >
                  <FileSpreadsheet className="w-6 h-6" />
                  BAIXAR APENAS SIMPLES NACIONAL
                </button>

                <p className="text-xs text-slate-400 font-medium text-center">
                  Nota: Todas as fórmulas de ICMS foram substituídas por valores estáticos (arredondados a 2 casas) e a última coluna foi travada conforme solicitado.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>


    </div>

    {/* Printable ICMS Report */}
    {processedData && (
      <div className="mt-20 print:mt-0 print:block">
        <div className="max-w-5xl mx-auto px-6 mb-8 flex items-center justify-between print:hidden">
          <h2 className="text-2xl font-black text-[#001F3F] uppercase tracking-tight">Prévia do Relatório Oficial</h2>
            <button 
              onClick={() => {
                setPrintMode('icms');
                setTimeout(() => {
                  window.print();
                  setPrintMode('none');
                }, 500);
              }}
              className="bg-[#001F3F] hover:bg-[#002d5c] text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
            <Printer className="w-5 h-5" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Imprimir Agora</span>
          </button>
        </div>
        <div className={printMode === 'wheat' ? 'hidden' : 'block'}>
          <PrintableReport
            data={processedData.summary.simplesSuppliers.filter((_, i) => !descartadosTemp.has(i))}
            summaryTable={summaryTableEfetiva}
            fileName={processedData.fileName}
            isFullReport={printMode === 'icms'}
            wheatPrintData={wheatPrintData}
          />
        </div>
      </div>
    )}

    {/* Modal Salvar */}
    {showModalSalvar && processedData && clienteAtivo && (
      <ModalSalvar
        economiaTotal={processedData.summary.totalEconomy}
        nomeCliente={clienteAtivo.nome}
        onConfirm={handleSalvarHistorico}
        onClose={() => setShowModalSalvar(false)}
      />
    )}

    {/* Modal Salvar Rascunho */}
    {showModalRascunho && processedData && clienteAtivo && (
      <ModalSalvarRascunho
        nomeCliente={clienteAtivo.nome}
        onConfirm={(mes, obs) => {
          const rascunho: RascunhoAuditoria = {
            id: `rascunho_${Date.now()}`,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            nomeEmpresa: clienteAtivo.nome,
            mesReferencia: mes,
            observacao: obs || undefined,
            fornecedores: processedData.summary.simplesSuppliers.map((s, i) => ({
              id: `${Date.now()}-${i}`,
              nome: s.name,
              produto: s.productName || '—',
              valorTotal: s.productTotal,
              icmsPago: s.originalValue,
              icmsProjetado: s.newValue,
              economia: s.economy,
              descartado: false,
            })),
            summaryTable: summaryTableEfetiva,
            bakeryItems: (wheatPrintData?.bakeryItems ?? []).map((b: any) => ({
              description: b.description,
              supplier: b.supplier,
              value: b.value,
              ncm: b.ncm,
              selected: b.selected,
              aiConfidence: b.aiConfidence ?? 'low',
            })),
            questorTotal: questorTotal,
          };
          salvarRascunho(rascunho).then(() => setShowModalRascunho(false));
        }}
        onClose={() => setShowModalRascunho(false)}
      />
    )}

    {/* Tela Histórico */}
    {showHistorico && (
      <TelaHistorico onClose={() => setShowHistorico(false)} />
    )}

    {/* Tela Clientes */}
    {showClientes && (
      <TelaClientes onClose={() => setShowClientes(false)} />
    )}

    {/* Printable Wheat Report */}
    {wheatPrintData && printMode === 'wheat' && (
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
                {new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(wheatPrintData.selectedTotal)}
              </p>
            </div>
            <div className="text-right space-y-4">
              <p className="text-sm uppercase tracking-widest font-bold text-slate-400">Total Compras Comercialização</p>
              <p className="text-4xl font-mono font-bold text-slate-800">
                {wheatPrintData.questorTotal ? new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(wheatPrintData.questorTotal) : 'Não informado'}
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
              {wheatPrintData.isOk ? <span className="text-emerald-500">APROVADO</span> : <span className="text-red-500">REPROVADO</span>}
            </div>
          </div>

          <h3 className="text-2xl font-bold bg-[#001F3F] text-white p-4 rounded-t-xl uppercase tracking-widest text-center mt-12">Itens Classificados como Panificação (Marcados com ✓)</h3>
          <table className="w-full text-left text-sm border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 uppercase tracking-widest text-xs font-bold text-slate-500">
                <th className="p-4 border-b">Descrição do Produto (NCM 1101/1901)</th>
                <th className="p-4 border-b">Fornecedor</th>
                <th className="p-4 border-b text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {wheatPrintData.selectedItems.map((item: any, i: number) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-800">{item.description} {item.ncm ? <span className="font-normal text-slate-500 text-xs ml-2">NCM: {item.ncm}</span> : ''}</td>
                  <td className="p-4 text-slate-600 text-xs">{item.supplier}</td>
                  <td className="p-4 text-right font-mono font-bold text-slate-900">{new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(item.value)}</td>
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
    )}
  </div>
);
}
