import React, { useState } from 'react';
import { FileCheck2, Calculator, AlertTriangle, CheckCircle2, Calendar, FileText, ArrowDownRight } from 'lucide-react';

export const CombustivelFiscal = ({
  faturamentos = [],
  estornos = [],
  loading = false,
  onConciliar,
  conciliando = false,
}) => {
  const hojeIso = new Date().toISOString().split('T')[0];
  const quinzeDiasAtrasIso = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(quinzeDiasAtrasIso);
  const [dataFim, setDataFim] = useState(hojeIso);
  const [numeroTitulo, setNumeroTitulo] = useState('');
  const [erro, setErro] = useState('');

  const handleConciliarSubmit = (e) => {
    e.preventDefault();
    if (!dataInicio || !dataFim) {
      setErro('Informe o período completo para conciliação contábil.');
      return;
    }
    setErro('');
    onConciliar({
      dataInicio,
      dataFim,
      numeroTitulo: numeroTitulo.trim(),
    });
  };

  return (
    <div className="space-y-4">
      {/* Box de Ação de Conciliação */}
      <div className="p-5 bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-800 dark:text-white">
              Conciliação Contábil Automatizada (Fatura x Cupons)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Consolida todos os abastecimentos do período e compara contra o faturamento oficial da ValeCard (Webservice 09).
            </p>
          </div>
        </div>

        <form onSubmit={handleConciliarSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Data Início:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-app-darkSurface2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Data Fim:</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-app-darkSurface2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nº Nota Fiscal / Título:</label>
            <input
              type="text"
              value={numeroTitulo}
              onChange={(e) => setNumeroTitulo(e.target.value)}
              placeholder="Ex: NF-102026"
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-app-darkSurface2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={conciliando}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {conciliando ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Auditando Fatura...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Executar Conciliação</span>
                </>
              )}
            </button>
          </div>
        </form>

        {erro && <p className="text-rose-500 text-[11px] font-bold mt-2">{erro}</p>}
      </div>

      {/* Histórico de Faturamentos Auditados */}
      <div className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-500" />
            <span>Faturamentos e Fechamentos Contábeis</span>
          </div>
          <span className="text-[11px] text-slate-400">Regra de Divergência Contábil: &gt; R$ 0,05</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando fechamentos fiscais...</div>
          ) : faturamentos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhum faturamento conciliado ainda</p>
              <p className="text-[11px]">Utilize o formulário acima para disparar a auditoria quinzenal da fatura.</p>
            </div>
          ) : (
            faturamentos.map((f) => {
              const divergenciaVal = Number(f.divergencia_contabil ?? f.divergencia ?? 0);
              const valorFatura = Number(f.valor_liquido ?? f.valor_total_fatura ?? 0);
              const statusFat = f.status_faturamento || f.status_conciliacao;
              const isDivergente = statusFat === 'DIVERGENTE' || Math.abs(divergenciaVal) > 0.05;

              return (
                <div
                  key={f.id_faturamento || f.numero_titulo}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-app-darkSurface2 text-slate-800 dark:text-white">
                        {f.numero_titulo || 'NF-SEM-TITULO'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDivergente
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDivergente ? '⚠️ DIVERGÊNCIA IDENTIFICADA' : '✅ CONCILIADO'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Período: {f.data_inicio} até {f.data_fim} • {f.total_transacoes || 0} abastecimentos conferidos
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Valor Fatura ValeCard</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                        R$ {valorFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Divergência Contábil</div>
                      <div
                        className={`font-mono font-black text-sm ${
                          isDivergente ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        R$ {divergenciaVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Box de Estornos */}
      {estornos.length > 0 && (
        <div className="p-4 bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card">
          <div className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
            <span>Estornos & Cancelamentos Auditados ({estornos.length})</span>
          </div>
          <div className="space-y-2 text-xs">
            {estornos.map((est) => (
              <div key={est.id_estorno} className="p-2.5 rounded-xl bg-slate-50 dark:bg-app-darkSurface2 flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mr-2">{est.placa}</span>
                  <span className="text-slate-500">
                    {est.posto_nome_fantasia || est.status_estorno || est.motivo || 'Estorno automático ValeCard'}
                  </span>
                </div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  R$ {Number(est.valor_total ?? est.valor ?? 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
