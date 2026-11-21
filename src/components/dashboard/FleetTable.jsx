import React, { useState, useEffect } from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { MercosulPlate } from '../common/MercosulPlate';
import { formatVehicleShortName, formatPropriedadeLabel } from '../../utils/vehicleFormatters';
import { Eye, UserCheck, AlertTriangle } from 'lucide-react';

const NO_DRIVER_LABELS = {
  disponivel: 'Disponível no Pátio',
  manutencao: 'Em Oficina (Sem Condutor)',
  sinistrado: 'Sinistrado (Sem Condutor)',
  em_uso: 'Condutor não vinculado',
};

export const FleetTable = ({ veiculos = [], onSelectVeiculo }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Reseta para a primeira página sempre que os veículos mudarem (ex: filtros de busca/região)
  useEffect(() => {
    setCurrentPage(1);
  }, [veiculos]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedVeiculos = veiculos.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="fleet-card-surface rounded-2xl overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-fleet-graphite/80 border-b border-slate-200/80 dark:border-fleet-titanium/45 text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-5">Placa & Propriedade</th>
              <th className="py-3.5 px-4">Modelo / Ano</th>
              <th className="py-3.5 px-4">Base Operacional (ATP)</th>
              <th className="py-3.5 px-4">Condutor Atual</th>
              <th className="py-3.5 px-4">Hodômetro</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {veiculos.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  Nenhum veículo encontrado com os filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedVeiculos.map((v) => (
                <tr
                  key={v.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  onClick={() => onSelectVeiculo?.(v)}
                >
                  {/* Placa & Propriedade */}
                  <td className="py-3.5 px-5">
                    <div className="flex flex-col items-start gap-1.5">
                      <MercosulPlate placa={v.placa} size="sm" />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-tight pl-0.5">
                        {formatPropriedadeLabel(v.propriedade)}
                      </span>
                    </div>
                  </td>

                  {/* Modelo */}
                  <td className="py-3.5 px-4">
                    <div
                      className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                      title={v.modelo}
                    >
                      {formatVehicleShortName(v.modelo, v.ano)}
                    </div>
                  </td>

                  {/* ATP */}
                  <td className="py-3.5 px-4">
                    <div
                      className="text-slate-700 dark:text-slate-300 font-medium"
                      title={v.atp || undefined}
                    >
                      {v.baseCidade || v.atp || 'Base não definida'}
                    </div>
                    <div className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                      {[v.uf, v.regiao].filter(Boolean).join(' • ') || '—'}
                    </div>
                  </td>

                  {/* Condutor */}
                  <td className="py-3.5 px-4">
                    {v.tecnicoAlocado ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          {v.condutorAtivo === false ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Condutor inativo no RH" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                          <span>{v.tecnicoAlocado}</span>
                        </div>
                        {v.condutorAtivo === false && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 pl-5">
                            Inativo no RH • Revisar custódia
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        className={
                          v.status === 'em_uso'
                            ? 'text-amber-600 dark:text-amber-400 italic font-medium'
                            : 'text-slate-400 italic'
                        }
                      >
                        {NO_DRIVER_LABELS[v.status] || 'Sem condutor vinculado'}
                      </span>
                    )}
                  </td>

                  {/* Hodômetro */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {Number(v.hodometro || 0).toLocaleString('pt-BR')} km
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <StatusBadge status={v.status} />
                  </td>

                  {/* Ações */}
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVeiculo?.(v);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-brand-50 hover:text-brand-600 dark:bg-white/5 dark:hover:bg-brand-500/20 dark:hover:text-brand-300 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de Paginação (15 itens por página) */}
      <Pagination
        currentPage={currentPage}
        totalItems={veiculos.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="veículos"
      />
    </div>
  );
};
