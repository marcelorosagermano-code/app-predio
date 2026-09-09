import React from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';

export const InactiveUserView: React.FC = () => {
  const { user, logout, refreshSession, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mx-auto flex items-center justify-center shadow-xl shadow-amber-500/10 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          ACESSO DESATIVADO
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Status de conta: Inativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100 text-center space-y-5">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-900">
              Olá, {user?.fullName || user?.email}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seu acesso ao sistema foi temporariamente desativado ou está aguardando liberação pela administração.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              O que fazer agora?
            </p>
            <p className="text-xs text-slate-600">
              Entre em contato com o síndico ou com a administração do seu condomínio informando seu e-mail de cadastro (<strong>{user?.email}</strong>) para solicitar a ativação.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              id="btn-inactive-refresh"
              variant="outline"
              size="md"
              className="flex-1"
              isLoading={isLoading}
              onClick={() => refreshSession()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Verificar Novamente
            </Button>
            <Button
              id="btn-inactive-logout"
              variant="danger"
              size="md"
              className="flex-1"
              onClick={() => logout()}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
