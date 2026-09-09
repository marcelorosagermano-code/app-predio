export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'admin' | 'sindico' | 'conselho' | 'morador';
export type UnitStatus = 'occupied' | 'vacant' | 'rented' | 'under_renovation';
export type FinancialEntryType = 'income' | 'expense';
export type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type MaintenanceStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export type AnnouncementCategory = 'general' | 'urgent' | 'maintenance' | 'works' | 'meeting' | 'financial';
export type DocumentCategory = 'regulations' | 'minutes' | 'financial_reports' | 'contracts' | 'notices' | 'other';
export type DocumentVisibility = 'all' | 'admin_only' | 'council';
export type AssemblyType = 'ordinary' | 'extraordinary';
export type AssemblyFormat = 'presential' | 'virtual' | 'hybrid';
export type AssemblyStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Database {
  public: {
    Tables: {
      condominiums: {
        Row: {
          id: string;
          name: string;
          document: string | null;
          address: string;
          city: string;
          state: string;
          zip_code: string | null;
          phone: string | null;
          email: string | null;
          total_units: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          document?: string | null;
          address: string;
          city: string;
          state: string;
          zip_code?: string | null;
          phone?: string | null;
          email?: string | null;
          total_units?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          document?: string | null;
          address?: string;
          city?: string;
          state?: string;
          zip_code?: string | null;
          phone?: string | null;
          email?: string | null;
          total_units?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          module: string;
          description: string | null;
        };
        Insert: {
          id: string;
          name: string;
          module: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          module?: string;
          description?: string | null;
        };
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: {
          role_id?: string;
          permission_id?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          condominium_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          condominium_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string | null;
          full_name?: string;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          condominium_id: string;
          unit_number: string;
          block: string | null;
          floor: number | null;
          sqm: number | null;
          ideal_fraction: number | null;
          status: UnitStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_number: string;
          block?: string | null;
          floor?: number | null;
          sqm?: number | null;
          ideal_fraction?: number | null;
          status?: UnitStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_number?: string;
          block?: string | null;
          floor?: number | null;
          sqm?: number | null;
          ideal_fraction?: number | null;
          status?: UnitStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      unit_owners: {
        Row: {
          id: string;
          unit_id: string;
          profile_id: string | null;
          name: string;
          email: string | null;
          phone: string | null;
          document: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          profile_id?: string | null;
          name: string;
          email?: string | null;
          phone?: string | null;
          document?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          profile_id?: string | null;
          name?: string;
          email?: string | null;
          phone?: string | null;
          document?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      unit_residents: {
        Row: {
          id: string;
          unit_id: string;
          profile_id: string | null;
          name: string;
          email: string | null;
          phone: string | null;
          relationship_type: 'owner' | 'tenant' | 'family_member' | 'dependent' | 'other';
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          profile_id?: string | null;
          name: string;
          email?: string | null;
          phone?: string | null;
          relationship_type?: 'owner' | 'tenant' | 'family_member' | 'dependent' | 'other';
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          profile_id?: string | null;
          name?: string;
          email?: string | null;
          phone?: string | null;
          relationship_type?: 'owner' | 'tenant' | 'family_member' | 'dependent' | 'other';
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_entries: {
        Row: {
          id: string;
          condominium_id: string;
          unit_id: string | null;
          type: FinancialEntryType;
          category: string;
          description: string;
          amount: number;
          due_date: string;
          payment_date: string | null;
          status: FinancialStatus;
          receipt_file_path: string | null;
          barcode: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_id?: string | null;
          type: FinancialEntryType;
          category: string;
          description: string;
          amount: number;
          due_date: string;
          payment_date?: string | null;
          status?: FinancialStatus;
          receipt_file_path?: string | null;
          barcode?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_id?: string | null;
          type?: FinancialEntryType;
          category?: string;
          description?: string;
          amount?: number;
          due_date?: string;
          payment_date?: string | null;
          status?: FinancialStatus;
          receipt_file_path?: string | null;
          barcode?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      maintenance_requests: {
        Row: {
          id: string;
          condominium_id: string;
          unit_id: string | null;
          requester_id: string | null;
          title: string;
          description: string;
          location: string;
          priority: MaintenancePriority;
          status: MaintenanceStatus;
          assigned_to: string | null;
          estimated_cost: number | null;
          actual_cost: number | null;
          opened_at: string;
          completed_at: string | null;
          attachments_file_paths: string[] | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_id?: string | null;
          requester_id?: string | null;
          title: string;
          description: string;
          location: string;
          priority?: MaintenancePriority;
          status?: MaintenanceStatus;
          assigned_to?: string | null;
          estimated_cost?: number | null;
          actual_cost?: number | null;
          opened_at?: string;
          completed_at?: string | null;
          attachments_file_paths?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_id?: string | null;
          requester_id?: string | null;
          title?: string;
          description?: string;
          location?: string;
          priority?: MaintenancePriority;
          status?: MaintenanceStatus;
          assigned_to?: string | null;
          estimated_cost?: number | null;
          actual_cost?: number | null;
          opened_at?: string;
          completed_at?: string | null;
          attachments_file_paths?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          condominium_id: string;
          author_id: string | null;
          title: string;
          content: string;
          category: AnnouncementCategory;
          status: AnnouncementStatus;
          is_pinned: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          author_id?: string | null;
          title: string;
          content: string;
          category?: AnnouncementCategory;
          status?: AnnouncementStatus;
          is_pinned?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          author_id?: string | null;
          title?: string;
          content?: string;
          category?: AnnouncementCategory;
          status?: AnnouncementStatus;
          is_pinned?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          condominium_id: string;
          title: string;
          description: string | null;
          category: DocumentCategory;
          file_path: string;
          file_name: string;
          file_type: string;
          file_size: number;
          visibility: DocumentVisibility;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          title: string;
          description?: string | null;
          category: DocumentCategory;
          file_path: string;
          file_name: string;
          file_type: string;
          file_size: number;
          visibility?: DocumentVisibility;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          title?: string;
          description?: string | null;
          category?: DocumentCategory;
          file_path?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          visibility?: DocumentVisibility;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assemblies: {
        Row: {
          id: string;
          condominium_id: string;
          title: string;
          type: AssemblyType;
          format: AssemblyFormat;
          date: string;
          location: string;
          agenda: string[];
          meeting_url: string | null;
          minutes_file_path: string | null;
          status: AssemblyStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          title: string;
          type?: AssemblyType;
          format?: AssemblyFormat;
          date: string;
          location: string;
          agenda?: string[];
          meeting_url?: string | null;
          minutes_file_path?: string | null;
          status?: AssemblyStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          title?: string;
          type?: AssemblyType;
          format?: AssemblyFormat;
          date?: string;
          location?: string;
          agenda?: string[];
          meeting_url?: string | null;
          minutes_file_path?: string | null;
          status?: AssemblyStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          condominium_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          description: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          description: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          description?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
  };
}
