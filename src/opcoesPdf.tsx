import React, { useState } from 'react';
import { FileText, Wheat, BarChart2, X, Check } from 'lucide-react';

export interface OpcoesPdfIcms { trigo: boolean; ranking: boolean }

function Opcao({ ativa, onToggle, icone, titulo, descricao }: { ativa: boolean; onToggle: () => void; icone: React.ReactNode; titulo: string; descricao: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 w-full px-4 py-3 border rounded-xl transition-colors text-left ${ativa ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
    >
      {icone}
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">{titulo}</p>
        <p className="text-xs text-slate-400">{descricao}</p>
      </div>
      <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${ativa ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
        {ativa && <Check className="w-3.5 h-3.5 text-white" />}
      </span>
    </button>
  );
}

/** Pergunta o que entra no PDF ICMS. Só mostra as opções que existem na apuração. */
export function ModalOpcoesPdfIcms({ temTrigo, temRanking, onGerar, onCancelar }: {
  temTrigo: boolean;
  temRanking: boolean;
  onGerar: (op: OpcoesPdfIcms) => void;
  onCancelar: () => void;
}) {
  const [trigo, setTrigo] = useState(true);
  const [ranking, setRanking] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-sky-500 p-2 rounded-xl"><FileText className="w-4 h-4 text-white" /></div>
            <h3 className="text-base font-black text-slate-800">PDF ICMS</h3>
          </div>
          <button onClick={onCancelar} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <p className="text-sm text-slate-500">O que deseja incluir junto com o impacto tributário dos fornecedores Simples?</p>
        <div className="flex flex-col gap-2">
          {temTrigo && (
            <Opcao
              ativa={trigo}
              onToggle={() => setTrigo(v => !v)}
              icone={<Wheat className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              titulo="Sistemática de Trigo"
              descricao="Inclui a validação dos 7% e insumos de panificação"
            />
          )}
          {temRanking && (
            <Opcao
              ativa={ranking}
              onToggle={() => setRanking(v => !v)}
              icone={<BarChart2 className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              titulo="Ranking do ICMS por grupo"
              descricao="Página com os 10 grupos de produtos que mais geraram ICMS antecipado"
            />
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancelar} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onGerar({ trigo: temTrigo && trigo, ranking: temRanking && ranking })}
            className="flex-1 py-2.5 bg-[#001F3F] hover:bg-[#002d5c] text-white rounded-xl text-sm font-bold transition-colors"
          >
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
