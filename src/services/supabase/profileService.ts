import { supabase } from './client';
import { Database, UserRole } from '../../types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const profileService = {
  async getById(id: string): Promise<ProfileRow | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116' || error.code === '42501') return null;
      throw error;
    }
    return data;
  },

  async listByCondominium(condominiumId: string): Promise<ProfileRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('full_name');
    if (error) {
      if (error.code === '42501') return [];
      throw error;
    }
    return data || [];
  },

  async updateRole(id: string, role: UserRole): Promise<ProfileRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: ProfileUpdate): Promise<ProfileRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
