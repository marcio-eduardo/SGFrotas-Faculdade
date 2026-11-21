import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandLogo, KwidMenuIcon } from '../common/BrandLogo';
import {
  LayoutDashboard,
  CalendarClock,
  Wrench,
  Fuel,
  AlertTriangle,
  Smartphone,
  ClipboardCheck,
  Flame,
  Building2,
  Users,
  Settings,
  FileBarChart2,
  Bell,
  HelpCircle,
  Terminal,
  LogOut,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  X,
} from 'lucide-react';

const SidebarBody = ({ activeTab, onSelectTab, onExportReport, onItemTriggered }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const role = user?.role || 'GESTOR_SUPERVISOR';

  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [pinnedGroup, setPinnedGroup] = useState(null);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const hoverCloseTimerRef = useRef(null);

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  useEffect(() => () => clearHoverCloseTimer(), []);

  // Organização oficial da Sidebar conforme referência aprovada
  const managerNavItems = [
    { type: 'item', id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { type: 'divider', id: 'div-top' },
    {
      type: 'accordion',
      id: 'gestao_frotas',
      label: 'Gestão de frotas',
      icon: KwidMenuIcon,
      children: [
        { id: 'veiculos', label: 'Status', icon: KwidMenuIcon },
        { id: 'prazos', label: 'Prazos', icon: CalendarClock },
        { id: 'manutencao', label: 'Manutenção', icon: Wrench },
      ],
    },
    { type: 'item', id: 'combustivel', label: 'Combustível', icon: Fuel },
    { type: 'item', id: 'multas', label: 'Multas', icon: AlertTriangle },
    { type: 'divider', id: 'div-mid' },
    {
      type: 'accordion',
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      children: [
        { id: 'atps', label: 'ATPs', icon: Building2 },
        { id: 'tecnicos', label: 'Condutores', icon: Users },
        { id: 'relatorios', label: 'Relatórios', icon: FileBarChart2, isReport: true },
        ...(role === 'TI_ADMIN'
          ? [{ id: 'painel_ti', label: 'Painel TI', icon: Terminal }]
          : []),
      ],
    },
    { type: 'item', id: 'notificacoes', label: 'Notificações', icon: Bell },
    { type: 'item', id: 'ajuda', label: 'Central de ajuda', icon: HelpCircle },
  ];

  const technicianNavItems = [
    { type: 'item', id: 'tecnico_cautela', label: 'Meu Veículo', icon: Smartphone },
    { type: 'item', id: 'tecnico_checklist', label: 'Checklist 360°', icon: ClipboardCheck },
    { type: 'item', id: 'tecnico_sinistros', label: 'Sinistros', icon: Flame },
    { type: 'item', id: 'combustivel', label: 'Combustível', icon: Fuel },
    { type: 'divider', id: 'div-tech' },
    { type: 'item', id: 'notificacoes', label: 'Notificações', icon: Bell },
    { type: 'item', id: 'ajuda', label: 'Central de ajuda', icon: HelpCircle },
  ];

  const navEntries = role === 'TECNICO_OPERACIONAL' ? technicianNavItems : managerNavItems;

  const triggerSelection = (entry) => {
    setHoveredGroup(null);
    setPinnedGroup(null);
    if (entry.isReport) {
      onExportReport?.();
    } else {
      onSelectTab(entry.id);
    }
    onItemTriggered?.();
  };

  return (
    <>
      {/* Topo: Logo integrado SGFrotas + Kwid */}
      <div className="px-4 pt-[35px] pb-4 text-center">
        <BrandLogo variant="sidebar" />
      </div>

      {/* Cartão de Perfil do Usuário (abaixo do logo principal) */}
      <div className="px-4 pb-3">
        <div className="rounded-2xl p-3.5 fleet-surface-muted flex flex-col items-center text-center gap-1.5">
          <div className="w-12 h-12 rounded-full bg-app-surface dark:bg-fleet-charcoal border-2 border-app-surface3 dark:border-fleet-titanium/65 flex items-center justify-center font-black text-sm text-light-jet dark:text-white shadow-sm">
            {user?.avatar || 'US'}
          </div>

          <div className="w-full min-w-0">
            <div className="text-xs font-bold text-light-jet dark:text-white truncate leading-snug">
              {user?.name || 'Usuário Corporativo'}
            </div>
          </div>

          <span className="px-3 py-0.5 rounded-full text-[10px] font-semibold bg-app-surface/90 dark:bg-fleet-charcoal/80 text-light-charcoalText dark:text-slate-300 border border-app-surface3 dark:border-fleet-titanium/55">
            {user?.roleLabel || 'Colaborador'}
          </span>

          <button
            type="button"
            onClick={() => setProfileExpanded((prev) => !prev)}
            className="text-[11px] font-semibold text-light-mutedText dark:text-slate-400 hover:text-light-jet dark:hover:text-white transition-colors"
          >
            {profileExpanded ? 'Ocultar Perfil' : 'Ver Perfil'}
          </button>

          {profileExpanded && (
            <div className="w-full pt-2 mt-0.5 border-t border-app-surface3/80 dark:border-fleet-titanium/35 text-[10px] text-light-charcoalText dark:text-slate-400 space-y-0.5 font-mono">
              <div className="truncate">Matrícula: {user?.matricula || '—'}</div>
              <div className="truncate">{user?.atp || 'Corporativo'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Navegação Vertical Limpa */}
      <nav className="flex-1 px-4 py-1 overflow-y-auto space-y-1">
        {navEntries.map((entry) => {
          if (entry.type === 'divider') {
            return (
              <div
                key={entry.id}
                role="separator"
                className="my-2 border-t border-app-surface3 dark:border-fleet-titanium/35"
              />
            );
          }

          if (entry.type === 'accordion') {
            const isChildActive = entry.children.some((c) => c.id === activeTab);
            const isOpen = hoveredGroup === entry.id || pinnedGroup === entry.id;
            const Icon = entry.icon;

            return (
              <div
                key={entry.id}
                className="space-y-1"
                onMouseEnter={() => {
                  clearHoverCloseTimer();
                  setHoveredGroup(entry.id);
                }}
                onMouseLeave={() => {
                  clearHoverCloseTimer();
                  hoverCloseTimerRef.current = setTimeout(() => {
                    setHoveredGroup((prev) => (prev === entry.id ? null : prev));
                  }, 140);
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setHoveredGroup((prev) => (prev === entry.id ? null : prev));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setHoveredGroup(null);
                    setPinnedGroup(null);
                  }
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    clearHoverCloseTimer();
                    if (pinnedGroup === entry.id) {
                      setPinnedGroup(null);
                      setHoveredGroup(null);
                    } else {
                      setPinnedGroup(entry.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isChildActive
                      ? 'bg-app-surface2 dark:bg-fleet-graphite/70 text-light-jet dark:text-white border border-app-surface3 dark:border-fleet-titanium/40'
                      : 'fleet-nav-idle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isChildActive
                          ? 'text-light-orange dark:text-fleet-copperGlow'
                          : 'text-light-mutedText dark:text-slate-400'
                      }`}
                    />
                    <span className="truncate">{entry.label}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-light-mutedText dark:text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-light-mutedText dark:text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="pl-4 pr-1 py-0.5 space-y-1 ml-3 border-l border-app-surface3 dark:border-fleet-titanium/40">
                    {entry.children.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => triggerSelection(sub)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                            isSubActive
                              ? 'fleet-nav-active shadow-xs'
                              : 'fleet-nav-idle font-medium'
                          }`}
                        >
                          <SubIcon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSubActive
                                ? 'text-brand-700 dark:text-fleet-copperGlow'
                                : 'text-light-mutedText dark:text-slate-400'
                            }`}
                          />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const Icon = entry.icon;
          const isActive = activeTab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => triggerSelection(entry)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive ? 'fleet-nav-active shadow-xs' : 'fleet-nav-idle'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? 'text-brand-700 dark:text-fleet-copperGlow'
                    : 'text-light-mutedText dark:text-slate-400'
                }`}
              />
              <span className="truncate">{entry.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Rodapé Inferior: Logo Positivo Tecnologia + Sair + Switch Light/Dark */}
      <div className="px-4 pt-2 pb-4 space-y-3">
        <div className="py-1.5 flex justify-center">
          <BrandLogo variant="positivo" />
        </div>

        <div className="pt-2.5 border-t border-app-surface3 dark:border-fleet-titanium/35 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onItemTriggered?.();
              logout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-light-charcoalText dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sair</span>
          </button>

          <div className="flex items-center justify-between px-3 pt-0.5 text-[11px] font-bold">
            <span
              className={
                !isDark
                  ? 'text-light-orange'
                  : 'text-light-mutedText dark:text-slate-500'
              }
            >
              Light
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              onClick={toggleTheme}
              className="relative inline-flex h-6 w-12 items-center rounded-full bg-app-surface3 dark:bg-fleet-graphite border border-app-surface3 dark:border-fleet-titanium/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-light-orange dark:focus-visible:ring-fleet-copperGlow"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-app-surface dark:bg-fleet-copper text-light-orange dark:text-white shadow-sm transform transition-transform ${
                  isDark ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              >
                {isDark ? (
                  <Moon className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <Sun className="w-3 h-3" aria-hidden="true" />
                )}
              </span>
            </button>

            <span
              className={
                isDark
                  ? 'text-fleet-copperGlow'
                  : 'text-light-mutedText dark:text-slate-500'
              }
            >
              Dark
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export const Sidebar = ({
  activeTab,
  onSelectTab,
  onExportReport,
  mobileOpen = false,
  onCloseMobile,
}) => {
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Sidebar fixa em telas grandes (lg+) */}
      <aside className="hidden lg:flex w-64 bg-app-surface/95 backdrop-blur-md dark:bg-fleet-obsidian/95 dark:backdrop-blur-md h-screen fixed top-0 left-0 flex-col z-50 border-r border-app-surface3 dark:border-fleet-titanium/35 select-none transition-colors duration-200 shadow-sm dark:shadow-none">
        <SidebarBody
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          onExportReport={onExportReport}
        />
      </aside>

      {/* Gaveta mobile acionada pelo botão de perfil na Topbar (< lg) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            aria-hidden="true"
            onClick={() => onCloseMobile?.()}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação lateral"
            className="fixed top-16 right-0 bottom-0 w-72 max-w-[88vw] bg-app-surface dark:bg-fleet-obsidian border-l border-app-surface3 dark:border-fleet-titanium/45 flex flex-col select-none shadow-2xl"
          >
            <button
              type="button"
              onClick={() => onCloseMobile?.()}
              aria-label="Fechar menu"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-light-mutedText dark:text-slate-400 hover:text-light-jet dark:hover:text-white hover:bg-app-surface2 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarBody
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              onExportReport={onExportReport}
              onItemTriggered={onCloseMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
};
