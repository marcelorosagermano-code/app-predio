import { supabase } from './client';
import { Database } from '../../types/database';

export type UnitRow = Database['public']['Tables']['units']['Row'];
export type UnitInsert = Database['public']['Tables']['units']['Insert'];
export type UnitUpdate = Database['public']['Tables']['units']['Update'];

export type UnitOwnerRow = Database['public']['Tables']['unit_owners']['Row'];
export type UnitResidentRow = Database['public']['Tables']['unit_residents']['Row'];

export interface UnitWithRelations extends UnitRow {
  owners?: UnitOwnerRow[];
  residents?: UnitResidentRow[];
}

export const unitService = {
  async listByCondominium(condominiumId: string): Promise<UnitWithRelations[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('units')
      .select(`
        *,
        owners:unit_owners(*),
        residents:unit_residents(*)
      `)
      .eq('condominium_id', condominiumId)
      .order('unit_number');
    if (error) throw error;
    return (data as any) || [];
  },

  async getById(id: string): Promise<UnitWithRelations | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('units')
      .select(`
        *,
        owners:unit_owners(*),
        residents:unit_residents(*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as any;
  },

  async create(payload: UnitInsert): Promise<UnitRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('units')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: UnitUpdate): Promise<UnitRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('units')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) throw error;
  },

  async addResident(payload: Database['public']['Tables']['unit_residents']['Insert']): Promise<UnitResidentRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('unit_residents')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addOwner(payload: Database['public']['Tables']['unit_owners']['Insert']): Promise<UnitOwnerRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('unit_owners')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
