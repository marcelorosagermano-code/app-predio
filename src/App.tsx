import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';
import { InactiveUserView } from './pages/auth/InactiveUserView';
import { NoCondominiumView } from './pages/auth/NoCondominiumView';
import { FirstAccessPage } from './pages/auth/FirstAccessPage';
import { AdminDashboard } from './pages/dashboard/AdminDashboard';
import { MoradorDashboard } from './pages/dashboard/MoradorDashboard';
import { UnidadesPage } from './pages/unidades/UnidadesPage';
import { FinanceiroPage } from './pages/financeiro/FinanceiroPage';
import { ManutencaoPage } from './pages/manutencao/ManutencaoPage';
import { ComunicadosPage } from './pages/comunicados/ComunicadosPage';
import { DocumentosPage } from './pages/documentos/DocumentosPage';
import { AssembleiasPage } from './pages/assembleias/AssembleiasPage';
import { ConfiguracoesPage } from './pages/configuracoes/ConfiguracoesPage';
import { MoradorAreaPage } from './pages/morador/MoradorAreaPage';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from './components/ui/Button';

const AppContent: React.FC = () => {
  const { status, user, isAdmin, isSindico, isCouncil, hasPermission } = useAuth();
  
  const getInitialTab = (): string => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get('tab');
      if (tabFromUrl) return tabFromUrl;

      const hash = window.location.hash;
      if (hash.startsWith('#tab=')) {
        return hash.replace('#tab=', '');
      }

      const savedTab = localStorage.getItem('remix_current_tab');
      if (savedTab) return savedTab;
    } catch {}
    return 'dashboard';
  };

  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(false);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem('remix_current_tab', tab);
      const url = new URL(window.location.href);
      if (tab === 'dashboard') {
        url.pathname = '/dashboard';
        url.search = '';
      } else if (tab === 'morador-dashboard') {
        url.pathname = '/portal';
        url.search = '';
      } else {
        url.searchParams.set('tab', tab);
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  // Sincronizar tab no storage e na URL e suportar navegação do browser
  useEffect(() => {
    try {
      localStorage.setItem('remix_current_tab', currentTab);
      const url = new URL(window.location.href);
      if (currentTab === 'dashboard' && url.pathname !== '/dashboard') {
        url.pathname = '/dashboard';
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } else if (currentTab === 'morador-dashboard' && url.pathname !== '/portal') {
        url.pathname = '/portal';
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } else if (currentTab !== 'dashboard' && currentTab !== 'morador-dashboard' && url.searchParams.get('tab') !== currentTab) {
        url.searchParams.set('tab', currentTab);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}

    const onPopState = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab') || localStorage.getItem('remix_current_tab') || 'dashboard';
        setCurrentTab(tab);
      } catch {}
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentTab]);

  // Detectar link de recuperação de senha do Supabase na URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || window.location.pathname === '/reset-password') {
      setIsPasswordRecoveryMode(true);
    }
  }, []);

  // Ajustar tab inicial conforme o perfil do usuário logado
  useEffect(() => {
    if (user) {
      // Admin e Síndico: Forçar para o painel administrativo caso tentem acessar área de morador
      if (user.role === 'admin' || user.role === 'sindico') {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      } 
      // Conselho: Também utiliza a visão administrativa mas com permissões restritas
      else if (user.role === 'conselho') {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      }
      // Morador: Forçar para o portal do morador caso tentem acessar área administrativa
      else if (user.role === 'morador') {
        if (!currentTab.startsWith('morador-')) {
          handleSelectTab('morador-dashboard');
        }
      }
    }
  }, [user?.role, user?.id, currentTab]);

  // 1. Estado de Recuperação de Senha
  if (isPasswordRecoveryMode) {
    return (
      <ResetPasswordPage
        onSuccessRedirect={() => {
          setIsPasswordRecoveryMode(false);
          window.location.hash = '';
        }}
      />
    );
  }

  // 2. Estado de Carregamento
  if (status === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-300">Carregando Sistema de Gestão...</p>
        </div>
      </div>
    );
  }

  // 3. Primeiro Acesso Obrigatório do Morador -> Obrigatório Alterar a Senha Inicial Provisória
  if (status === 'FIRST_ACCESS' || (user?.role === 'morador' && user?.mustChangePassword)) {
    return <FirstAccessPage />;
  }

  // 4. Não Autenticado -> Exibir Tela de Login / Cadastro
  if (status === 'UNAUTHENTICATED' || !user) {
    return <LoginPage />;
  }

  // 5. Usuário Inativo -> Exibir Tela de Bloqueio Informativo
  if (status === 'INACTIVE') {
    return <InactiveUserView />;
  }

  // 6. Usuário Autenticado mas Sem Condomínio Vinculado -> Onboarding ou Aguardando
  if (status === 'NO_CONDOMINIUM' || status === 'PROFILE_MISSING') {
    if (isOnboardingOpen) {
      return (
        <OnboardingPage
          onCancel={() => setIsOnboardingOpen(false)}
          onComplete={() => setIsOnboardingOpen(false)}
        />
      );
    }
    return <NoCondominiumView onStartOnboarding={() => setIsOnboardingOpen(true)} />;
  }

  // 6. Roteamento com Guard de Autorização Granular
  const renderContent = () => {
    // Dashboard Geral / Administrativo
    if (currentTab === 'dashboard') {
      return (isAdmin || isSindico || isCouncil) ? (
        <AdminDashboard onNavigate={handleSelectTab} />
      ) : (
        <MoradorDashboard onNavigate={handleSelectTab} />
      );
    }

    // Gestão de Unidades
    if (currentTab === 'unidades') {
      if (!hasPermission('units:view')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <UnidadesPage />;
    }

    // Controle Financeiro
    if (currentTab === 'financeiro') {
      if (!hasPermission('financial:view_all')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <FinanceiroPage />;
    }

    // Ordens de Serviço & Manutenção
    if (currentTab === 'manutencao') {
      if (!hasPermission('maintenance:view_all')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <ManutencaoPage />;
    }

    // Comunicados do Condomínio
    if (currentTab === 'comunicados') {
      if (!hasPermission('announcements:view')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <ComunicadosPage />;
    }

    // Repositório de Documentos
    if (currentTab === 'documentos') {
      if (!hasPermission('documents:view_admin') && !hasPermission('documents:view_public')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <DocumentosPage />;
    }

    // Assembleias & Votações
    if (currentTab === 'assembleias') {
      if (!hasPermission('assemblies:view')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <AssembleiasPage />;
    }

    // Parametrização e Configurações
    if (currentTab === 'configuracoes') {
      if (!hasPermission('settings:view')) {
        return <UnauthorizedView onGoHome={() => handleSelectTab('morador-dashboard')} />;
      }
      return <ConfiguracoesPage />;
    }

    // Rotas da Área do Morador
    if (currentTab === 'morador-dashboard') {
      return <MoradorDashboard onNavigate={handleSelectTab} />;
    }

    if (currentTab === 'morador-unidade') {
      return <MoradorAreaPage initialSubTab="unidade" />;
    }

    if (currentTab === 'morador-financeiro') {
      return <MoradorAreaPage initialSubTab="financeiro" />;
    }

    if (currentTab === 'morador-comunicados') {
      return <MoradorAreaPage initialSubTab="comunicados" />;
    }

    if (currentTab === 'morador-manutencao') {
      return <MoradorAreaPage initialSubTab="manutencoes" />;
    }

    if (currentTab === 'morador-documentos') {
      return <MoradorAreaPage initialSubTab="documentos" />;
    }

    if (currentTab === 'morador-assembleias') {
      return <MoradorAreaPage initialSubTab="assembleias" />;
    }

    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Módulo não encontrado ou em desenvolvimento.
      </div>
    );
  };

  return (
    <MainLayout currentTab={currentTab} onSelectTab={handleSelectTab}>
      {renderContent()}
    </MainLayout>
  );
};

const UnauthorizedView: React.FC<{ onGoHome: () => void }> = ({ onGoHome }) => (
  <div className="py-16 px-4 max-w-lg mx-auto text-center space-y-4">
    <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
      <ShieldAlert className="w-7 h-7" />
    </div>
    <h3 className="text-lg font-bold text-slate-900">Acesso Restrito</h3>
    <p className="text-xs text-slate-600 leading-relaxed">
      Seu perfil de acesso atual não possui permissões para visualizar ou gerenciar este módulo.
    </p>
    <div className="pt-3">
      <Button
        variant="primary"
        size="md"
        onClick={onGoHome}
        leftIcon={<ArrowLeft className="w-4 h-4" />}
      >
        Voltar para a Área Inicial
      </Button>
    </div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
