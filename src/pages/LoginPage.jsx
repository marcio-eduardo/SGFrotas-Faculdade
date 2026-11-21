import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { AnimatedBackdrop } from '../components/common/AnimatedBackdrop';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Users,
  Smartphone,
  Terminal,
  Info,
  CheckCircle2,
} from 'lucide-react';

export function LoginPage() {
  const { login, sessionError, setSessionError } = useAuth();

  const [loginInput, setLoginInput] = useState('supervisor.frota@velocetech.com.br');
  const [password, setPassword] = useState('veloce@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(sessionError || '');
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [activePersonaTab, setActivePersonaTab] = useState('SUPERVISOR'); // 'SUPERVISOR' | 'TECNICO' | 'TI'

  const handleSeededLogin = async (email) => {
    setLoginInput(email);
    setPassword('veloce@2026');
    setErrorMessage('');
    setSessionError(null);
    setLoading(true);
    try {
      await login({ loginInput: email, password: 'veloce@2026' });
    } catch (err) {
      setErrorMessage(err.message || 'Falha ao autenticar no Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Alterna preenchimento do formulário conforme a aba selecionada
  const handleSelectPersona = (persona) => {
    setActivePersonaTab(persona);
    setErrorMessage('');
    if (persona === 'TI') {
      setLoginInput('ti.admin@velocetech.com.br');
      setPassword('veloce@2026');
    } else if (persona === 'SUPERVISOR') {
      setLoginInput('supervisor.frota@velocetech.com.br');
      setPassword('veloce@2026');
    } else if (persona === 'TECNICO') {
      setLoginInput('rafael.costa@velocetech.com.br');
      setPassword('veloce@2026');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      await login({ loginInput, password });
    } catch (err) {
      setErrorMessage(err.message || 'Erro ao realizar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-app-bg dark:bg-fleet-obsidian flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      {/* Fundo Unificado + Animação Centralizada em tailwind.config.js */}
      <div aria-hidden="true" className="fleet-backdrop-layer" />
      <AnimatedBackdrop hasSidebar={false} />

      {/* Card Principal de Login */}
      <div className="relative z-10 w-full max-w-md fleet-surface-elevated rounded-3xl shadow-card dark:shadow-card-dark p-6 sm:p-8 backdrop-blur-xl">
        
        {/* Cabeçalho da Marca SGFrotas + VeloceTech */}
        <BrandLogo variant="login" />

        {/* Alerta de Erro de Sessão / Credenciais (Genérico anti-enumeração) */}
        {(errorMessage || sessionError) && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
            <div className="flex-1">
              <span className="font-semibold">{errorMessage || sessionError}</span>
            </div>
          </div>
        )}

        {/* Seletor de Tipo de Acesso */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-app-surface2 dark:bg-fleet-graphite/75 rounded-2xl mb-6 border border-app-surface3 dark:border-fleet-titanium/45">
          <button
            type="button"
            onClick={() => handleSelectPersona('SUPERVISOR')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePersonaTab === 'SUPERVISOR'
                ? 'bg-app-surface dark:bg-fleet-charcoal text-brand-700 dark:text-fleet-copperGlow shadow-sm'
                : 'text-light-charcoalText dark:text-slate-400 hover:text-light-jet dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gestor</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('TECNICO')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePersonaTab === 'TECNICO'
                ? 'bg-app-surface dark:bg-fleet-charcoal text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-light-charcoalText dark:text-slate-400 hover:text-light-jet dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Técnico</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPersona('TI')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activePersonaTab === 'TI'
                ? 'bg-app-surface dark:bg-fleet-charcoal text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-light-charcoalText dark:text-slate-400 hover:text-light-jet dark:hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>TI Admin</span>
          </button>
        </div>

        {/* Formulário de Autenticação */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-light-jet dark:text-slate-300 mb-1.5">
              E-mail Corporativo ou Matrícula
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-light-mutedText absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="nome.sobrenome@velocetech.com.br"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-app-surface2/60 dark:bg-fleet-graphite/60 border border-app-surface3 dark:border-fleet-titanium/55 rounded-xl text-light-jet dark:text-white placeholder-light-mutedText focus:outline-none focus:border-brand-500 dark:focus:border-fleet-copperGlow focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-fleet-copper/25 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-light-jet dark:text-slate-300">
                Senha de Acesso
              </label>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-[11px] font-semibold text-brand-700 dark:text-fleet-copperGlow hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-light-mutedText absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-app-surface2/60 dark:bg-fleet-graphite/60 border border-app-surface3 dark:border-fleet-titanium/55 rounded-xl text-light-jet dark:text-white placeholder-light-mutedText focus:outline-none focus:border-brand-500 dark:focus:border-fleet-copperGlow focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-fleet-copper/25 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-light-mutedText hover:text-light-jet dark:hover:text-slate-200 absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Opção Manter Conectado & Aviso de Inatividade */}
          <div className="flex items-center justify-between text-xs text-light-charcoalText dark:text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-app-surface3 dark:border-slate-700"
              />
              <span className="text-[11px]">Lembrar credenciais</span>
            </label>
            <span className="text-[10px] text-light-mutedText dark:text-slate-500 font-mono">
              Timeout 15 min (RBAC)
            </span>
          </div>

          {/* Botão de Submissão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-light-orange hover:bg-light-orangeHover dark:bg-gradient-to-r dark:from-fleet-copper dark:to-fleet-copperGlow dark:hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 dark:shadow-glow-copper hover:shadow-brand-500/35 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Acessar Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Separador */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-app-surface3 dark:border-fleet-titanium/45" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-light-mutedText dark:text-fleet-bronze bg-app-surface dark:bg-fleet-charcoal px-3">
            Acesso Rápido de Demonstração
          </div>
        </div>

        {/* Pílulas de Acesso Rápido via Supabase Auth (tb_usuarios) */}
        <div className="space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSeededLogin('ti.admin@velocetech.com.br')}
            className="w-full p-2.5 bg-indigo-50/80 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl transition-all flex items-center justify-between text-left group disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                TI
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 group-hover:text-indigo-600 transition-colors">
                  TI Admin (Manutenção & Infra)
                </div>
                <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400">
                  ti.admin@velocetech.com.br • Acesso Total
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-indigo-800/60 text-indigo-800 dark:text-indigo-200">
              Supabase
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSeededLogin('supervisor.frota@velocetech.com.br')}
            className="w-full p-2.5 bg-brand-50/80 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 border border-brand-200/80 dark:border-brand-800/60 rounded-xl transition-all flex items-center justify-between text-left group disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-light-orange text-white flex items-center justify-center font-bold text-xs shadow-sm">
                GF
              </div>
              <div>
                <div className="text-xs font-bold text-light-jet dark:text-slate-100 group-hover:text-brand-700 transition-colors">
                  Supervisor de Frotas (Gestão)
                </div>
                <div className="text-[10px] text-light-charcoalText dark:text-slate-400">
                  supervisor.frota@velocetech.com.br • Torre de Controle
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-200/70 dark:bg-brand-800/60 text-brand-800 dark:text-brand-200">
              Supabase
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSeededLogin('rafael.costa@velocetech.com.br')}
            className="w-full p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl transition-all flex items-center justify-between text-left group disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                TC
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                  Técnico de Campo (PWA)
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  rafael.costa@velocetech.com.br • Perfil Operacional
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
              Supabase
            </span>
          </button>
        </div>

        {/* Rodapé de Segurança e Governança */}
        <div className="mt-6 pt-4 border-t border-app-surface3/80 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[10px] text-light-mutedText">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Autenticação RBAC • VeloceTech Serviços Técnicos</span>
        </div>
      </div>

      {/* Modal / Informação de Esqueci Minha Senha */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-app-surface dark:bg-slate-900 border border-app-surface3 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-700 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-light-jet dark:text-white">
                  Recuperação de Acesso
                </div>
                <div className="text-xs text-light-mutedText">Central de Serviços VeloceTech</div>
              </div>
            </div>
            <p className="text-xs text-light-charcoalText dark:text-slate-300 leading-relaxed">
              Por questões de segurança e conformidade LGPD, o reset de senhas é realizado exclusivamente através do portal de chamados internos ou pelo Service Desk no e-mail:
              <br />
              <strong className="text-brand-700 dark:text-brand-400 font-mono text-[11px]">
                suporte.ti@velocetech.com.br
              </strong>
            </p>
            <button
              onClick={() => setForgotModalOpen(false)}
              className="w-full py-2.5 bg-app-surface2 dark:bg-slate-800 hover:bg-app-surface3 dark:hover:bg-slate-700 text-light-jet dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

