import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Hash,
  MapPin,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { OnboardingPayload } from '../../types/auth';

interface OnboardingPageProps {
  onCancel?: () => void;
  onComplete?: () => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onCancel, onComplete }) => {
  const { user, completeOnboarding, isLoading } = useAuth();

  const [condominiumName, setCondominiumName] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [totalUnits, setTotalUnits] = useState<number>(24);
  const [managerName, setManagerName] = useState(user?.fullName || '');

  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condominiumName.trim()) {
      setError('Por favor, informe o nome do condomínio.');
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim()) {
      setError('Por favor, preencha o endereço completo, cidade e estado.');
      return;
    }
    if (!managerName.trim()) {
      setError('Por favor, informe o nome do responsável pela gestão.');
      return;
    }

    setError(null);

    const payload: OnboardingPayload = {
      condominiumName: condominiumName.trim(),
      document: document.trim() || undefined,
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zipCode: zipCode.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      totalUnits: Number(totalUnits) || 1,
      managerName: managerName.trim(),
    };

    const res = await completeOnboarding(payload);

    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1000);
    } else {
      setError(res.error || 'Falha ao processar o onboarding administrativo.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-indigo-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-blue-600 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-3">
          <Building2 className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          CONFIGURAÇÃO DO CONDOMÍNIO
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Onboarding administrativo e ativação do ambiente seguro
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Condomínio Criado com Sucesso!</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  As tabelas isoladas, regras de segurança RLS e seu perfil de Administrador foram configurados. Carregando seu painel...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Informações Institucionais */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    1. Dados Básicos do Condomínio
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      id="onboarding-condo-name"
                      label="Nome Oficial do Condomínio"
                      placeholder="Ex: Condomínio Residencial Jardins"
                      value={condominiumName}
                      onChange={(e) => setCondominiumName(e.target.value)}
                      required
                    />
                  </div>

                  <Input
                    id="onboarding-condo-doc"
                    label="CNPJ do Condomínio (Opcional)"
                    placeholder="00.000.000/0001-00"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    leftIcon={<Hash className="w-4 h-4" />}
                  />

                  <Input
                    id="onboarding-condo-units"
                    type="number"
                    label="Total Estimado de Apartamentos"
                    placeholder="Ex: 32"
                    min={1}
                    value={totalUnits}
                    onChange={(e) => setTotalUnits(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Endereço e Localização */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    2. Localização & Contato
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <Input
                      id="onboarding-condo-address"
                      label="Endereço Completo (Rua, Número, Bairro)"
                      placeholder="Ex: Av. das Nações, 1500 - Jardim América"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Input
                      id="onboarding-condo-city"
                      label="Cidade"
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      UF / Estado
                    </label>
                    <select
                      id="onboarding-condo-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                      required
                    >
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    id="onboarding-condo-zip"
                    label="CEP"
                    placeholder="00000-000"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                  />

                  <Input
                    id="onboarding-condo-phone"
                    label="Telefone de Contato"
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    leftIcon={<Phone className="w-4 h-4" />}
                  />

                  <Input
                    id="onboarding-condo-email"
                    type="email"
                    label="Email Institucional"
                    placeholder="contato@condominio.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Responsável da Gestão */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    3. Administrador / Síndico Responsável
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="onboarding-manager-name"
                    label="Seu Nome Completo"
                    placeholder="Ex: Carlos Silva"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    required
                  />

                  <Input
                    id="onboarding-manager-email"
                    label="Email da Conta Autenticada"
                    value={user?.email || ''}
                    disabled
                    helperText="Vinculado à sua sessão segura"
                    leftIcon={<Mail className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Security Shield Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O servidor criará o condomínio e atribuirá o papel <strong>Administrador (admin)</strong> à sua conta de forma atômica. Seus dados estarão estritamente isolados por Row Level Security (RLS).
                </p>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Voltar
                  </Button>
                )}
                <Button
                  id="btn-submit-onboarding"
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="ml-auto"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Concluir e Acessar Painel
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Processamento server-side seguro • Sem exposição de credenciais</span>
        </div>
      </div>
    </div>
  );
};
