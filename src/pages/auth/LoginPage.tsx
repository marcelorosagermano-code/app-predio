import React, { useState } from 'react';
import {
  Building2,
  Lock,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const { login, isLoading, legacyCondominio } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Por favor, informe seu apartamento ou e-mail.');
      return;
    }
    if (!password) {
      setError('Por favor, informe sua senha de acesso.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await login(identifier.trim(), password);
      if (!res.success) {
        setError(res.error || 'Credenciais inválidas. Verifique os dados informados.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Geometric Glow */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-500 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-600 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Acesso ao Condomínio
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Sistema de Gestão Condominial
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* FORMULÁRIO DE ACESSO ÚNICO */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Input
                id="login-identifier"
                type="text"
                label="Apartamento ou e-mail"
                placeholder="Digite seu apartamento ou e-mail"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4" />}
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    id="btn-toggle-login-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    title={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                    aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
                required
              />
            </div>

            {/* Dica de Primeiro Acesso */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
              <span className="font-semibold block mb-0.5">Primeiro acesso do morador?</span>
              Utilize o número do seu apartamento e a senha padrão <span className="font-mono font-bold bg-indigo-100 px-1 py-0.5 rounded">000000</span> para definir sua senha pessoal.
            </div>

            <div className="pt-2">
              <Button
                id="btn-login-submit"
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting || isLoading}
                className="w-full tracking-wide uppercase font-bold text-xs"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                ENTRAR NO SISTEMA
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultEmail={identifier.includes('@') ? identifier : ''}
      />
    </div>
  );
};

