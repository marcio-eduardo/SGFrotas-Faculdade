import React, { useState } from 'react';
import { CreditCard, RefreshCw, PlusCircle, AlertCircle, TrendingUp, History, ShieldAlert } from 'lucide-react';
import { ModalAlterarLimite } from './ModalAlterarLimite';
import { ModalSolicitar2Via } from './ModalSolicitar2Via';

export const CombustivelCartoes = ({
  cartoes = [],
  solicitacoes = [],
  loading = false,
  onSyncCartoes,
  onAlterarLimite,
  onSolicitar2Via,
  actionLoading = false,
}) => {
  const [selectedCartaoParaLimite, setSelectedCartaoParaLimite] = useState(null);
  const [selectedCartaoPara2Via, setSelectedCartaoPara2Via] = useState(null);
  const [abaInterna, setAbaInterna] = useState('cartoes'); // 'cartoes' | 'solicitacoes'

  return (
    <div className="space-y-4">
      {/* Barra de Ações & Navegação Interna */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaInterna('cartoes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              abaInterna === 'cartoes'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cartões Ativos ({cartoes.length})</span>
          </button>
          <button
            onClick={() => setAbaInterna('solicitacoes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              abaInterna === 'solicitacoes'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de 2ª Via ({solicitacoes.length})</span>
          </button>
        </div>

        <button
          onClick={onSyncCartoes}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-app-darkSurface2 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors border border-slate-200/60 dark:border-white/5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sincronizar Base ValeCard</span>
        </button>
      </div>

      {/* Visão de Cartões */}
      {abaInterna === 'cartoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cartoes.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">Nenhum cartão cadastrado ainda</p>
              <p className="text-xs text-slate-400 mt-1">Sincronize com a ValeCard para baixar a base de cartões da frota.</p>
            </div>
          ) : (
            cartoes.map((c) => {
              const isAtivo = c.status_cartao === 'ATIVO' || c.status === 'ativo';
              return (
                <div
                  key={c.id_cartao || c.numero_cartao}
                  className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-card hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Veículo / Placa</div>
                      <div className="font-mono font-black text-lg text-slate-900 dark:text-white mt-0.5">
                        {c.placa || 'Sem Placa'}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isAtivo
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {c.status_cartao || c.status || (isAtivo ? 'ATIVO' : 'BLOQUEADO')}
                    </span>
                  </div>

                  {/* Número do Cartão */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-app-darkSurface2 border border-slate-100 dark:border-white/5 font-mono text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-sans">Nº Cartão:</span>
                    <span className="font-bold tracking-wider">
                      •••• •••• •••• {c.numero_cartao ? c.numero_cartao.slice(-4) : '0000'}
                    </span>
                  </div>

                  {/* Saldos */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Saldo Disponível</div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                        R$ {Number(c.saldo_disponivel ?? c.saldo_atual ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Limite Período</div>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm mt-0.5">
                        R$ {Number(c.limite_atual || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Cartão */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={() => setSelectedCartaoParaLimite(c)}
                      className="px-2.5 py-1.5 rounded-xl border border-brand-500/30 hover:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-[11px] transition-colors flex items-center justify-center gap-1"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Ajustar Limite</span>
                    </button>
                    <button
                      onClick={() => setSelectedCartaoPara2Via(c)}
                      className="px-2.5 py-1.5 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] transition-colors flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Pedir 2ª Via</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Visão de Histórico de Solicitações de 2ª Via */}
      {abaInterna === 'solicitacoes' && (
        <div className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-white/5 font-bold text-xs text-slate-700 dark:text-slate-200">
            Pedidos de 2ª Via de Cartão Auditados
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {solicitacoes.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Nenhum pedido de 2ª via registrado recentemente.</div>
            ) : (
              solicitacoes.map((s) => (
                <div key={s.id_solicitacao} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white">
                        {s.placa}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {s.motivo || 'Motivo operacional'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Cartão Anterior: •••• {(s.numero_cartao_anterior || s.numero_cartao || '----').slice(-4)} • Solicitado em{' '}
                      {s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : 'Data recente'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {s.status_solicitacao || 'PROCESSADO'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modais Integrados */}
      {selectedCartaoParaLimite && (
        <ModalAlterarLimite
          cartao={selectedCartaoParaLimite}
          onClose={() => setSelectedCartaoParaLimite(null)}
          onConfirm={(payload) => {
            onAlterarLimite(payload);
            setSelectedCartaoParaLimite(null);
          }}
          loading={actionLoading}
        />
      )}

      {selectedCartaoPara2Via && (
        <ModalSolicitar2Via
          cartao={selectedCartaoPara2Via}
          onClose={() => setSelectedCartaoPara2Via(null)}
          onConfirm={(payload) => {
            onSolicitar2Via(payload);
            setSelectedCartaoPara2Via(null);
          }}
          loading={actionLoading}
        />
      )}
    </div>
  );
};
