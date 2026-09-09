import React from 'react';
import {
  LayoutDashboard,
  Building,
  DollarSign,
  Wrench,
  Megaphone,
  FileText,
  Users,
  Settings,
  X,
  LogOut,
  Building2,
  Home,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/Badge';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user, condominium, role, isAdmin, isSindico, isCouncil, isMorador, hasPermission, logout } = useAuth();

  // Itens para Síndico / Administrador / Conselho
  const adminNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard:view',
    },
    {
      id: 'unidades',
      label: 'Unidades',
      icon: Building,
      permission: 'units:view',
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: DollarSign,
      permission: 'financial:view_all',
    },
    {
      id: 'manutencao',
      label: 'Manutenção',
      icon: Wrench,
      permission: 'maintenance:view_all',
    },
    {
      id: 'comunicados',
      label: 'Comunicados',
      icon: Megaphone,
      permission: 'announcements:view',
    },
    {
      id: 'documentos',
      label: 'Documentos',
      icon: FileText,
      permission: 'documents:view_public',
    },
    {
      id: 'assembleias',
      label: 'Assembleias',
      icon: Users,
      permission: 'assemblies:view',
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      permission: 'settings:view',
    },
  ];

  // Itens para o perfil de Morador
  const moradorNavItems: NavItem[] = [
    {
      id: 'morador-dashboard',
      label: 'Minha Área',
      icon: Home,
    },
    {
      id: 'morador-unidade',
      label: 'Minha Unidade',
      icon: Building,
    },
    {
      id: 'morador-financeiro',
      label: 'Meu Financeiro',
      icon: DollarSign,
    },
    {
      id: 'morador-manutencao',
      label: 'Manutenção',
      icon: Wrench,
    },
    {
      id: 'morador-comunicados',
      label: 'Comunicados',
      icon: Megaphone,
    },
    {
      id: 'morador-documentos',
      label: 'Documentos',
      icon: FileText,
    },
    {
      id: 'morador-assembleias',
      label: 'Assembleias',
      icon: Users,
    },
  ];

  // Filtrar itens por permissão se for painel admin, ou fornecer visão do morador
  const navItems = isMorador
    ? moradorNavItems
    : adminNavItems.filter((item) => !item.permission || hasPermission(item.permission));

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'sindico':
        return 'Síndico';
      case 'conselho':
        return 'Conselho Fiscal';
      case 'morador':
      default:
        return user?.unitNumber ? `Unidade ${user.unitNumber}` : 'Morador';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand & Condominium Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-white tracking-tight truncate leading-tight">
                {condominium?.name || 'Gestão Condominial'}
              </h1>
              <p className="text-[10px] text-slate-400 truncate">
                {isMorador ? 'Portal do Morador' : 'Painel de Gestão'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-mobile-sidebar"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isMorador ? 'Menu Principal' : 'Módulos do Sistema'}
          </div>

          <nav className="space-y-1" aria-label="Navegação Principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/30 text-indigo-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {user?.fullName || 'Usuário'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {getRoleLabel()}
                </p>
              </div>
            </div>

            <button
              id="btn-sidebar-logout"
              onClick={async () => {
                await logout();
              }}
              title="Sair do sistema"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
