import React, { useState } from 'react';
import {
  Menu,
  Bell,
  User,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  currentTab: string;
}

const tabTitles: Record<string, { title: string; category: string }> = {
  dashboard: { title: 'Visão Geral & Indicadores', category: 'Administração' },
  unidades: { title: 'Gestão de Apartamentos', category: 'Cadastros' },
  financeiro: { title: 'Controle Financeiro & Lançamentos', category: 'Finanças' },
  manutencao: { title: 'Ordens de Serviço & Manutenção', category: 'Operacional' },
  comunicados: { title: 'Mural de Comunicados', category: 'Comunicação' },
  documentos: { title: 'Central de Documentos', category: 'Documentos' },
  assembleias: { title: 'Assembleias & Atas', category: 'Governança' },
  configuracoes: { title: 'Configurações do Condomínio', category: 'Sistema' },
  'morador-dashboard': { title: 'Minha Área', category: 'Espaço do Morador' },
  'morador-unidade': { title: 'Dados do Meu Apartamento', category: 'Espaço do Morador' },
  'morador-financeiro': { title: 'Minhas Cotas & Boletos', category: 'Espaço do Morador' },
  'morador-comunicados': { title: 'Avisos & Comunicados', category: 'Espaço do Morador' },
  'morador-manutencao': { title: 'Minhas Solicitações', category: 'Espaço do Morador' },
  'morador-documentos': { title: 'Documentos do Condomínio', category: 'Espaço do Morador' },
  'morador-assembleias': { title: 'Assembleias & Votações', category: 'Espaço do Morador' },
};

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, currentTab }) => {
  const { user, condominium, role, isAdmin, isSindico, isCouncil, isMorador, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const currentInfo = tabTitles[currentTab] || {
    title: 'Sistema de Gestão Condominial',
    category: 'Geral',
  };

  const displayName = user?.fullName || 'Usuário';
  const displayCondo = condominium?.name || 'Condomínio';
  const displayEmail = user?.email || '';

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return <Badge variant="indigo" size="sm">Administrador</Badge>;
      case 'sindico':
        return <Badge variant="indigo" size="sm">Síndico</Badge>;
      case 'conselho':
        return <Badge variant="warning" size="sm">Conselho Fiscal</Badge>;
      case 'morador':
      default:
        return <Badge variant="success" size="sm">Morador</Badge>;
    }
  };

  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile menu toggle + Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          id="btn-mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {currentInfo.category}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline truncate">
              {displayCondo}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
            {currentInfo.title}
          </h2>
        </div>
      </div>

      {/* Right: Actions & Real User Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Account Dropdown */}
        <div className="relative">
          <button
            id="btn-header-user-menu"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100 text-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            aria-label="Menu do usuário"
            aria-expanded={isUserMenuOpen}
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {userInitials}
            </div>
            <div className="hidden md:block text-left min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 capitalize leading-none">
                {role === 'admin'
                  ? 'Administrador'
                  : role === 'sindico'
                  ? 'Síndico'
                  : role === 'conselho'
                  ? 'Conselho Fiscal'
                  : user?.unitNumber
                  ? `Apartamento ${user.unitNumber}`
                  : 'Morador'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header Profile Info */}
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-xs truncate">{displayName}</p>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {displayEmail}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      {getRoleBadge()}
                    </div>
                  </div>
                </div>

                {/* Condominium info */}
                <div className="py-2.5 border-b border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">{displayCondo}</span>
                  </div>
                  {user?.unitNumber && (
                    <p className="text-[11px] text-slate-500 pl-5">
                      Apartamento Cadastrado: <span className="font-medium text-slate-700">{user.unitNumber}</span>
                    </p>
                  )}
                  {condominium?.city && (
                    <p className="text-[11px] text-slate-400 pl-5">
                      {condominium.city}{condominium.state ? ` - ${condominium.state}` : ''}
                    </p>
                  )}
                </div>

                {/* Logout Button */}
                <div className="pt-2">
                  <button
                    id="btn-header-logout"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sair da Conta (Logout)</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-medium text-slate-500">Online</span>
        </div>
      </div>
    </header>
  );
};
