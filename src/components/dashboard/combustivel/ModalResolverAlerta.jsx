import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

export const ModalResolverAlerta = ({ alerta, onClose, onResolve, loading }) => {
  const [observacao, setObservacao] = useState('');
  const [acaoSelecionada, setAcaoSelecionada] = useState('JUSTIFICADO');
  const [erro, setErro] = useState('');

  if (!alerta) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!observacao.trim() || observacao.trim().length < 5) {
      setErro('A justificativa técnica do gestor é obrigatória (mínimo 5 caracteres).');
      return;
    }
    setErro('');
    onResolve(alerta.id_alerta, {
      status_resolucao: acaoSelecionada,
      justificativa_gestor: observacao.trim(),
      resolvido_por: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeUp">
      <div className="bg-white dark:bg-app-darkSurface border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-rose-500/5 dark:bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>Auditoria de Alerta Anti-Fraude #{alerta.id_alerta}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Card com Detalhes da Infração */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-app-darkSurface2 border border-slate-200/80 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white">
                Placa: {alerta.placa || 'N/A'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
                {alerta.tipo_alerta || 'SUSPEITA_FRAUDE'}
              </span>
            </div>

            <div className="text-slate-700 dark:text-slate-300 font-medium">
              <span className="font-bold">Motivo Detectado:</span>{' '}
              {alerta.descricao_alerta || alerta.motivo_auditoria || 'Anomalia identificada pelo motor anti-fraude'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-white/5">
              <div>
                <span>Posto: </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {alerta.posto_nome_fantasia || alerta.nome_posto || alerta.posto || 'Posto não informado'}
                </span>
              </div>
              <div>
                <span>Combustível: </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{alerta.tipo_combustivel || 'Combustível'}</span>
              </div>
              <div>
                <span>Valor: </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  R$ {Number(alerta.valor_total || alerta.valor_transacao || alerta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span>Volume: </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {Number(alerta.quantidade_litros || alerta.litros_transacao || alerta.litros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L
                </span>
              </div>
            </div>
          </div>

          {/* Seleção de Decisão */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Decisão do Gestor da Frota:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAcaoSelecionada('JUSTIFICADO')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  acaoSelecionada === 'JUSTIFICADO'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="text-xs">Justificar Abastecimento</div>
                  <div className="text-[10px] font-normal opacity-80">Cupom conferido e aprovado</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAcaoSelecionada('CONFIRMADO_FRAUDE')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  acaoSelecionada === 'CONFIRMADO_FRAUDE'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <AlertOctagon className="w-4 h-4 mt-0.5 text-rose-500 flex-shrink-0" />
                <div>
                  <div className="text-xs">Confirmar Irregularidade</div>
                  <div className="text-[10px] font-normal opacity-80">Encaminhar para sindicância</div>
                </div>
              </button>
            </div>
          </div>

          {/* Campo de Justificativa Obrigatório */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Justificativa Obrigatória de Auditoria:</span>
              <span className="text-[10px] text-slate-400 font-normal">Mínimo 5 caracteres</span>
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Abastecimento regular conferido com nota física e telemetria da rota do técnico..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-app-darkSurface2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
            />
            {erro && <p className="text-rose-500 text-[11px] font-bold">{erro}</p>}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando Auditoria...</span>
                </>
              ) : (
                <span>Salvar Resolução</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
