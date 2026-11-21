import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Timeout de inatividade de segurança: 15 minutos (em milissegundos)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_STORAGE_KEY = 'sgfrotas_auth_session';

const normalizeUser = (apiUser) => {
  if (!apiUser) return null;
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    matricula: apiUser.matricula,
    role: apiUser.role,
    roleLabel: apiUser.roleLabel || apiUser.role,
    departamento: apiUser.department || apiUser.departamento || 'Operações de Campo',
    avatar: apiUser.avatarInitials || apiUser.avatar || 'US',
    atp: apiUser.baseAtp || apiUser.atp || 'Matriz Operacional',
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const token = parsed?.token || '';
        const isLegacyMock =
          token.startsWith('jwt_rs256_mock_') || token.startsWith('jwt_rs256_demo_');
        if (
          !isLegacyMock &&
          token &&
          parsed.lastActivity &&
          Date.now() - parsed.lastActivity < INACTIVITY_TIMEOUT_MS
        ) {
          return normalizeUser(parsed.user);
        }
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Falha ao restaurar sessão de autenticação:', e);
    }
    return null;
  });

  const [sessionError, setSessionError] = useState(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timerRef = useRef(null);

  const logout = useCallback((reason = null) => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      const token = saved ? JSON.parse(saved)?.token : null;
      if (token) {
        api.logout(token).catch(() => {});
      }
    } catch {
      // Ignorar erros ao encerrar sessão local
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    if (reason) {
      setSessionError(reason);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  // Valida sessão existente contra o Supabase (/api/v1/auth/me)
  useEffect(() => {
    let active = true;
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return undefined;
      const parsed = JSON.parse(saved);
      if (!parsed?.token) return undefined;

      api
        .getMe(parsed.token)
        .then((me) => {
          if (!active) return;
          const normalized = normalizeUser(me);
          setUser(normalized);
          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({ ...parsed, user: normalized })
          );
        })
        .catch((err) => {
          if (!active) return;
          logout(err.message || 'Sessão inválida ou Supabase indisponível.');
        });
    } catch {
      // Ignorar erro de leitura
    }
    return () => {
      active = false;
    };
  }, [logout]);

  const touchActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.lastActivity = now;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {
      // Ignorar erros de quota
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        logout('Sua sessão expirou após 15 minutos de inatividade por motivos de segurança.');
      }
    };

    timerRef.current = setInterval(checkInactivity, 30 * 1000);
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleUserInteraction = () => touchActivity();

    events.forEach((ev) => window.addEventListener(ev, handleUserInteraction, { passive: true }));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, handleUserInteraction));
    };
  }, [user, lastActivity, logout, touchActivity]);

  const login = async ({ loginInput, password }) => {
    setSessionError(null);
    const cleanInput = (loginInput || '').trim();
    if (!cleanInput || !password) {
      throw new Error('Informe seu e-mail corporativo ou matrícula e senha.');
    }

    const res = await api.login({ login: cleanInput, password });
    const normalized = normalizeUser(res.user);
    const now = Date.now();
    const sessionData = {
      user: normalized,
      token: res.access_token,
      loginTime: now,
      lastActivity: now,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    setUser(normalized);
    setLastActivity(now);
    return normalized;
  };

  const hasRole = (allowedRoles = []) => {
    if (!user) return false;
    if (user.role === 'TI_ADMIN') return true;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(user.role);
    }
    return user.role === allowedRoles;
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    sessionError,
    setSessionError,
    login,
    logout,
    hasRole,
    touchActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
