import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Calendar, Search, ChevronRight, RefreshCw } from 'lucide-react';

const REGIOES = ['TODAS', 'SUDESTE', 'SUL', 'NORDESTE', 'C-OESTE', 'NORTE'];

const PERIODS = [
  { id: 'hoje', label: 'Hoje', shortLabel: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias', shortLabel: '7 dias' },
  { id: '30d', label: 'Últimos 30 dias', shortLabel: '30 dias' },
  { id: 'mes', label: 'Mês Atual', shortLabel: 'Mês Atual' },
];

/**
 * Barra reutilizável de filtros globais (Região, Período, Busca e Atualizar).
 * Usada de forma compacta na Topbar mobile e inline no topo do conteúdo desktop.
 */
export const GlobalFiltersBar = ({
  selectedRegiao = 'TODAS',
  onSelectRegiao,
  selectedPeriod = '30d',
  onSelectPeriod,
  searchTerm = '',
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  showSearch = true,
  showRefresh = false,
  className = '',
}) => {
  const [openFilter, setOpenFilter] = useState(null);
  const filtersContainerRef = useRef(null);
  const triggerRefs = useRef({});
  const menuRefs = useRef({});
  const closeTimerRef = useRef(null);
  const pointerDownRef = useRef(false);

  const cancelCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openFilterMenu = (filterId) => {
    cancelCloseTimer();
    setOpenFilter(filterId);
  };

  const scheduleCloseFilterMenu = () => {
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenFilter(null);
    }, 130);
  };

  useEffect(() => {
    const handlePointerDownOutside = (event) => {
      if (filtersContainerRef.current && !filtersContainerRef.current.contains(event.target)) {
        setOpenFilter(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenFilter(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
      cancelCloseTimer();
    };
  }, []);

  const activePeriodObj = PERIODS.find((p) => p.id === selectedPeriod) || PERIODS[2];

  const filterConfigs = [
    {
      id: 'regiao',
      label: 'Região:',
      activeValue: selectedRegiao,
      icon: MapPin,
      ariaLabel: `Filtro de Região, selecionado: ${selectedRegiao}`,
      options: REGIOES.map((reg) => ({ id: reg, label: reg })),
      selectedId: selectedRegiao,
      onSelect: (id) => onSelectRegiao?.(id),
    },
    {
      id: 'periodo',
      label: 'Período:',
      activeValue: activePeriodObj.shortLabel,
      icon: Calendar,
      ariaLabel: `Filtro de Período, selecionado: ${activePeriodObj.label}`,
      options: PERIODS.map((p) => ({ id: p.id, label: p.label })),
      selectedId: selectedPeriod,
      onSelect: (id) => onSelectPeriod?.(id),
    },
  ];

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      <div ref={filtersContainerRef} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {filterConfigs.map((filter) => {
          const FilterIcon = filter.icon;
          const isOpen = openFilter === filter.id;

          return (
            <div
              key={filter.id}
              className="relative"
              onMouseEnter={() => openFilterMenu(filter.id)}
              onMouseLeave={scheduleCloseFilterMenu}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setOpenFilter((prev) => (prev === filter.id ? null : prev));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setOpenFilter(null);
                  triggerRefs.current[filter.id]?.focus();
                }
              }}
            >
              <button
                ref={(el) => {
                  triggerRefs.current[filter.id] = el;
                }}
                type="button"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={`global-filter-menu-${filter.id}`}
                aria-label={filter.ariaLabel}
                onPointerDown={() => {
                  pointerDownRef.current = true;
                }}
                onFocus={() => {
                  if (pointerDownRef.current) return;
                  openFilterMenu(filter.id);
                }}
                onClick={() => {
                  pointerDownRef.current = false;
                  cancelCloseTimer();
                  setOpenFilter((prev) => (prev === filter.id ? null : filter.id));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    openFilterMenu(filter.id);
                    requestAnimationFrame(() => {
                      const firstBtn = menuRefs.current[filter.id]?.querySelector('button');
                      firstBtn?.focus();
                    });
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all motion-reduce:transition-none ${
                  isOpen
                    ? 'bg-app-surface dark:bg-fleet-graphite border-light-orange dark:border-fleet-copperGlow text-light-jet dark:text-white shadow-sm ring-2 ring-light-orange/20 dark:ring-fleet-copper/25'
                    : 'bg-app-surface/90 dark:bg-fleet-graphite/80 border-app-surface3 dark:border-fleet-titanium/50 text-light-jet dark:text-slate-200 hover:border-light-orange/60 dark:hover:border-fleet-copper/60 hover:bg-app-surface dark:hover:bg-fleet-graphite'
                }`}
              >
                <FilterIcon
                  className="w-3.5 h-3.5 text-brand-700 dark:text-fleet-copperGlow shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline text-light-charcoalText dark:text-slate-300 font-medium">
                  {filter.label}
                </span>
                <span className="px-1.5 py-0.5 rounded-md fleet-pill-accent text-[11px] font-bold leading-none whitespace-nowrap">
                  {filter.activeValue}
                </span>
                <ChevronRight
                  className={`w-3 h-3 text-light-mutedText transition-transform duration-150 motion-reduce:transition-none hidden sm:inline ${
                    isOpen ? 'translate-x-0.5 text-light-orange dark:text-fleet-copperGlow' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div
                  id={`global-filter-menu-${filter.id}`}
                  ref={(el) => {
                    menuRefs.current[filter.id] = el;
                  }}
                  role="region"
                  aria-label={`Opções de ${filter.label.replace(':', '')}`}
                  className="fixed left-3 right-3 top-[60px] lg:absolute lg:right-auto lg:left-0 lg:top-full lg:pt-1.5 z-50"
                >
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-1 p-1.5 bg-app-surface/95 dark:bg-fleet-charcoal/95 backdrop-blur-md border border-app-surface3 dark:border-fleet-titanium/55 rounded-xl shadow-xl">
                    {filter.options.map((opt) => {
                      const isSelected = filter.selectedId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            filter.onSelect(opt.id);
                            setOpenFilter(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all motion-reduce:transition-none ${
                            isSelected ? 'fleet-pill-accent shadow-sm' : 'fleet-nav-idle'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showSearch && (
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-light-mutedText dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Buscar por placa, técnico, ATP ou contrato Arval..."
              aria-label="Buscar por placa, técnico, ATP ou contrato Arval"
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-app-surface/90 dark:bg-fleet-graphite/75 border border-app-surface3 dark:border-fleet-titanium/50 rounded-xl text-light-jet dark:text-white placeholder-light-mutedText dark:placeholder-slate-400 focus:outline-none focus:border-light-orange dark:focus:border-fleet-copperGlow focus:ring-2 focus:ring-light-orange/20 dark:focus:ring-fleet-copper/25 transition-all motion-reduce:transition-none font-medium"
            />
          </div>
        </div>
      )}

      {showRefresh && (
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold fleet-card-surface text-light-jet dark:text-slate-200 hover:border-light-orange/60 dark:hover:border-fleet-copper/60 disabled:opacity-60 transition-all shrink-0"
          title="Recarregar indicadores e dados da frota"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isRefreshing ? 'animate-spin motion-reduce:animate-none text-light-orange dark:text-fleet-copperGlow' : ''
            }`}
            aria-hidden="true"
          />
          <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      )}
    </div>
  );
};
