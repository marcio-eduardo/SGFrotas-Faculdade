import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';
import { GlobalFiltersBar } from './GlobalFiltersBar';
import { ChevronDown, Smartphone } from 'lucide-react';

/**
 * Topbar exibida exclusivamente em dispositivos móveis (`flex lg:hidden`).
 * Em telas maiores (`lg+`), a barra superior é removida e a navegação fica na Sidebar fixa.
 * Em mobile, o botão de perfil do usuário (`[Avatar] Nome / Matrícula`) abre o menu da Sidebar.
 */
export const Topbar = ({
  selectedRegiao = 'TODAS',
  onSelectRegiao,
  selectedPeriod = '30d',
  onSelectPeriod,
  mobileSidebarOpen = false,
  onToggleMobileSidebar,
}) => {
  const { user } = useAuth();
  const role = user?.role || 'GESTOR_SUPERVISOR';
  const isTecnico = role === 'TECNICO_OPERACIONAL';

  return (
    <header className="flex lg:hidden fixed top-0 left-0 right-0 h-16 bg-app-surface/95 dark:bg-fleet-charcoal/95 backdrop-blur-md border-b border-app-surface3 dark:border-fleet-titanium/40 z-40 px-3 sm:px-4 items-center justify-between gap-2 transition-colors duration-200 motion-reduce:transition-none">
      {/* Esquerda: Logo Mobile + Filtros Rápidos */}
      <div className="flex items-center gap-2 min-w-0">
        <BrandLogo variant="topbar" />

        {!isTecnico ? (
          <GlobalFiltersBar
            selectedRegiao={selectedRegiao}
            onSelectRegiao={onSelectRegiao}
            selectedPeriod={selectedPeriod}
            onSelectPeriod={onSelectPeriod}
            showSearch={false}
          />
        ) : (
          <div className="hidden xs:flex sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="truncate">{user?.veiculoCautelado || 'VLC0A42'}</span>
          </div>
        )}
      </div>

      {/* Direita: Botão de Perfil que abre o menu completo da Sidebar no mobile */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mobileSidebarOpen}
        aria-label="Abrir menu principal e perfil do usuário"
        onClick={() => onToggleMobileSidebar?.()}
        className="flex items-center gap-2.5 pl-2.5 py-1 pr-2 border-l border-app-surface3 dark:border-white/10 hover:bg-app-surface2/80 dark:hover:bg-white/5 rounded-xl transition-all shrink-0"
      >
        <div className="w-8 h-8 rounded-full bg-light-orange dark:bg-gradient-to-tr dark:from-fleet-copper dark:to-fleet-copperGlow text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
          {user?.avatar || 'US'}
        </div>
        <div className="hidden xs:block sm:block text-left">
          <div className="text-xs font-bold text-light-jet dark:text-slate-200 leading-tight max-w-[130px] truncate">
            {user?.name || 'Usuário'}
          </div>
          <div className="text-[10px] text-light-mutedText dark:text-fleet-bronze leading-tight">
            {user?.matricula || 'Corporativo'}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-light-mutedText transition-transform duration-150 ${
            mobileSidebarOpen ? 'rotate-180 text-light-orange dark:text-fleet-copperGlow' : ''
          }`}
          aria-hidden="true"
        />
      </button>
    </header>
  );
};
