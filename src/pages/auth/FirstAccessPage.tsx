import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';

export const FirstAccessPage: React.FC = () => {
  const { user, completeFirstAccess, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validação flexível: qualquer senha que o usuário quiser (mínimo 6 caracteres do Supabase Auth e confirmação idêntica)
  const hasMinimumLength = newPassword.length >= 6;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = hasMinimumLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword) {
      setErrorMessage('Por favor, informe a nova senha desejada.');
      return;
    }

    if (!hasMinimumLength) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('As senhas digitadas não coincidem. Verifique a confirmação.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await completeFirstAccess(newPassword);
      if (res.success) {
        setSuccessMessage('Senha cadastrada com sucesso! Redirecionando para o Portal do Morador...');
      } else {
        setErrorMessage(res.error || 'Erro ao definir nova senha.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao atualizar a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-2xl font-bold tracking-tight text-slate-900">
          Defina sua Nova Senha
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Você pode escolher qualquer senha de sua preferência para seus próximos acessos ao condomínio.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {/* Card informativo sobre a unidade */}
          <div className="mb-6 p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3">
            <Home className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-indigo-950 block">
                {user?.unitNumber ? `Unidade: ${user.unitNumber}` : 'Unidade Residencial'}
              </span>
              <p className="text-indigo-800/80 text-xs mt-0.5">
                Acesso associado ao morador {user?.fullName || 'cadastrado'}.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-700 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Nova Senha
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a senha que você preferir"
                  className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha para confirmar"
                  className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Verificação visual sutil */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
              <div className={`flex items-center gap-2 ${hasMinimumLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinimumLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Pelo menos 6 caracteres (letras, números ou símbolos livremente)</span>
              </div>
              <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>As duas senhas digitadas coincidem</span>
              </div>
            </div>

            <Button
              id="btn-first-access-submit"
              type="submit"
              variant="primary"
              size="lg"
              disabled={!isFormValid || isLoading}
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}
              className="w-full font-semibold text-sm shadow-sm"
            >
              {isLoading ? 'Salvando nova senha...' : 'Salvar Senha e Acessar Portal'}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center">
            <button
              onClick={() => logout()}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair ou entrar com outra conta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
