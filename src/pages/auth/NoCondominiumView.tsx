import React from 'react';
import { Building2, PlusCircle, RefreshCw, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';

interface NoCondominiumViewProps {
  onStartOnboarding: () => void;
}

export const NoCondominiumView: React.FC<NoCondominiumViewProps> = ({ onStartOnboarding }) => {
  const { user, logout, refreshSession, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          VINCULAÇÃO PENDENTE
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Olá, {user?.fullName || user?.email}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-base font-bold text-slate-900">
              Sua conta ainda não está vinculada a um condomínio
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Para começar a utilizar o Sistema de Gestão Condominial, escolha uma das opções abaixo:
            </p>
          </div>

          <div className="space-y-3">
            {/* Opção 1: Síndico / Criar Condomínio */}
            <div className="p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Sou Síndico ou Administrador</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Cadastre o condomínio pela primeira vez e assuma o painel de gestão.
                  </p>
                </div>
              </div>
              <Button
                id="btn-start-onboarding"
                variant="primary"
                size="sm"
                className="w-full sm:w-auto shrink-0"
                onClick={onStartOnboarding}
                rightIcon={<PlusCircle className="w-4 h-4" />}
              >
                Criar Condomínio
              </Button>
            </div>

            {/* Opção 2: Morador / Aguardando */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Sou Morador ou Proprietário</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Solicite ao seu síndico o cadastro ou convite para seu apartamento.
                  </p>
                </div>
              </div>
              <Button
                id="btn-refresh-status"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto shrink-0"
                isLoading={isLoading}
                onClick={() => refreshSession()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Atualizar
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-center">
            <Button
              id="btn-no-condo-logout"
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-rose-600"
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
