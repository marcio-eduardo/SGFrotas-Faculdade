import React, { useState } from 'react';
import { X, DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export const ModalAlterarLimite = ({ cartao, onClose, onConfirm, loading }) => {
  const [tipoOperacao, setTipoOperacao] = useState('AUMENTAR');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  if (!cartao) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const valNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valNum) || valNum <= 0) {
      setErro('Informe um valor monetário válido maior que zero.');
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 5) {
      setErro('O motivo da alteração de limite é obrigatório (mínimo 5 caracteres).');
      return;
    }

    setErro('');
    onConfirm({
      placa: cartao.placa,
      numeroCartao: cartao.numero_cartao || null,
      tipoOperacao: tipoOperacao.toLowerCase(),
      valor_alteracao: valNum,
      valor: valNum,
      motivo: motivo.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeUp">
      <div className="bg-white dark:bg-app-darkSurface border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold text-sm">
            <DollarSign className="w-5 h-5" />
            <span>Alteração de Limite na Bomba</span>
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
          {/* Identificação do Veículo */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-app-darkSurface2 border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Veículo / Placa</div>
              <div className="font-mono font-black text-sm text-slate-900 dark:text-white">{cartao.placa}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Saldo Atual</div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                R$ {Number(cartao.saldo_disponivel ?? cartao.saldo_atual ?? cartao.limite_atual ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Tipo de Operação */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">Tipo de Ajuste:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoOperacao('AUMENTAR')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  tipoOperacao === 'AUMENTAR'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Aumentar Limite</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoOperacao('DIMINUIR')}
                className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  tipoOperacao === 'DIMINUIR'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>Diminuir Limite</span>
              </button>
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Valor do Ajuste (R$):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
              <input
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-app-darkSurface2 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Motivo Operacional Obrigatório:
            </label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Rota emergencial de suporte além da franquia semanal..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-app-darkSurface2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
            />
            {erro && <p className="text-rose-500 text-[11px] font-bold">{erro}</p>}
          </div>

          {/* Ações */}
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
                  <span>Enviando para ValeCard...</span>
                </>
              ) : (
                <span>Confirmar Ajuste</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
