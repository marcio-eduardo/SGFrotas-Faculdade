import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Topbar } from './components/layout/Topbar';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalFiltersBar } from './components/layout/GlobalFiltersBar';
import { AnimatedBackdrop } from './components/common/AnimatedBackdrop';
import { DashboardPage } from './pages/DashboardPage';
import { ControleVeiculosPage } from './pages/ControleVeiculosPage';
import { CombustivelPage } from './pages/CombustivelPage';
import { MultasPage } from './pages/MultasPage';
import { PainelTiPage } from './pages/PainelTiPage';
import { Smartphone, ClipboardCheck, Flame, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRegiao, setSelectedRegiao] = useState('TODAS');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [atpFilter, setAtpFilter] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Abas operacionais mapeadas para a Torre de Controle de Veículos (Gestão de Frotas)
  const isControleVeiculos = ['veiculos', 'prazos', 'manutencao'].includes(activeTab);

  // Ajusta aba padrão conforme o papel ao autenticar
  useEffect(() => {
    if (user?.role === 'TECNICO_OPERACIONAL') {
      setActiveTab('tecnico_cautela');
    } else if (user?.role === 'TI_ADMIN') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('dashboard');
    }
  }, [user?.role]);

  // Garante que o indicador de refresh não fique preso ao trocar de aba
  useEffect(() => {
    setIsRefreshing(false);
  }, [activeTab]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    if (activeTab !== 'dashboard' && !isControleVeiculos) {
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 450);
    }
  }, [activeTab, isControleVeiculos]);

  const handleExportReport = useCallback(() => {
    alert('Relatório executivo consolidado gerado com sucesso em formato PDF/Excel.');
  }, []);

  const handleSelectTab = useCallback((tab) => {
    setAtpFilter(null);
    setActiveTab(tab);
  }, []);

  const handleSelectRegiao = useCallback((regiao) => {
    setSelectedRegiao(regiao);
    setAtpFilter(null);
  }, []);

  const handleNavigateVeiculos = useCallback((options) => {
    if (options?.atpFilter) {
      setSelectedRegiao('TODAS');
      setAtpFilter(options.atpFilter);
    } else {
      setAtpFilter(null);
    }
    setActiveTab('veiculos');
    window.scrollTo?.(0, 0);
  }, []);

  // Se não autenticado, exibe a tela de Login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="relative min-h-screen bg-app-bg dark:bg-fleet-obsidian text-light-jet dark:text-slate-100 flex transition-colors duration-200">
      {/* Fundo Unificado + Animação Centralizada em tailwind.config.js */}
      <div aria-hidden="true" className="fleet-backdrop-layer" />
      <AnimatedBackdrop hasSidebar />

      {/* Sidebar Fixa em Desktop (lg+) & Gaveta em Mobile (< lg) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onExportReport={handleExportReport}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Topbar Exclusiva para Mobile (< lg) */}
      <Topbar
        selectedRegiao={selectedRegiao}
        onSelectRegiao={handleSelectRegiao}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        mobileSidebarOpen={mobileSidebarOpen}
        onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      {/* Conteúdo Principal Dinâmico */}
      <main className="relative z-10 flex-1 min-w-0 lg:pl-64 pt-20 lg:pt-6 pb-12">
        <div className="w-full max-w-[1340px] mx-auto px-4 sm:px-8 lg:px-10 xl:px-12">
          {/* Barra compacta de filtros globais em telas maiores (substitui Topbar desktop) */}
          {user?.role !== 'TECNICO_OPERACIONAL' && (
            <GlobalFiltersBar
              selectedRegiao={selectedRegiao}
              onSelectRegiao={handleSelectRegiao}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              showSearch
              showRefresh
              className="hidden lg:flex justify-between mb-5"
            />
          )}
        {/* 1. Módulo Dedicado de Combustível ValeCard */}
        {activeTab === 'combustivel' && (
          <CombustivelPage
            searchTerm={searchTerm}
            selectedRegiao={selectedRegiao}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {/* 1.1 Módulo Dedicado da Central de Multas (NIC) */}
        {activeTab === 'multas' && (
          <MultasPage
            searchTerm={searchTerm}
            selectedRegiao={selectedRegiao}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {/* 2. Painel Exclusivo de TI & Infraestrutura (TI_ADMIN) */}
        {activeTab === 'painel_ti' && <PainelTiPage />}

        {/* 3. Dashboard Executivo & Indicadores de Frota (BI / Telemetria) */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            selectedRegiao={selectedRegiao}
            selectedPeriod={selectedPeriod}
            refreshKey={refreshKey}
            onLoadingChange={setIsRefreshing}
            searchTerm={searchTerm}
            onNavigateVeiculos={handleNavigateVeiculos}
          />
        )}

        {/* 4. Controle Operacional de Veículos (Inventário / Tabela / Custódia) */}
        {isControleVeiculos && (
          <ControleVeiculosPage
            selectedRegiao={selectedRegiao}
            searchTerm={searchTerm}
            refreshKey={refreshKey}
            onLoadingChange={setIsRefreshing}
            initialPillar={activeTab === 'veiculos' ? 'frota' : activeTab}
            selectedAtpFilter={atpFilter}
            onClearAtpFilter={() => setAtpFilter(null)}
          />
        )}

        {/* 4. Jornada do Técnico em Campo (PWA Field Service) */}
        {activeTab.startsWith('tecnico_') && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 w-fit text-xs font-bold mb-3">
                <Smartphone className="w-3.5 h-3.5" />
                <span>PWA Field Service Mobile • Técnico em Campo</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {activeTab === 'tecnico_cautela' && 'Meu Veículo em Cautela Ativa'}
                {activeTab === 'tecnico_checklist' && 'Checklist Diário 360° da Lataria'}
                {activeTab === 'tecnico_sinistros' && 'Central de Emergência & Sinistros'}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mt-1">
                Condutor: <strong>{user?.name}</strong> • Matrícula: <strong>{user?.matricula}</strong> • Base: <strong>{user?.atp}</strong>
              </p>
            </div>

            {/* Card de Ficha do Veículo Cautelado */}
            <div className="fleet-card-surface rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-fleet-titanium/35">
                <div>
                  <div className="text-xs text-slate-500">Veículo Alocado</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{user?.veiculoCautelado || 'VLC0A42'}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cautela Regular
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{user?.modeloVeiculo || 'Renault Kwid Zen 1.0 2024/2025'}</div>
                </div>

                <div className="flex gap-4">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Odômetro</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-white">42.150 km</div>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Saldo ValeCard</div>
                    <div className="text-sm font-bold text-emerald-600">R$ 450,00</div>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas do Técnico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('tecnico_checklist')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeTab === 'tecnico_checklist'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                  }`}
                >
                  <ClipboardCheck className="w-5 h-5 text-emerald-600 mb-2" />
                  <div className="text-xs font-bold text-slate-800 dark:text-white">Vistoria 360°</div>
                  <div className="text-[10px] text-slate-500">5 fotos WebP + lataria</div>
                </button>

                <button
                  onClick={() => setActiveTab('combustivel')}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 text-left transition-all"
                >
                  <CheckCircle2 className="w-5 h-5 text-brand-600 mb-2" />
                  <div className="text-xs font-bold text-slate-800 dark:text-white">Abastecer</div>
                  <div className="text-[10px] text-slate-500">Foto cupom + km bomba</div>
                </button>

                <button
                  onClick={() => setActiveTab('tecnico_sinistros')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeTab === 'tecnico_sinistros'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-rose-400'
                  }`}
                >
                  <Flame className="w-5 h-5 text-rose-600 mb-2" />
                  <div className="text-xs font-bold text-slate-800 dark:text-white">Socorro & Sinistro</div>
                  <div className="text-[10px] text-slate-500">GPS emergência Arval</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Outros módulos futuros mapeados */}
        {activeTab !== 'dashboard' &&
          !isControleVeiculos &&
          activeTab !== 'combustivel' &&
          activeTab !== 'multas' &&
          activeTab !== 'painel_ti' &&
          !activeTab.startsWith('tecnico_') && (
            <div className="bg-app-surface dark:bg-app-darkSurface p-8 rounded-2xl border border-app-surface3 dark:border-white/10 text-center space-y-3">
              <div className="text-lg font-bold text-light-jet dark:text-white">
                Módulo em Estruturação ({activeTab})
              </div>
              <p className="text-xs text-light-charcoalText dark:text-slate-400 max-w-md mx-auto">
                Este módulo está mapeado no roadmap do projeto SGFrotas — VeloceTech.
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-light-orange hover:bg-light-orangeHover dark:bg-fleet-copper dark:hover:bg-fleet-copperGlow text-white text-xs font-bold rounded-xl transition-all"
              >
                Voltar ao Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
