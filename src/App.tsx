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
  FileText
} from 'lucide-react';
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

function SimplesDashboard({ data, summaryTable, fileName }: { data: SimplesSupplierData[], summaryTable: SummaryRow[], fileName: string }) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

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
      {summaryTable.length > 0 && (
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
              {summaryTable.map((row, idx) => {
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


    </div>
  );
}

// =====================================================
// BAKERY PANEL COMPONENT (AUTO-TRIGGER, NCM-FILTERED)
// =====================================================
function BakeryPanel({ allProducts, questorTotal, onUpdatePrintData, onPrint }: { allProducts: ProcessedData['allProducts']; questorTotal: number | null; onUpdatePrintData?: (data: any) => void; onPrint?: () => void }) {
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('groqApiKey') || '';
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [bakeryItems, setBakeryItems] = React.useState<BakeryItem[]>([]);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Auto-trigger analysis when allProducts is available
  React.useEffect(() => {
    if (allProducts && allProducts.length > 0 && groqApiKey && !analyzed) {
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

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 2000
          })
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
      setAnalysisError(err instanceof Error ? err.message : 'Erro ao analisar com IA.');
    } finally {
      setIsAnalyzing(false);
    }
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

        {/* Error */}
        {analysisError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium space-y-2">
            <p className="font-bold">⚠️ Erro na análise: {analysisError}</p>
            <button onClick={() => { setAnalyzed(false); }} className="text-xs underline text-red-600">Tentar novamente</button>
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

export default function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingQuestor, setIsDraggingQuestor] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [printMode, setPrintMode] = useState<'none' | 'icms' | 'wheat'>('none');
  const [wheatPrintData, setWheatPrintData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const questorInputRef = useRef<HTMLInputElement>(null);
  // Questor state
  const [questorTotal, setQuestorTotal] = useState<number | null>(null);
  const [isParsingQuestor, setIsParsingQuestor] = useState(false);
  const [questorFileName, setQuestorFileName] = useState<string | null>(null);
  const [questorError, setQuestorError] = useState<string | null>(null);

  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || sessionStorage.getItem('groqApiKey') || '';

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
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } }
          ]}],
          temperature: 0, max_tokens: 500
        })
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    
    if ('target' in event && (event.target as HTMLInputElement).files) {
      file = (event.target as HTMLInputElement).files?.[0];
    } else if ('dataTransfer' in event) {
      event.preventDefault();
      file = event.dataTransfer.files?.[0];
    }

    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setIsDragging(false);

    try {
      const reader = new FileReader();
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

          setProcessedData({
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
          setIsProcessing(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Erro ao ler o arquivo.');
      setIsProcessing(false);
    }
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
    handleFileUpload(e);
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

      {/* Header Premium */}
      <header className="bg-[#001F3F] border-b border-[#002d5c] py-5 px-8 flex items-center justify-between sticky top-0 z-10 shadow-lg print:hidden">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/10">
            <ShieldCheck className="text-sky-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">Auditoria Consistência ICMS</h1>
            <p className="text-[10px] text-sky-200 font-bold uppercase tracking-[0.2em] mt-0.5">Módulo Especialista • V2.5</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Sistema Operacional</span>
          </div>
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
              <div className="text-center space-y-3 mb-10 pt-4">
                <div className="inline-flex justify-center items-center px-4 py-1.5 rounded-full bg-[#001F3F]/5 border border-[#001F3F]/10 mb-2">
                  <span className="text-xs font-black text-[#001F3F] uppercase tracking-[0.2em]">Painel do Auditor</span>
                </div>
                <h2 className="text-4xl font-light text-slate-800 tracking-tight">
                  Auditoria de <span className="font-black text-[#001F3F]">Consistência de ICMS</span>
                </h2>
                <p className="text-slate-500 max-w-2xl mx-auto text-lg pt-2 leading-relaxed">
                  Preencha os campos abaixo para uma análise em lote. Inclui a validadora de itens de <strong className="text-slate-700">Sistemática de Panificação</strong> guiada por IA.
                </p>
              </div>

              {/* TWO UPLOAD FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Field 1: Questor Image or Manual Input */}
                <div
                  className={`relative group cursor-pointer bg-white border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-300 min-h-[280px] ${
                    isDraggingQuestor ? 'border-amber-500 bg-amber-50 scale-[1.02]' : questorTotal ? 'border-emerald-400 bg-emerald-50 hover:border-emerald-500' : 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                  onClick={() => questorInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingQuestor(true); }}
                  onDragLeave={() => setIsDraggingQuestor(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingQuestor(false); const f = e.dataTransfer.files?.[0]; if (f) parseQuestorImage(f); }}
                >
                  <div className={`p-4 rounded-2xl transition-all shadow-sm ${
                    questorTotal ? 'bg-emerald-500 text-white' : isDraggingQuestor ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white'
                  }`}>
                    {isParsingQuestor ? (
                      <span className="text-3xl animate-spin block">⚙️</span>
                    ) : questorTotal ? (
                      <CheckCircle2 className="w-8 h-8" />
                    ) : (
                      <span className="text-3xl block">📷</span>
                    )}
                  </div>
                  <div className="text-center w-full px-2 space-y-2">
                    <p className="text-sm font-bold uppercase tracking-widest text-[#001F3F]">
                      Passo 1 — Totais Questor
                    </p>
                    {isParsingQuestor ? (
                      <p className="text-sm font-bold text-amber-700 animate-pulse">Lendo relatório com IA...</p>
                    ) : (
                      <div className="flex flex-col items-center gap-2 pt-2" onClick={e => e.stopPropagation()}>
                        {!questorTotal && <p className="text-xs text-gray-500">Envie o print ou digite o valor abaixo:</p>}
                        <div className="relative group/input mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                          <input 
                            type="text" 
                            placeholder="0,00"
                            value={questorTotal !== null ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(questorTotal) : ''}
                            onChange={(e) => {
                              setQuestorFileName(null);
                              const numericStr = e.target.value.replace(/\D/g, '');
                              if (!numericStr) {
                                setQuestorTotal(null);
                                return;
                              }
                              const val = parseInt(numericStr, 10) / 100;
                              setQuestorTotal(val > 0 ? val : null);
                            }}
                            className={`w-[180px] bg-white border-2 text-center font-black text-xl rounded-xl py-2 pl-8 pr-4 outline-none transition-all placeholder:text-slate-300 placeholder:font-medium ${questorTotal ? 'border-emerald-300 text-emerald-700 focus:border-emerald-500 bg-emerald-50/50' : 'border-slate-200 text-[#001F3F] focus:border-amber-400 shadow-sm'}`}
                          />
                        </div>
                        {questorTotal && (
                           <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                             {questorFileName ? 'Extraído via IA ✅' : 'Valor manual inserido ✅'}
                           </p>
                        )}
                      </div>
                    )}
                  </div>
                  {questorError && <p className="text-xs text-red-600 font-medium text-center absolute bottom-3">{questorError}</p>}
                  <input ref={questorInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseQuestorImage(f); }} />
                </div>

                {/* Field 2: Excel */}
                <div
                  className={`relative group cursor-pointer bg-white border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-5 transition-all duration-300 min-h-[280px] ${
                    isDragging ? 'border-emerald-500 bg-emerald-50 scale-[1.02]' : 'border-slate-200 hover:border-[#001F3F] hover:bg-slate-50/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <div className={`p-5 rounded-2xl transition-all ${
                    isDragging ? 'bg-emerald-500' : 'bg-slate-100 group-hover:bg-[#001F3F]'
                  }`}>
                    <FileUp className={`w-10 h-10 transition-colors ${ isDragging ? 'text-white' : 'text-slate-400 group-hover:text-white' }`} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold uppercase tracking-widest text-[#001F3F]">
                      Passo 2 — Planilha de Compras
                    </p>
                    <p className="text-base font-bold text-gray-700">
                      {isDragging ? 'Solte para auditar' : 'Clique ou arraste a planilha'}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>.xlsx / .xls — Mínimo 4 abas</span>
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                </div>
              </div>

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
                <button 
                  onClick={reset}
                  className="bg-white border-2 border-slate-200 hover:border-[#001F3F] text-[#001F3F] font-black uppercase tracking-widest text-xs py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="text-lg leading-none">🔄</span>
                  Começar Nova Auditoria
                </button>
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
                summaryTable={processedData.summary.summaryTable} 
                fileName={processedData.fileName}
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
            data={processedData.summary.simplesSuppliers} 
            summaryTable={processedData.summary.summaryTable} 
            fileName={processedData.fileName}
            isFullReport={printMode === 'icms'}
            wheatPrintData={wheatPrintData}
          />
        </div>
      </div>
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
