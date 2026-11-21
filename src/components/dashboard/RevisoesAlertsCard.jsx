import React from 'react';
import { Wrench, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';

export const RevisoesAlertsCard = ({ veiculosRevisao = [] }) => {
  const defaultList = [
    { id: 1, placa: 'TBP2B47', modelo: 'Renault Kwid Zen 1.0', atp: 'ATP São Paulo', hodometro: '32.281', restanteKm: 0, status: 'vencida' },
    { id: 2, placa: 'TBP2A57', modelo: 'Renault Kwid Zen 1.0', atp: 'ATP Curitiba', hodometro: '20.578', restanteKm: 0, status: 'vencida' },
    { id: 3, placa: 'TBP0H83', modelo: 'Renault Kwid Zen 1.0', atp: 'ATP Curitiba', hodometro: '20.135', restanteKm: 0, status: 'vencida' },
    { id: 4, placa: 'TBP2B40', modelo: 'Renault Kwid Zen 1.0', atp: 'ATP São Paulo', hodometro: '19.616', restanteKm: 384, status: 'critica' },
    { id: 5, placa: 'TJQ1J96', modelo: 'Renault Kwid Zen 1.0', atp: 'ATP Rio de Janeiro', hodometro: '9.456', restanteKm: 544, status: 'atencao' },
  ];

  const list = veiculosRevisao.length > 0 ? veiculosRevisao : defaultList;

  const getStatusBadge = (status, restanteKm) => {
    switch (status) {
      case 'vencida':
        return {
          label: 'Vencida',
          badge: 'fleet-alert-vencida',
        };
      case 'critica':
        return {
          label: `< ${restanteKm} Km`,
          badge: 'fleet-alert-vencida',
        };
      case 'atencao':
        return {
          label: `${restanteKm} Km`,
          badge: 'fleet-alert-proxima',
        };
      default:
        return {
          label: 'Em Dia',
          badge: 'fleet-alert-em-dia',
        };
    }
  };

  return (
    <div className="fleet-card-surface rounded-2xl p-5 flex flex-col justify-between">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
              Revisões Periódicas Arval
            </h3>
            <span className="p-1 rounded-lg fleet-surface-muted text-slate-600 dark:text-slate-300">
              <Wrench className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
            Ciclo preventivo de 10.000 km contratual da locadora
          </p>
        </div>
        <span className="text-[10px] font-bold fleet-surface-muted text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
          Garantia Ativa
        </span>
      </div>

      {/* Lista Compacta de Veículos */}
      <div className="divide-y divide-slate-100 dark:divide-white/5 my-2">
        {list.slice(0, 5).map((item, idx) => {
          const badgeInfo = getStatusBadge(item.status, item.restanteKm);
          return (
            <div
              key={item.id || idx}
              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-white/[0.01] px-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-[11px] font-bold text-slate-400 w-5">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shrink-0">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                    {item.placa}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {item.modelo} • {item.atp}
                  </div>
                </div>
              </div>

              {/* Badge de Status da Revisão */}
              <div
                className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold border shrink-0 ${badgeInfo.badge}`}
              >
                {badgeInfo.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé Informativo */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>Tolerância Arval: ± 500 Km</span>
        <span className="font-semibold text-slate-600 dark:text-fleet-bronze">
          Rede Credenciada
        </span>
      </div>
    </div>
  );
};

