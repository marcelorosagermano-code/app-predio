import { UserRole } from './database';

export type AuthStatus =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'PROFILE_MISSING'
  | 'INACTIVE'
  | 'NO_CONDOMINIUM'
  | 'FIRST_ACCESS'
  | 'READY';

export type PermissionId =
  // Dashboard
  | 'dashboard:view'
  // Unidades
  | 'units:view'
  | 'units:create'
  | 'units:update'
  | 'units:delete'
  // Financeiro
  | 'financial:view_all'
  | 'financial:view_own'
  | 'financial:create'
  | 'financial:update'
  | 'financial:delete'
  // Manutenção
  | 'maintenance:view_all'
  | 'maintenance:view_own'
  | 'maintenance:create'
  | 'maintenance:update'
  | 'maintenance:delete'
  // Comunicados
  | 'announcements:view'
  | 'announcements:create'
  | 'announcements:update'
  | 'announcements:delete'
  // Documentos
  | 'documents:view_public'
  | 'documents:view_admin'
  | 'documents:create'
  | 'documents:delete'
  // Assembleias
  | 'assemblies:view'
  | 'assemblies:create'
  | 'assemblies:update'
  | 'assemblies:delete'
  // Configurações
  | 'settings:view'
  | 'settings:update';

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  condominiumId: string | null;
  unitId?: string | null;
  unidadeId?: string | null;
  unitNumber?: string | null;
  unidadeNumero?: string | null;
  mustChangePassword?: boolean;
  nome?: string;
  cargo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCondominium {
  id: string;
  name: string;
  document: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  totalUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingPayload {
  condominiumName: string;
  document?: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  totalUnits?: number;
  managerName?: string;
}
