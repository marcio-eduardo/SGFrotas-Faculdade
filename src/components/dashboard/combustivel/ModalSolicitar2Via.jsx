import React, { useState } from 'react';
import { X, CreditCard, AlertCircle } from 'lucide-react';

export const ModalSolicitar2Via = ({ cartao, onClose, onConfirm, loading }) => {
  const [motivo, setMotivo] = useState('Cartão com chip danificado ilegível na máquina do posto');
  const [detalhes, setDetalhes] = useState('');
  const [erro, setErro] = useState('');

  if (!cartao) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const motivoFinal = detalhes.trim() ? `${motivo} - ${detalhes.trim()}` : motivo;
    if (!motivoFinal) {
      setErro('Informe o motivo da solicitação da 2ª via.');
      return;
    }
    setErro('');
    onConfirm({
      numeroCartao: cartao.numero_cartao,
      placa: cartao.placa,
      motivo: motivoFinal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeUp">
      <div className="bg-white dark:bg-app-darkSurface border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <CreditCard className="w-5 h-5" />
            <span>Solicitar 2ª Via de Cartão</span>
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
          {/* Card Warning */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
            ⚠️ <strong>Atenção:</strong> Ao solicitar a 2ª via, o cartão atual{' '}
            <span className="font-mono font-bold">•••• {cartao.numero_cartao?.slice(-4) || '----'}</span> do veículo{' '}
            <span className="font-mono font-bold">{cartao.placa}</span> será cancelado preventivamente na ValeCard.
          </div>

          {/* Motivo Pré-definido */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">Motivo Principal:</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-app-darkSurface2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
            >
              <option value="Cartão com chip danificado ilegível na máquina do posto">Chip danificado / Ilegível</option>
              <option value="Perda do cartão físico pelo condutor">Perda do cartão físico</option>
              <option value="Furto / Roubo do cartão de abastecimento">Furto / Roubo</option>
              <option value="Desgaste físico da tarja magnética">Desgaste físico da tarja</option>
            </select>
          </div>

          {/* Detalhes Adicionais */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Observações Complementares (Opcional):
            </label>
            <textarea
              rows={2}
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              placeholder="Ex: Ocorrido durante rota em posto de rodovia no interior..."
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
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Solicitando na ValeCard...</span>
                </>
              ) : (
                <span>Confirmar Pedido</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
