import { supabase } from './client';
import { Database, AssemblyStatus, AssemblyType, AssemblyFormat } from '../../types/database';

export type AssemblyRow = Database['public']['Tables']['assemblies']['Row'];
export type AssemblyInsert = Database['public']['Tables']['assemblies']['Insert'];
export type AssemblyUpdate = Database['public']['Tables']['assemblies']['Update'];

export const assemblyService = {
  async listByCondominium(condominiumId: string, options?: {
    status?: AssemblyStatus;
    type?: AssemblyType;
  }): Promise<AssemblyRow[]> {
    if (!supabase) return [];
    let query = supabase
      .from('assemblies')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('date', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.type) query = query.eq('type', options.type);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload: AssemblyInsert): Promise<AssemblyRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('assemblies')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: AssemblyUpdate): Promise<AssemblyRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('assemblies')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('assemblies').delete().eq('id', id);
    if (error) throw error;
  },
};
