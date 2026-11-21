import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  itemLabel = 'registros',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems <= pageSize && totalItems > 0 && currentPage === 1) {
    return (
      <div className="py-3 px-5 border-t border-app-surface3 dark:border-white/10 flex items-center justify-between text-xs text-light-charcoalText dark:text-slate-400 bg-app-surface2/70 dark:bg-white/[0.01]">
        <div>
          Mostrando todos os{' '}
          <strong className="font-bold text-light-jet dark:text-white">{totalItems}</strong>{' '}
          {itemLabel}
        </div>
      </div>
    );
  }

  // Gera lista de páginas com ellipsis inteligente
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div className="py-3 px-5 border-t border-app-surface3 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-app-surface2/70 dark:bg-white/[0.01] select-none">
      {/* Indicador de Intervalo */}
      <div className="text-light-charcoalText dark:text-slate-400 text-center sm:text-left">
        Mostrando{' '}
        <strong className="font-bold text-light-jet dark:text-white">{startItem}</strong> a{' '}
        <strong className="font-bold text-light-jet dark:text-white">{endItem}</strong> de{' '}
        <strong className="font-bold text-light-jet dark:text-white">{totalItems}</strong>{' '}
        {itemLabel}
      </div>

      {/* Controles de Navegação */}
      <div className="flex items-center gap-1">
        {/* Primeira Página */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-light-charcoalText hover:text-light-jet dark:text-slate-400 dark:hover:text-white hover:bg-app-surface3/60 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
          title="Primeira página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Página Anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-7 px-2 flex items-center gap-1 rounded-lg text-light-charcoalText hover:text-light-jet dark:text-slate-300 dark:hover:text-white hover:bg-app-surface3/60 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none font-semibold text-[11px]"
          title="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Páginas Numéricas */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-light-mutedText text-xs">
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs transition-all ${
                  isCurrent
                    ? 'fleet-pill-accent shadow-sm'
                    : 'text-light-charcoalText dark:text-slate-400 hover:text-light-jet dark:hover:text-white hover:bg-app-surface3/60 dark:hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Próxima Página */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalItems === 0}
          className="h-7 px-2 flex items-center gap-1 rounded-lg text-light-charcoalText hover:text-light-jet dark:text-slate-300 dark:hover:text-white hover:bg-app-surface3/60 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none font-semibold text-[11px]"
          title="Próxima página"
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Última Página */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalItems === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-light-charcoalText hover:text-light-jet dark:text-slate-400 dark:hover:text-white hover:bg-app-surface3/60 dark:hover:bg-white/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
          title="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
