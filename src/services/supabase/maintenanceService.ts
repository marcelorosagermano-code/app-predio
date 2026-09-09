import { supabase } from './client';
import { Database, MaintenanceStatus, MaintenancePriority } from '../../types/database';

export type MaintenanceRow = Database['public']['Tables']['maintenance_requests']['Row'];
export type MaintenanceInsert = Database['public']['Tables']['maintenance_requests']['Insert'];
export type MaintenanceUpdate = Database['public']['Tables']['maintenance_requests']['Update'];

export const maintenanceService = {
  async listByCondominium(condominiumId: string, options?: {
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
    unitId?: string;
  }): Promise<MaintenanceRow[]> {
    if (!supabase) return [];
    let query = supabase
      .from('maintenance_requests')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.priority) query = query.eq('priority', options.priority);
    if (options?.unitId) query = query.eq('unit_id', options.unitId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload: MaintenanceInsert): Promise<MaintenanceRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: MaintenanceUpdate): Promise<MaintenanceRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: MaintenanceStatus, completedAt?: string): Promise<MaintenanceRow> {
    return this.update(id, {
      status,
      completed_at: status === 'completed' ? completedAt || new Date().toISOString().split('T')[0] : null,
    });
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('maintenance_requests').delete().eq('id', id);
    if (error) throw error;
  },
};
