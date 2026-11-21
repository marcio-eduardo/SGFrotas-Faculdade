import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Wrench,
  Fuel,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Building2,
  Search,
} from 'lucide-react';
import { Pagination } from '../../common/Pagination';
import { MercosulPlate } from '../../common/MercosulPlate';
import {
  BrazilRegionsSvg,
  REGIAO_LABEL,
  buildBrazilRegions,
  normalizeRegiaoCode,
} from './BrazilRegionsSvg';

const MODAL_PAGE_SIZE = 15;

const SINGLE_REVISAO_META = {
  em_dia: {
    title: 'Veículos em Dia (> 1.000 km)',
    subtitle: 'Veículos regulares no ciclo preventivo de 10.000 km',
    shortLabel: 'Em dia (> 1.000 km)',
    filterLabel: 'Em dia',
    icon: CheckCircle2,
    iconBoxClass: 'fleet-alert-em-dia',
    badgeClass: 'fleet-alert-em-dia',
    bannerClass: 'fleet-alert-em-dia',
  },
  proxima: {
    title: 'Revisões Próximas do Vencimento (≤ 1.000 km)',
    subtitle: 'Veículos que exigem agendamento preventivo',
    shortLabel: 'Próxima (≤ 1.000 km)',
    filterLabel: 'Próxima',
    icon: Clock,
    iconBoxClass: 'fleet-alert-proxima',
    badgeClass: 'fleet-alert-proxima',
    bannerClass: 'fleet-alert-proxima',
  },
  vencida: {
    title: 'Veículos com Revisão Vencida',
    subtitle: 'Ativos com ciclo preventivo de 10.000 km expirado',
    shortLabel: 'Revisão Vencida',
    filterLabel: 'Vencida',
    icon: AlertTriangle,
    iconBoxClass: 'fleet-alert-vencida',
    badgeClass: 'fleet-alert-vencida',
    bannerClass: 'fleet-alert-vencida',
  },
};

const formatBRL = (val) => {
  if (val == null) return '—';
  return Number(val).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
};

const getRevisaoStatusMeta = (status, restanteKm) => {
  const s = String(status || '').toLowerCase();
  if (s === 'vencida' || Number(restanteKm) <= 0) {
    return {
      label: 'Vencida',
      badge: 'fleet-alert-vencida',
      category: 'vencida',
    };
  }
  if (s === 'critica' || s === 'atencao' || s === 'proxima') {
    return {
      label: restanteKm != null ? `${Number(restanteKm).toLocaleString('pt-BR')} km` : 'Próxima',
      badge: 'fleet-alert-proxima',
      category: 'proxima',
    };
  }
  return {
    label:
      restanteKm != null && Number(restanteKm) > 0
        ? `Em dia (${Number(restanteKm).toLocaleString('pt-BR')} km)`
        : 'Em dia',
    badge: 'fleet-alert-em-dia',
    category: 'em_dia',
  };
};

export const CardDetailsModal = ({
  modalState,
  analyticsData,
  fallbackRevisoes = [],
  fallbackCombustivel = [],
  fallbackRegioes = [],
  onSelectAtp,
  onClose,
}) => {
  const closeBtnRef = useRef(null);
  const previousFocusRef = useRef(null);
  const scrollBodyRef = useRef(null);
  const [revFilter, setRevFilter] = useState('todos');
  const [revSearch, setRevSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('TODAS');
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const modalType = modalState?.type || null;
  const singleStatus =
    modalType === 'revisoes' && SINGLE_REVISAO_META[modalState?.singleStatus]
      ? modalState.singleStatus
      : null;

  const handlePageChange = (nextPage) => {
    setCurrentPage(nextPage);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [revFilter, revSearch, regionFilter]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!modalType) return;

    previousFocusRef.current = document.activeElement;
    setRevFilter(modalState?.singleStatus || modalState?.initialFilter || 'todos');
    setRevSearch('');
    setRegionFilter(modalState?.highlightRegion || 'TODAS');
    setHoveredRegion(null);
    setCurrentPage(1);

    // Move foco para o botão fechar para acessibilidade imediata
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 10);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function'
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [
    modalType,
    modalState?.singleStatus,
    modalState?.initialFilter,
    modalState?.highlightRegion,
  ]);

  const revisoesData = useMemo(() => {
    const segments = analyticsData?.donutRevisoes?.length
      ? analyticsData.donutRevisoes
      : fallbackRevisoes;
    const rawList =
      analyticsData?.revisoesListaCompleta?.length > 0
        ? analyticsData.revisoesListaCompleta
        : analyticsData?.revisoesCriticasLista?.length > 0
          ? analyticsData.revisoesCriticasLista
          : analyticsData?.veiculosRevisaoAlertas || [];

    const countsByCategory = { todos: rawList.length, em_dia: 0, proxima: 0, vencida: 0 };
    rawList.forEach((item) => {
      const meta = getRevisaoStatusMeta(item.status, item.restanteKm);
      countsByCategory[meta.category] = (countsByCategory[meta.category] || 0) + 1;
    });

    const term = revSearch.trim().toLowerCase();
    const filteredList = rawList.filter((item) => {
      const meta = getRevisaoStatusMeta(item.status, item.restanteKm);
      const matchCat = revFilter === 'todos' || meta.category === revFilter;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        String(item.placa || '').toLowerCase().includes(term) ||
        String(item.modelo || '').toLowerCase().includes(term) ||
        String(item.atp || '').toLowerCase().includes(term)
      );
    });

    return {
      segments,
      conformidadePct: analyticsData?.revisoesConformidadePct,
      totalAtivos: analyticsData?.revisoesTotalAtivos,
      rawList,
      countsByCategory,
      filteredList,
    };
  }, [analyticsData, fallbackRevisoes, revFilter, revSearch]);

  const combustivelData = useMemo(() => {
    const stats = analyticsData?.combustivelStats;
    if (stats) {
      return {
        etanolFormatado: stats.etanolFormatado || '0 L',
        etanolPct: Number(stats.etanolPct || 0),
        gasolinaFormatado: stats.gasolinaFormatado || '0 L',
        gasolinaPct: Number(stats.gasolinaPct || 0),
        totalFormatado: stats.totalCombustivelLitrosFormatado || '0 L',
        eficienciaMediaKmL: stats.eficienciaMediaKmL,
        combustiveis: stats.combustiveis || [],
        servicos: stats.servicos || [],
      };
    }

    const etanolSeg = fallbackCombustivel.find((d) => /etanol/i.test(d.label || ''));
    const gasSeg = fallbackCombustivel.find((d) => /gasolina/i.test(d.label || ''));
    return {
      etanolFormatado: etanolSeg?.value || '0 L',
      etanolPct: Number(etanolSeg?.percentage || 0),
      gasolinaFormatado: gasSeg?.value || '0 L',
      gasolinaPct: Number(gasSeg?.percentage || 0),
      totalFormatado: 'Dados em cache',
      eficienciaMediaKmL: null,
      combustiveis: fallbackCombustivel.map((d) => ({
        label: d.label,
        litrosFormatado: d.value,
        percentage: d.percentage,
        abastecimentos: null,
        valorTotal: null,
      })),
      servicos: [],
    };
  }, [analyticsData, fallbackCombustivel]);

  const geografiaData = useMemo(() => {
    const regioes = buildBrazilRegions(
      analyticsData?.regioesMapa,
      fallbackRegioes
    );

    const atps = analyticsData?.atpsResumo || [];
    const selectedCode =
      regionFilter !== 'TODAS' ? normalizeRegiaoCode(regionFilter) : null;
    const filteredAtps = selectedCode
      ? atps.filter((a) => normalizeRegiaoCode(a.regiao) === selectedCode)
      : atps;

    const totalAtps = analyticsData?.totalAtpsAtivas ?? atps.length;
    const totalVeiculos =
      analyticsData?.totalVeiculosAtivos ??
      regioes.reduce((acc, r) => acc + Number(r.veiculos || 0), 0);

    const activeRegionCode = hoveredRegion || selectedCode;
    const activeRegionObj = activeRegionCode
      ? regioes.find((r) => r.codigo === activeRegionCode) || null
      : null;

    const summaryCard = activeRegionObj || {
      codigo: 'TODAS',
      label: 'Todas as Regiões',
      color: 'var(--region-sudeste)',
      atpsAtivas: totalAtps,
      veiculos: totalVeiculos,
      percentage: 100.0,
    };

    return {
      regioes,
      atps,
      filteredAtps,
      selectedCode,
      totalAtps,
      totalVeiculos,
      summaryCard,
    };
  }, [analyticsData, fallbackRegioes, regionFilter, hoveredRegion]);

  if (!modalType) return null;

  const singleMeta = singleStatus ? SINGLE_REVISAO_META[singleStatus] : null;
  let singleCount = 0;
  let singlePct = 0;
  if (singleStatus) {
    const matchedSeg =
      singleStatus === 'em_dia'
        ? revisoesData.segments.find((s) => /dia/i.test(s.label || '')) ||
        revisoesData.segments[0]
        : singleStatus === 'proxima'
          ? revisoesData.segments.find((s) =>
            /pr[oó]xima|aten/i.test(s.label || '')
          ) || revisoesData.segments[1]
          : revisoesData.segments.find((s) => /vencid/i.test(s.label || '')) ||
          revisoesData.segments[2];

    singleCount =
      matchedSeg?.count ??
      (matchedSeg?.value != null
        ? Number(String(matchedSeg.value).replace(/\D/g, ''))
        : revisoesData.countsByCategory[singleStatus] ?? 0);
    const totalBase = revisoesData.totalAtivos || revisoesData.rawList.length || 0;
    singlePct =
      matchedSeg?.percentage != null
        ? Number(matchedSeg.percentage)
        : totalBase > 0
          ? (singleCount / totalBase) * 100
          : 0;
  }

  const headerConfig = {
    revisoes: singleMeta
      ? {
        title: singleMeta.title,
        subtitle: singleMeta.subtitle,
        icon: singleMeta.icon,
        iconBoxClass: singleMeta.iconBoxClass,
        badgeClass: singleMeta.badgeClass,
        badge: `${singleCount} veíc. • ${singlePct.toFixed(1)}%`,
      }
      : {
        title: 'Detalhamento de Revisões Preventivas Arval',
        subtitle: 'Ciclo contratual de 10.000 km e lista prioritária de veículos',
        icon: Wrench,
        badge:
          revisoesData.conformidadePct != null
            ? `${Number(revisoesData.conformidadePct).toFixed(1)}% em dia`
            : null,
      },
    combustivel: {
      title: 'Detalhamento de Abastecimento ValeCard',
      subtitle: 'Separação analítica entre combustíveis líquidos e serviços de pátio',
      icon: Fuel,
      badge: combustivelData.totalFormatado,
    },
    geografia: {
      title: 'Distribuição Geográfica e Bases ATP',
      subtitle: 'Consolidado por macro-região e alocação de veículos nas unidades',
      icon: MapPin,
      badge: `${geografiaData.totalVeiculos} veíc. • ${geografiaData.totalAtps} ATPs`,
    },
  }[modalType];

  const HeaderIcon = headerConfig.icon;
  const headerIconBoxClass =
    headerConfig.iconBoxClass ||
    'bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border-brand-500/20';
  const headerBadgeClass =
    headerConfig.badgeClass ||
    'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 border-brand-200/80 dark:border-brand-500/30';

  return createPortal(
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-details-modal-title"
        className={`fleet-surface-elevated rounded-3xl shadow-2xl w-full ${modalType === 'geografia' ? 'max-w-[924px]' : 'max-w-4xl'
          } max-h-[88vh] flex flex-col overflow-hidden animate-fadeUp`}
      >
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-fleet-titanium/45 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-fleet-graphite/55">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${headerIconBoxClass}`}
            >
              <HeaderIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="card-details-modal-title"
                  className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate"
                >
                  {headerConfig.title}
                </h2>
                {headerConfig.badge && (
                  <span
                    className={`text-[11px] font-extrabold font-mono px-2.5 py-0.5 rounded-full border ${headerBadgeClass}`}
                  >
                    {headerConfig.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {headerConfig.subtitle}
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de detalhamento"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div ref={scrollBodyRef} className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* CONTEÚDO 1: REVISÕES */}
          {modalType === 'revisoes' && (
            <>
              {/* Overview Mode: exibe os 3 cards resumo clicáveis */}
              {!singleMeta && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {revisoesData.segments.map((seg, idx) => {
                    const isEmDia = /dia/i.test(seg.label || '') || idx === 0;
                    const isProxima =
                      /pr[oó]xima|aten/i.test(seg.label || '') || idx === 1;
                    const tone = isEmDia
                      ? {
                        card: 'border-alert-em-dia/40 dark:border-alert-em-dia bg-alert-em-dia/10 dark:bg-alert-em-dia/35',
                        text: 'text-alert-em-dia dark:text-white',
                        Icon: CheckCircle2,
                      }
                      : isProxima
                        ? {
                          card: 'border-alert-proxima/40 dark:border-alert-proxima bg-alert-proxima/10 dark:bg-alert-proxima/25',
                          text: 'text-alert-proxima dark:text-white',
                          Icon: Clock,
                        }
                        : {
                          card: 'border-alert-vencida/40 dark:border-alert-vencida bg-alert-vencida/10 dark:bg-alert-vencida/40',
                          text: 'text-alert-vencida dark:text-white',
                          Icon: AlertTriangle,
                        };
                    const StatusIcon = tone.Icon;

                    const filterCategory = isEmDia
                      ? 'em_dia'
                      : isProxima
                        ? 'proxima'
                        : 'vencida';
                    const isActiveCard = revFilter === filterCategory;

                    return (
                      <button
                        type="button"
                        key={seg.label || idx}
                        onClick={() =>
                          setRevFilter((prev) =>
                            prev === filterCategory ? 'todos' : filterCategory
                          )
                        }
                        className={`p-4 rounded-2xl border ${tone.card} flex items-center justify-between text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActiveCard
                          ? 'ring-2 ring-brand-500 shadow-xs'
                          : 'hover:shadow-xs'
                          }`}
                      >
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                            {seg.label}
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                              {seg.value}
                            </span>
                            <span
                              className={`text-xs font-extrabold font-mono ${tone.text}`}
                            >
                              {Number(seg.percentage || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <StatusIcon
                          className={`w-6 h-6 ${tone.text}`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Lista de veículos filtrável por status e busca */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap min-h-[30px]">
                    {singleMeta ? (
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${singleMeta.bannerClass}`}
                      >
                        <singleMeta.icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{singleMeta.shortLabel}</span>
                        <span className="opacity-60">•</span>
                        <span className="font-mono font-extrabold">
                          {revisoesData.filteredList.length} veículos
                        </span>
                      </div>
                    ) : (
                      revFilter !== 'todos' && (
                        <button
                          type="button"
                          onClick={() => setRevFilter('todos')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 border border-brand-200/80 dark:border-brand-500/30 hover:bg-brand-100 dark:hover:bg-brand-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <span>
                            Limpar filtro ({SINGLE_REVISAO_META[revFilter]?.filterLabel || revFilter})
                          </span>
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative w-full sm:w-64 sm:ml-auto">
                    <Search
                      className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={revSearch}
                      onChange={(e) => setRevSearch(e.target.value)}
                      placeholder="Buscar placa, modelo, ATP..."
                      aria-label="Buscar veículo por placa, modelo ou ATP"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {revisoesData.filteredList.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum veículo encontrado para este filtro.
                  </div>
                ) : (
                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-app-darkSurface2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Placa</th>
                            <th className="py-2.5 px-4">Modelo</th>
                            <th className="py-2.5 px-4">Base / ATP</th>
                            <th className="py-2.5 px-4 text-right">Hodômetro</th>
                            <th className="py-2.5 px-4 text-right">Status / Restante</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {revisoesData.filteredList
                            .slice(
                              (currentPage - 1) * MODAL_PAGE_SIZE,
                              currentPage * MODAL_PAGE_SIZE
                            )
                            .map((item, i) => {
                              const meta = getRevisaoStatusMeta(item.status, item.restanteKm);
                              return (
                                <tr
                                  key={item.id || `${item.placa}-${i}`}
                                  className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                                >
                                  <td className="py-2 px-4 align-middle whitespace-nowrap">
                                    <MercosulPlate placa={item.placa} size="xs" />
                                  </td>
                                  <td className="py-2.5 px-4 align-middle text-slate-700 dark:text-slate-300">
                                    {item.modelo || '—'}
                                  </td>
                                  <td
                                    className="py-2.5 px-4 align-middle text-slate-600 dark:text-slate-400 max-w-[260px] truncate"
                                    title={item.atp || undefined}
                                  >
                                    {item.atp || '—'}
                                  </td>
                                  <td className="py-2.5 px-4 align-middle text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {item.hodometro ? `${item.hodometro} km` : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 align-middle text-right whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono border whitespace-nowrap ${meta.badge}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalItems={revisoesData.filteredList.length}
                      pageSize={MODAL_PAGE_SIZE}
                      onPageChange={handlePageChange}
                      itemLabel="veículos"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* CONTEÚDO 2: COMBUSTÍVEL */}
          {modalType === 'combustivel' && (
            <>
              {/* Comparativo Etanol vs Gasolina */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-app-darkSurface2/70 border border-slate-200/80 dark:border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl bg-white dark:bg-app-darkSurface border border-brand-200/80 dark:border-brand-500/25 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block">
                        Etanol (Consolidado)
                      </span>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                        {combustivelData.etanolFormatado}
                      </div>
                    </div>
                    <span className="text-lg font-black font-mono text-brand-600 dark:text-brand-400">
                      {combustivelData.etanolPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-app-darkSurface border border-emerald-200/80 dark:border-emerald-500/25 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                        Gasolina (Consolidado)
                      </span>
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                        {combustivelData.gasolinaFormatado}
                      </div>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {combustivelData.gasolinaPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Barra proporcional Etanol vs Gasolina */}
                <div>
                  <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 flex">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 to-region-norte motion-safe:transition-all motion-safe:duration-500"
                      style={{ width: `${Math.min(100, combustivelData.etanolPct)}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 motion-safe:transition-all motion-safe:duration-500"
                      style={{ width: `${Math.min(100, combustivelData.gasolinaPct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                    <span>Proporção Etanol: {combustivelData.etanolPct.toFixed(1)}%</span>
                    <span>Total Combustíveis: {combustivelData.totalFormatado}</span>
                    <span>Proporção Gasolina: {combustivelData.gasolinaPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Seção 1: Combustíveis */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Combustíveis Abastecidos
                  </h3>
                </div>

                <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-app-darkSurface2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Combustível</th>
                        <th className="py-2.5 px-4 text-right">Volume</th>
                        <th className="py-2.5 px-4 text-right">Participação</th>
                        <th className="py-2.5 px-4 text-right">Abastecimentos</th>
                        <th className="py-2.5 px-4 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {combustivelData.combustiveis.map((item, idx) => (
                        <tr
                          key={item.label || idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {item.label}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {item.litrosFormatado || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-brand-700 dark:text-brand-400 font-bold">
                            {Number(item.percentage || 0).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {item.abastecimentos != null
                              ? Number(item.abastecimentos).toLocaleString('pt-BR')
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {formatBRL(item.valorTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção 2: Serviços & Itens de Pátio no ValeCard */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Serviços & Itens de Pátio no ValeCard
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Lavagens, lubrificantes e insumos operacionais
                  </span>
                </div>

                {combustivelData.servicos.length === 0 ? (
                  <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum serviço de pátio registrado no período selecionado.
                  </div>
                ) : (
                  <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-app-darkSurface2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Serviço / Item</th>
                          <th className="py-2.5 px-4 text-right">Qtd / Vol.</th>
                          <th className="py-2.5 px-4 text-right">Participação</th>
                          <th className="py-2.5 px-4 text-right">Registros</th>
                          <th className="py-2.5 px-4 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {combustivelData.servicos.map((srv, idx) => (
                          <tr
                            key={srv.label || idx}
                            className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                          >
                            <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                              {srv.label}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                              {srv.litrosFormatado || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                              {Number(srv.percentage || 0).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                              {srv.abastecimentos != null
                                ? Number(srv.abastecimentos).toLocaleString('pt-BR')
                                : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {formatBRL(srv.valorTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* CONTEÚDO 3: GEOGRAFIA */}
          {modalType === 'geografia' && (
            <>
              {/* Topo Interativo: Mapa do Brasil em destaque central + Quadro Reduzido no canto inferior direito */}
              <div className="relative flex flex-col items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="w-full flex items-center justify-center">
                  <BrazilRegionsSvg
                    regions={geografiaData.regioes}
                    highlightedCode={
                      hoveredRegion || geografiaData.selectedCode
                    }
                    dimInactive={Boolean(
                      hoveredRegion || geografiaData.selectedCode
                    )}
                    onHoverChange={setHoveredRegion}
                    onSelectRegion={(codigo) =>
                      setRegionFilter((prev) =>
                        normalizeRegiaoCode(prev) === codigo ? 'TODAS' : codigo
                      )
                    }
                    className="w-full max-w-[380px] sm:max-w-[460px] md:max-w-[520px] h-auto select-none overflow-visible"
                  />
                </div>

                {/* Quadro reduzido no canto inferior direito ao lado do mapa */}
                <div className="w-full max-w-[240px] md:w-[196px] md:absolute md:right-2 md:bottom-4 z-10">
                  <div
                    aria-live="polite"
                    className="p-3.5 rounded-2xl bg-slate-50/95 dark:bg-app-darkSurface2/95 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              hoveredRegion === geografiaData.summaryCard.codigo ||
                              geografiaData.selectedCode === geografiaData.summaryCard.codigo
                                ? (geografiaData.summaryCard.hoverColor || geografiaData.summaryCard.color)
                                : geografiaData.summaryCard.color,
                          }}
                        />
                        {geografiaData.summaryCard.label}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        {geografiaData.summaryCard.atpsAtivas} ATPs
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-black font-mono text-slate-900 dark:text-white leading-none">
                        {geografiaData.summaryCard.veiculos} veíc.
                      </span>
                      <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-slate-100">
                        {Number(geografiaData.summaryCard.percentage || 0).toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full motion-safe:transition-all motion-safe:duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(4, Number(geografiaData.summaryCard.percentage || 0))
                          )}%`,
                          backgroundColor:
                            hoveredRegion === geografiaData.summaryCard.codigo ||
                            geografiaData.selectedCode === geografiaData.summaryCard.codigo
                              ? (geografiaData.summaryCard.hoverColor || geografiaData.summaryCard.color)
                              : geografiaData.summaryCard.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista das 17 ATPs por Cidade/UF */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Bases ATP Ativas ({geografiaData.filteredAtps.length})
                      {regionFilter !== 'TODAS'
                        ? ` • ${REGIAO_LABEL[normalizeRegiaoCode(regionFilter)] || regionFilter}`
                        : ''}
                    </h3>
                  </div>

                  {regionFilter !== 'TODAS' ? (
                    <button
                      type="button"
                      onClick={() => setRegionFilter('TODAS')}
                      className="text-[11px] font-bold text-brand-700 dark:text-brand-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-2 py-0.5"
                    >
                      Mostrar todas ({geografiaData.atps.length} ATPs)
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Clique em uma região no mapa para filtrar as ATPs
                    </span>
                  )}
                </div>

                {geografiaData.filteredAtps.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma ATP detalhada disponível para esta região.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {geografiaData.filteredAtps
                        .slice(
                          (currentPage - 1) * MODAL_PAGE_SIZE,
                          currentPage * MODAL_PAGE_SIZE
                        )
                        .map((atp, idx) => {
                          const code = normalizeRegiaoCode(atp.regiao);
                          const locationLabel = atp.cidade
                            ? `${atp.cidade} (${atp.uf})`
                            : atp.uf || '—';
                          return (
                            <button
                              key={`${atp.nomeAtp}-${idx}`}
                              type="button"
                              onClick={() => {
                                onClose?.();
                                onSelectAtp?.(atp);
                              }}
                              title={`Ver veículos de ${locationLabel} em Status da Frota`}
                              className="w-full p-3.5 rounded-xl bg-white dark:bg-app-darkSurface2 border border-slate-200/80 dark:border-white/10 hover:border-brand-400/80 dark:hover:border-brand-400/50 hover:bg-brand-50/40 dark:hover:bg-brand-500/10 hover:shadow-sm transition-all flex items-center justify-between gap-3 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors truncate">
                                  {atp.nomeAtp}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                  {locationLabel} • {REGIAO_LABEL[code] || atp.regiao}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-mono text-xs font-black">
                                  {atp.veiculos}
                                </span>
                                <span className="block text-[9px] text-slate-400 mt-0.5">
                                  veíc.
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    {geografiaData.filteredAtps.length > MODAL_PAGE_SIZE && (
                      <div className="border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden">
                        <Pagination
                          currentPage={currentPage}
                          totalItems={geografiaData.filteredAtps.length}
                          pageSize={MODAL_PAGE_SIZE}
                          onPageChange={handlePageChange}
                          itemLabel="ATPs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
