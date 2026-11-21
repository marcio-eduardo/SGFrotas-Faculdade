import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, Truck, Search, AlertCircle } from 'lucide-react';
import { Pagination } from '../../common/Pagination';

export const CombustivelBloqueio = ({
  veiculos = [],
  loading = false,
  onBloquearBomba,
  actionLoading = false,
}) => {
  const [busca, setBusca] = useState('');
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [bloquearTarget, setBloquearTarget] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const veiculosFiltrados = veiculos.filter((v) => {
    const q = busca.toLowerCase();
    return (
      (v.placa && v.placa.toLowerCase().includes(q)) ||
      (v.modelo && v.modelo.toLowerCase().includes(q))
    );
  });

  // Reseta para a página 1 ao alterar busca ou total de veículos
  useEffect(() => {
    setCurrentPage(1);
  }, [busca, veiculos.length]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedVeiculos = veiculosFiltrados.slice(startIndex, startIndex + PAGE_SIZE);

  const abrirModalConfirmacao = (veiculo, bloquear) => {
    setSelectedVeiculo(veiculo);
    setBloquearTarget(bloquear);
    setMotivo(
      bloquear
        ? 'Veículo recolhido para manutenção preventiva / corretiva na concessionária'
        : 'Veículo liberado da oficina para operação de campo'
    );
  };

  const handleConfirmar = (e) => {
    e.preventDefault();
    if (!selectedVeiculo) return;
    onBloquearBomba({
      placa: selectedVeiculo.placa,
      bloquear: bloquearTarget,
      motivo,
    });
    setSelectedVeiculo(null);
  };

  return (
    <div className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card overflow-hidden">
      {/* Header com Instruções & Busca */}
      <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-500" />
            <span>Bloqueio Preventivo na Bomba (Oficina & Sinistro)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Veículos com status ValeCard 10 ("Fora de Uso") têm tentativas de abastecimento recusadas na máquina do posto.
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por placa ou modelo..."
            className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-app-darkSurface2 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          />
        </div>
      </div>

      {/* Lista de Veículos */}
      <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando lista de veículos...</div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nenhum veículo encontrado para os critérios de busca.</div>
        ) : (
          paginatedVeiculos.map((v) => {
            const isBloqueado =
              v.bloqueio_abastecimento === true ||
              v.bloqueado_bomba === true ||
              String(v.codigo_status || '') === '10' ||
              v.status_valecard === 'FORA_DE_USO' ||
              v.status_valecard === '10' ||
              v.status_operacional === 'OFICINA';

            return (
              <div
                key={v.id_veiculo || v.placa}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl flex-shrink-0 ${
                      isBloqueado
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isBloqueado ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-app-darkSurface2 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white">
                        {v.placa}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {v.modelo || 'Modelo não informado'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isBloqueado
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isBloqueado ? 'BLOQUEADO NA BOMBA' : 'LIBERADO'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1">
                      Status Operacional: <span className="font-medium text-slate-600 dark:text-slate-300">{v.status_operacional || 'ATIVO'}</span> • ATP:{' '}
                      <span className="font-medium text-slate-600 dark:text-slate-300">{v.base_nome || 'Central'}</span>
                    </div>
                  </div>
                </div>

                {/* Botão de Alternância */}
                <div>
                  {isBloqueado ? (
                    <button
                      onClick={() => abrirModalConfirmacao(v, false)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Desbloquear Bomba</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => abrirModalConfirmacao(v, true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Travar na Bomba</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de Paginação (15 veículos por página) */}
      <Pagination
        currentPage={currentPage}
        totalItems={veiculosFiltrados.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="veículos"
      />

      {/* Modal de Confirmação de Bloqueio/Desbloqueio */}
      {selectedVeiculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeUp">
          <div className="bg-white dark:bg-app-darkSurface border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-white">
                <ShieldAlert className="w-5 h-5 text-brand-500" />
                <span>
                  {bloquearTarget ? 'Confirmar Bloqueio na Bomba' : 'Confirmar Liberação do Abastecimento'}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmar} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Você está prestes a {bloquearTarget ? 'bloquear o abastecimento' : 'liberar o abastecimento'} do veículo{' '}
                <strong className="font-mono text-brand-600 dark:text-brand-400">{selectedVeiculo.placa}</strong>.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Motivo do Bloqueio:</label>
                <textarea
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-app-darkSurface2 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedVeiculo(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-sm ${
                    bloquearTarget ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {actionLoading ? 'Processando...' : 'Confirmar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
