import { supabase } from './client';
import { OnboardingPayload, AuthCondominium, AuthUserProfile } from '../../types/auth';

export interface OnboardingResult {
  success: boolean;
  condominium?: AuthCondominium;
  profile?: AuthUserProfile;
  error?: string;
}

export const onboardingService = {
  /**
   * Executa o onboarding administrativo de forma segura via backend / Edge Function.
   * O cliente apenas envia os dados cadastrais do condomínio e o token de autenticação.
   * O papel administrativo ('admin') e a vinculação 'condominium_id' são atribuídos
   * exclusivamente pelo servidor com validação de regras de negócio.
   */
  async executeOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
    if (!supabase) {
      return { success: false, error: 'Cliente Supabase não está configurado.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { success: false, error: 'Usuário não autenticado. Faça login para continuar.' };
    }

    const requestBody = {
      name: payload.condominiumName,
      document: payload.document || null,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      zip_code: payload.zipCode || null,
      phone: payload.phone || null,
      email: payload.email || session.user.email || null,
      total_units: payload.totalUnits || 1,
      manager_name: payload.managerName || session.user.user_metadata?.full_name || null,
    };

    // 1. Tentar primeiro via Supabase Edge Function nativa
    try {
      const { data, error } = await supabase.functions.invoke('onboarding', {
        body: requestBody,
      });

      if (!error && data?.success && data?.condominium && data?.profile) {
        return {
          success: true,
          condominium: {
            id: data.condominium.id,
            name: data.condominium.name,
            document: data.condominium.document,
            address: data.condominium.address,
            city: data.condominium.city,
            state: data.condominium.state,
            zipCode: data.condominium.zip_code,
            phone: data.condominium.phone,
            email: data.condominium.email,
            totalUnits: data.condominium.total_units,
            createdAt: data.condominium.created_at,
            updatedAt: data.condominium.updated_at,
          },
          profile: {
            id: data.profile.id,
            email: data.profile.email,
            fullName: data.profile.full_name,
            phone: data.profile.phone,
            avatarUrl: data.profile.avatar_url,
            role: data.profile.role,
            condominiumId: data.profile.condominium_id,
            isActive: data.profile.is_active,
            createdAt: data.profile.created_at,
            updatedAt: data.profile.updated_at,
          },
        };
      }

      if (error && error.message && !error.message.includes('Failed to send') && !error.message.includes('FunctionsFetchError')) {
        return { success: false, error: error.message };
      }
    } catch (edgeErr: any) {
      console.warn('Edge function invoke falhou ou não está implantada, tentando endpoint de backend local /api/onboarding:', edgeErr?.message);
    }

    // 2. Fallback para endpoint server-side local /api/onboarding
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        return {
          success: false,
          error: json.error || 'Erro ao realizar onboarding no servidor.',
        };
      }

      return {
        success: true,
        condominium: {
          id: json.condominium.id,
          name: json.condominium.name,
          document: json.condominium.document,
          address: json.condominium.address,
          city: json.condominium.city,
          state: json.condominium.state,
          zipCode: json.condominium.zip_code,
          phone: json.condominium.phone,
          email: json.condominium.email,
          totalUnits: json.condominium.total_units,
          createdAt: json.condominium.created_at,
          updatedAt: json.condominium.updated_at,
        },
        profile: {
          id: json.profile.id,
          email: json.profile.email,
          fullName: json.profile.full_name,
          phone: json.profile.phone,
          avatarUrl: json.profile.avatar_url,
          role: json.profile.role,
          condominiumId: json.profile.condominium_id,
          isActive: json.profile.is_active,
          createdAt: json.profile.created_at,
          updatedAt: json.profile.updated_at,
        },
      };
    } catch (serverErr: any) {
      return {
        success: false,
        error: serverErr?.message || 'Falha na comunicação com o serviço de onboarding.',
      };
    }
  },
};
