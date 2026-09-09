import { supabase } from './client';
import { Database } from '../../types/database';

export type CondominiumRow = Database['public']['Tables']['condominiums']['Row'];
export type CondominiumInsert = Database['public']['Tables']['condominiums']['Insert'];
export type CondominiumUpdate = Database['public']['Tables']['condominiums']['Update'];

export const condominiumService = {
  async getById(id: string): Promise<CondominiumRow | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('condominiums')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async listAll(): Promise<CondominiumRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('condominiums')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async create(payload: CondominiumInsert): Promise<CondominiumRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('condominiums')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: CondominiumUpdate): Promise<CondominiumRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('condominiums')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
