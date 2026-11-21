import React, { useState, useMemo, useEffect } from 'react';
import { FleetTable } from '../components/dashboard/FleetTable';
import { PrazosView } from '../components/dashboard/PrazosView';
import { ManutencaoView } from '../components/dashboard/ManutencaoView';
import { VehicleDetailsModal } from '../components/dashboard/VehicleDetailsModal';
import { api } from '../services/api';
import { 
  Truck, 
  Download, 
  Plus, 
  RefreshCw, 
  AlertCircle,
  X,
  KeyRound,
  Warehouse,
  Wrench,
  AlertOctagon,
  CalendarClock,
  MapPin
} from 'lucide-react';

const normalizeFilterText = (val) =>
  String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const UF_TO_REGIAO = {
  SP: 'SUDESTE', RJ: 'SUDESTE', MG: 'SUDESTE', ES: 'SUDESTE',
  PR: 'SUL', SC: 'SUL', RS: 'SUL',
  BA: 'NORDESTE', PE: 'NORDESTE', CE: 'NORDESTE', MA: 'NORDESTE',
  PB: 'NORDESTE', RN: 'NORDESTE', AL: 'NORDESTE', SE: 'NORDESTE', PI: 'NORDESTE',
  GO: 'C-OESTE', MT: 'C-OESTE', MS: 'C-OESTE', DF: 'C-OESTE',
  AM: 'NORTE', PA: 'NORTE', AC: 'NORTE', RO: 'NORTE', RR: 'NORTE', AP: 'NORTE', TO: 'NORTE'
};

export const ControleVeiculosPage = ({
  selectedRegiao,
  searchTerm,
  refreshKey = 0,
  onLoadingChange,
  initialPillar = 'frota',
  selectedAtpFilter = null,
  onClearAtpFilter,
}) => {
  const [activePillar, setActivePillar] = useState(initialPillar === 'veiculos' ? 'frota' : initialPillar);
  const [statusFilter, setStatusFilter] = useState('TODOS'); // 'TODOS' | 'em_uso' | 'disponivel' | 'manutencao' | 'sinistrado'

  useEffect(() => {
    if (selectedAtpFilter) {
      setStatusFilter('TODOS');
      setActivePillar('frota');
    }
  }, [selectedAtpFilter]);

  useEffect(() => {
    if (initialPillar === 'veiculos') {
      setActivePillar('frota');
    } else if (initialPillar) {
      setActivePillar(initialPillar);
    }
  }, [initialPillar]);

  const [veiculosData, setVeiculosData] = useState([]);
  const [kpisApi, setKpisApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUsingLiveApi, setIsUsingLiveApi] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [selectedPlaca, setSelectedPlaca] = useState(null);

  // Carrega dados exclusivamente do Supabase via FastAPI
  const carregarDados = async () => {
    setLoading(true);
    setApiError(null);
    onLoadingChange?.(true);
    try {
      const [kpisRes, veicRes] = await Promise.all([
        api.getKPIs(),
        api.getVeiculos({ pageSize: 300 })
      ]);

      if (veicRes && veicRes.items && veicRes.items.length > 0) {
        // Mapeia veículos do banco central para formato visual homogêneo
        const mapped = veicRes.items.map(v => {
          const hodo = Number(v.hodometro_atual || 0);
          const ultRev = Math.floor(hodo / 10000) * 10000;
          const proxRev = ultRev + 10000;
          const regiaoRaw = v.base_regiao === 'CENTRO-OESTE' ? 'C-OESTE' : v.base_regiao;
          const regiao = regiaoRaw || UF_TO_REGIAO[v.base_uf] || '';

          return {
            id: v.id_veiculo,
            placa: v.placa,
            modelo: v.modelo || 'Renault Kwid Zen 1.0',
            ano: v.ano || 2024,
            propriedade: v.locadora_nome || 'Arval Brasil',
            atp: v.base_nome || 'Não definida',
            baseCidade: v.base_cidade || null,
            uf: v.base_uf || '',
            regiao: regiao,
            tecnicoAlocado: v.condutor_atual_nome || null,
            matricula: v.condutor_atual_matricula || null,
            condutorAtivo: v.condutor_atual_ativo !== false,
            status: v.status_operacional ? v.status_operacional.toLowerCase() : 'disponivel',
            hodometro: hodo,
            ultimaRevisaoKm: ultRev,
            proximaRevisaoKm: proxRev,
            diasContrato: v.dias_para_fim_contrato || 478,
            contratoFim: v.data_fim_contrato || '2026-01-15',
            licenciamento: 'ok',
            seguro: 'ok'
          };
        });

        setVeiculosData(mapped);
        setKpisApi(kpisRes);
        setIsUsingLiveApi(true);
      } else {
        setVeiculosData([]);
        setIsUsingLiveApi(true);
      }
    } catch (err) {
      setVeiculosData([]);
      setKpisApi(null);
      setIsUsingLiveApi(false);
      setApiError(err.message || 'Falha ao consultar veículos no Supabase via backend FastAPI.');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [refreshKey]);

  // Base dos veículos filtrada por Região, ATP/Cidade e Busca
  const baseVeiculos = useMemo(() => {
    const targetAtp = normalizeFilterText(selectedAtpFilter?.nomeAtp);
    const targetCidade = normalizeFilterText(selectedAtpFilter?.cidade);
    const targetUf = normalizeFilterText(selectedAtpFilter?.uf);

    return veiculosData.filter(v => {
      const matchRegiao = selectedRegiao === 'TODAS' || v.regiao === selectedRegiao;
      const term = (searchTerm || '').toLowerCase();
      const matchSearch =
        !term ||
        v.placa.toLowerCase().includes(term) ||
        v.modelo.toLowerCase().includes(term) ||
        (v.tecnicoAlocado && v.tecnicoAlocado.toLowerCase().includes(term)) ||
        (v.baseCidade && v.baseCidade.toLowerCase().includes(term)) ||
        (v.atp && v.atp.toLowerCase().includes(term));

      let matchAtp = true;
      if (selectedAtpFilter) {
        const vAtp = normalizeFilterText(v.atp);
        const vCidade = normalizeFilterText(v.baseCidade);
        const vUf = normalizeFilterText(v.uf);

        if (targetAtp && targetAtp !== 'atp' && vAtp && vAtp !== 'nao definida') {
          matchAtp = vAtp === targetAtp;
        } else if (targetCidade && targetCidade !== 'nao informada') {
          matchAtp = vCidade === targetCidade && (!targetUf || vUf === targetUf);
        } else if (targetUf) {
          matchAtp = vUf === targetUf;
        }
      }

      return matchRegiao && matchSearch && matchAtp;
    });
  }, [veiculosData, selectedRegiao, searchTerm, selectedAtpFilter]);

  // Contagens dos Status
  const total = baseVeiculos.length;
  const emCustodia = baseVeiculos.filter(v => v.status === 'em_uso').length;
  const noPatio = baseVeiculos.filter(v => v.status === 'disponivel').length;
  const emOficina = baseVeiculos.filter(v => v.status === 'manutencao').length;
  const emSinistro = baseVeiculos.filter(v => v.status === 'sinistrado').length;

  // Veículos finais entregues à tabela (respeitando o filtro de status selecionado)
  const displayVeiculos = useMemo(() => {
    if (statusFilter === 'TODOS') return baseVeiculos;
    return baseVeiculos.filter(v => v.status === statusFilter);
  }, [baseVeiculos, statusFilter]);

  const statusChips = [
    { id: 'TODOS', label: 'Todos os Veículos', count: total, icon: Truck, color: 'text-brand-600 bg-brand-50 border-brand-200' },
    { id: 'em_uso', label: 'Em Custódia', count: emCustodia, icon: KeyRound, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { id: 'disponivel', label: 'No Pátio', count: noPatio, icon: Warehouse, color: 'text-sky-700 bg-sky-50 border-sky-200' },
    { id: 'manutencao', label: 'Em Oficina', count: emOficina, icon: Wrench, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { id: 'sinistrado', label: 'Sinistros', count: emSinistro, icon: AlertOctagon, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  ];

  return (
    <div className="space-y-6 animate-fadeUp">
      {/* Cabeçalho da Seção com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Controle de Veículos & Inventário
            </h1>
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              17 ATPs Ativas
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão operacional de ativos, alocação de técnicos, vistorias e conciliação de frotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={carregarDados}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-colors"
            title="Recarregar dados do banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Base</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/25 transition-all">
            <Plus className="w-4 h-4" />
            <span>Novo Veículo</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <div>
              <strong className="block font-bold">Supabase indisponível</strong>
              <span>{apiError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={carregarDados}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* Alerta de Auditoria Governança: Condutores Inativos */}
      {kpisApi && kpisApi.veiculos_condutor_inativo > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <strong className="block font-bold">Auditoria de Custódia Anti-Inativos ({kpisApi.veiculos_condutor_inativo} Alertas):</strong>
              <span>
                Existem veículos associados a técnicos com status <em>DESLIGADO/INATIVO</em> no banco central. Execute o recolhimento ou reatribuição imediata.
              </span>
            </div>
          </div>
          <span className="font-bold text-[11px] px-3 py-1 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
            Trava Preventiva Ativa
          </span>
        </div>
      )}

      {/* Barra de Filtros Rápidos de Status da Frota */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Status:
        </span>
        {statusChips.map((chip) => {
          const Icon = chip.icon;
          const isActive = statusFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                isActive
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-500/20'
                  : 'bg-white dark:bg-app-darkSurface text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{chip.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}

        {statusFilter !== 'TODOS' && (
          <button
            onClick={() => setStatusFilter('TODOS')}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white px-2 py-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {selectedAtpFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-brand-50/80 dark:bg-brand-500/10 border border-brand-200/80 dark:border-brand-500/30">
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span className="text-slate-600 dark:text-slate-300 font-semibold shrink-0">
              Filtrado por base/cidade:
            </span>
            <span className="font-extrabold text-brand-800 dark:text-brand-200 truncate">
              {selectedAtpFilter.cidade
                ? `${selectedAtpFilter.cidade} (${selectedAtpFilter.uf})`
                : selectedAtpFilter.uf}
              {selectedAtpFilter.nomeAtp ? ` • ${selectedAtpFilter.nomeAtp}` : ''}
            </span>
          </div>
          {onClearAtpFilter && (
            <button
              type="button"
              onClick={onClearAtpFilter}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-app-darkSurface text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Remover filtro</span>
            </button>
          )}
        </div>
      )}

      {/* Cabeçalho Contextual Limpo da Gestão de Frotas (Sem Menus Duplicados) */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Gestão de Frotas</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-brand-600 dark:text-brand-400 font-extrabold flex items-center gap-1.5">
              {activePillar === 'frota' && (
                <>
                  <Truck className="w-3.5 h-3.5" />
                  <span>Status da Frota & Alocação</span>
                </>
              )}
              {activePillar === 'prazos' && (
                <>
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Prazo de Veículos (Arval & Licença)</span>
                </>
              )}
              {activePillar === 'manutencao' && (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Manutenção & Odômetro (10k km)</span>
                </>
              )}
            </span>
          </div>

          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Região: <span className="font-bold text-slate-700 dark:text-slate-200">{selectedRegiao === 'TODAS' ? 'Todas as 17 ATPs' : selectedRegiao}</span> • Filtrados: <span className="font-bold text-brand-600 dark:text-brand-400">{displayVeiculos.length} veículos</span>
          </div>
        </div>

        {/* Visualização de acordo com o Pilar Selecionado */}
        {activePillar === 'frota' && (
          <FleetTable 
            veiculos={displayVeiculos} 
            onSelectVeiculo={(v) => setSelectedPlaca(v.placa)}
          />
        )}
        {activePillar === 'prazos' && <PrazosView veiculos={displayVeiculos} />}
        {activePillar === 'manutencao' && <ManutencaoView veiculos={displayVeiculos} />}
      </div>

      {/* Modal de Detalhes da Ficha Completa do Veículo */}
      {selectedPlaca && (
        <VehicleDetailsModal
          placa={selectedPlaca}
          onClose={() => setSelectedPlaca(null)}
        />
      )}
    </div>
  );
};

