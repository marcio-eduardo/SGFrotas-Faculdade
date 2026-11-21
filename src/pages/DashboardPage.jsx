import React, { useState, useMemo, useEffect } from 'react';
import { KpiCard } from '../components/common/KpiCard';
import { RevisoesWrenchCard } from '../components/dashboard/cards/RevisoesWrenchCard';
import { CombustivelPumpsCard } from '../components/dashboard/cards/CombustivelPumpsCard';
import { BrasilRegioesMapCard } from '../components/dashboard/cards/BrasilRegioesMapCard';
import { CardDetailsModal } from '../components/dashboard/cards/CardDetailsModal';
import { FleetUsageRankingCard } from '../components/dashboard/FleetUsageRankingCard';
import { RevisoesAlertsCard } from '../components/dashboard/RevisoesAlertsCard';
import { api } from '../services/api';
import {
  Truck,
  KeyRound,
  Warehouse,
  Wrench,
  AlertOctagon,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

const UF_TO_REGIAO = {
  SP: 'SUDESTE', RJ: 'SUDESTE', MG: 'SUDESTE', ES: 'SUDESTE',
  PR: 'SUL', SC: 'SUL', RS: 'SUL',
  BA: 'NORDESTE', PE: 'NORDESTE', CE: 'NORDESTE', MA: 'NORDESTE',
  PB: 'NORDESTE', RN: 'NORDESTE', AL: 'NORDESTE', SE: 'NORDESTE', PI: 'NORDESTE',
  GO: 'C-OESTE', MT: 'C-OESTE', MS: 'C-OESTE', DF: 'C-OESTE',
  AM: 'NORTE', PA: 'NORTE', AC: 'NORTE', RO: 'NORTE', RR: 'NORTE', AP: 'NORTE', TO: 'NORTE'
};

export const DashboardPage = ({
  selectedRegiao,
  selectedPeriod = '30d',
  refreshKey = 0,
  onLoadingChange,
  searchTerm,
  onNavigateVeiculos,
}) => {
  const [veiculosData, setVeiculosData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [kpisApi, setKpisApi] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [apiError, setApiError] = useState(null);

  // Carrega dados exclusivamente do Supabase via FastAPI
  const carregarDados = async () => {
    onLoadingChange?.(true);
    setApiError(null);
    try {
      const [kpisRes, veicRes, analyticsRes] = await Promise.all([
        api.getKPIs(),
        api.getVeiculos({ pageSize: 300 }),
        api.getDashboardAnalytics(),
      ]);

      if (veicRes && Array.isArray(veicRes.items)) {
        const mapped = veicRes.items.map(v => {
          const hodo = Number(v.hodometro_atual || 0);
          const regiaoRaw = v.base_regiao === 'CENTRO-OESTE' ? 'C-OESTE' : v.base_regiao;
          const regiao = regiaoRaw || UF_TO_REGIAO[v.base_uf] || '';

          return {
            id: v.id_veiculo,
            placa: v.placa,
            modelo: v.modelo || 'Renault Kwid Zen 1.0',
            atp: v.base_nome || 'Não definida',
            baseCidade: v.base_cidade || null,
            uf: v.base_uf || '',
            regiao: regiao,
            tecnicoAlocado: v.condutor_atual_nome || null,
            condutorAtivo: v.condutor_atual_ativo !== false,
            status: v.status_operacional ? v.status_operacional.toLowerCase() : 'disponivel',
            hodometro: hodo,
          };
        });

        setVeiculosData(mapped);
        setKpisApi(kpisRes);
      } else {
        setVeiculosData([]);
        setKpisApi(kpisRes || null);
      }

      setAnalyticsData(analyticsRes || null);
    } catch (err) {
      setVeiculosData([]);
      setKpisApi(null);
      setAnalyticsData(null);
      setApiError(err.message || 'Falha ao carregar indicadores do Supabase.');
    } finally {
      onLoadingChange?.(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [refreshKey, selectedPeriod]);

  // Base filtrada por Região e Busca
  const baseVeiculos = useMemo(() => {
    return veiculosData.filter(v => {
      const matchRegiao = selectedRegiao === 'TODAS' || v.regiao === selectedRegiao;
      const term = (searchTerm || '').toLowerCase();
      const matchSearch =
        !term ||
        v.placa.toLowerCase().includes(term) ||
        (v.modelo && v.modelo.toLowerCase().includes(term)) ||
        (v.tecnicoAlocado && v.tecnicoAlocado.toLowerCase().includes(term)) ||
        (v.atp && v.atp.toLowerCase().includes(term));

      return matchRegiao && matchSearch;
    });
  }, [veiculosData, selectedRegiao, searchTerm]);

  // Contagens dos 5 KPIs Operacionais
  const total = baseVeiculos.length;
  const emCustodia = baseVeiculos.filter(v => v.status === 'em_uso').length;
  const noPatio = baseVeiculos.filter(v => v.status === 'disponivel').length;
  const emOficina = baseVeiculos.filter(v => v.status === 'manutencao').length;
  const emSinistro = baseVeiculos.filter(v => v.status === 'sinistrado').length;

  const pctCustodia = total > 0 ? ((emCustodia / total) * 100).toFixed(1) : '0';
  const pctPatio = total > 0 ? ((noPatio / total) * 100).toFixed(1) : '0';
  const pctOficina = total > 0 ? ((emOficina / total) * 100).toFixed(1) : '0';
  const pctSinistro = total > 0 ? ((emSinistro / total) * 100).toFixed(1) : '0';

  // 1. Donut: Status de Manutenção e Revisões Arval (Ciclo 10.000 Km) — 100% Supabase
  const donutRevisoes = analyticsData?.donutRevisoes || [];

  // 2. Donut: Combustível ValeCard (Transações Oficiais) — 100% Supabase
  const donutCombustivel = analyticsData?.donutCombustivel || [];

  // 3. Donut: Distribuição da Frota por Região (17 ATPs) — 100% Supabase
  const donutRegioes = analyticsData?.donutRegioes || [];

  const veiculosRanking = analyticsData?.veiculosRanking || [];
  const condutoresRanking = analyticsData?.condutoresRanking || [];

  const franquiaStats = analyticsData?.franquiaStats;
  const veiculosRevisaoAlertas = analyticsData?.veiculosRevisaoAlertas || [];

  return (
    <div className="space-y-4 animate-fadeUp">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Dashboard - Indicadores de Frota
            </h1>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 fleet-surface-muted px-2.5 py-0.5 rounded-full">
              17 ATPs Integradas
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consolidação executiva de utilização da frota, manutenção preventiva Arval, abastecimento ValeCard e gestão de ativos.
          </p>
        </div>

        {onNavigateVeiculos && (
          <button
            onClick={onNavigateVeiculos}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold fleet-card-surface text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors self-start sm:self-auto"
          >
            <span>Ir para Controle de Veículos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <strong className="font-bold block">Supabase indisponível</strong>
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

      {/* Linha 1 (Hero Analítico): Distribuição Geográfica (7/12) + Revisões & Combustível empilhados compactos (5/12) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 xl:gap-4 items-stretch">
        <div className="xl:col-span-7">
          <BrasilRegioesMapCard
            regioesMapa={analyticsData?.regioesMapa}
            donutRegioes={donutRegioes}
            totalAtpsAtivas={analyticsData?.totalAtpsAtivas}
            totalVeiculosAtivos={analyticsData?.totalVeiculosAtivos}
            variant="hero"
            className="h-full"
            onOpenDetails={(highlightRegion) =>
              setDetailModal({ type: 'geografia', highlightRegion })
            }
          />
        </div>

        <div className="xl:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 xl:grid-rows-2 gap-3.5 xl:gap-4 h-full">
          <RevisoesWrenchCard
            revisoesConformidadePct={analyticsData?.revisoesConformidadePct}
            revisoesTotalAtivos={analyticsData?.revisoesTotalAtivos}
            donutRevisoes={donutRevisoes}
            compact
            onOpenDetails={(payload) => {
              if (payload?.mode === 'single' && payload?.status) {
                setDetailModal({ type: 'revisoes', singleStatus: payload.status });
              } else {
                setDetailModal({ type: 'revisoes', initialFilter: 'todos' });
              }
            }}
          />
          <CombustivelPumpsCard
            combustivelStats={analyticsData?.combustivelStats}
            donutCombustivel={donutCombustivel}
            compact
            onOpenDetails={() => setDetailModal({ type: 'combustivel' })}
          />
        </div>
      </div>

      {/* Linha 2 (KPIs Operacionais): Total de Veículos em destaque (50%) + Grade 2x2 de Status (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 xl:gap-4 items-stretch">
        <div className="lg:col-span-5 xl:col-span-6">
          <KpiCard
            title="Total de veículos"
            value={total.toString()}
            sub="Ativos em 17 ATPs"
            percentage="100"
            percentageLabel="total"
            color="blue"
            icon={Truck}
            variant="hero"
            onClick={onNavigateVeiculos}
          />
        </div>

        <div className="lg:col-span-7 xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <KpiCard
            title="Total em custódia"
            value={emCustodia.toString()}
            sub="Em campo c/ técnicos"
            percentage={pctCustodia}
            percentageLabel="em campo"
            color="green"
            icon={KeyRound}
            onClick={onNavigateVeiculos}
          />
          <KpiCard
            title="Total em oficina"
            value={emOficina.toString()}
            sub="Manutenção e revisão"
            percentage={pctOficina}
            percentageLabel="em oficina"
            color="amber"
            icon={Wrench}
            onClick={onNavigateVeiculos}
          />
          <KpiCard
            title="Total no pátio"
            value={noPatio.toString()}
            sub="Prontos p/ despacho"
            percentage={pctPatio}
            percentageLabel="no pátio"
            color="sky"
            icon={Warehouse}
            onClick={onNavigateVeiculos}
          />
          <KpiCard
            title="Total de sinistros"
            value={emSinistro.toString()}
            sub="Colisão ou guincho"
            percentage={pctSinistro}
            percentageLabel="sinistrado"
            color="red"
            icon={AlertOctagon}
            onClick={onNavigateVeiculos}
          />
        </div>
      </div>

      {/* Linha 2 de Indicadores: Rankings de Utilização por Odômetro & Alertas de Revisão Arval */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FleetUsageRankingCard
            veiculosRanking={veiculosRanking}
            condutoresRanking={condutoresRanking}
            franquiaStats={franquiaStats}
          />
        </div>
        <div className="lg:col-span-1">
          <RevisoesAlertsCard veiculosRevisao={veiculosRevisaoAlertas} />
        </div>
      </div>

      {/* Modal Contextual de Detalhamento dos Cards */}
      <CardDetailsModal
        modalState={detailModal}
        analyticsData={analyticsData}
        fallbackRevisoes={donutRevisoes}
        fallbackCombustivel={donutCombustivel}
        fallbackRegioes={donutRegioes}
        onSelectAtp={(atp) =>
          onNavigateVeiculos?.({
            atpFilter: {
              nomeAtp: atp.nomeAtp,
              cidade: atp.cidade,
              uf: atp.uf,
              regiao: atp.regiao,
            },
          })
        }
        onClose={() => setDetailModal(null)}
      />
    </div>
  );
};
