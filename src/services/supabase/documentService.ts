import { supabase } from './client';
import { Database, DocumentCategory, DocumentVisibility } from '../../types/database';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

export const documentService = {
  async listByCondominium(condominiumId: string, options?: {
    category?: DocumentCategory;
    visibility?: DocumentVisibility;
  }): Promise<DocumentRow[]> {
    if (!supabase) return [];
    let query = supabase
      .from('documents')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false });

    if (options?.category) query = query.eq('category', options.category);
    if (options?.visibility) query = query.eq('visibility', options.visibility);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload: DocumentInsert): Promise<DocumentRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('documents')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: DocumentUpdate): Promise<DocumentRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
  },
};
