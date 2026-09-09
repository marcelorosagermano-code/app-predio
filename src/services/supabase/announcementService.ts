import { supabase } from './client';
import { Database, AnnouncementCategory, AnnouncementStatus } from '../../types/database';

export type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];
export type AnnouncementInsert = Database['public']['Tables']['announcements']['Insert'];
export type AnnouncementUpdate = Database['public']['Tables']['announcements']['Update'];

export const announcementService = {
  async listByCondominium(condominiumId: string, options?: {
    status?: AnnouncementStatus;
    category?: AnnouncementCategory;
  }): Promise<AnnouncementRow[]> {
    if (!supabase) return [];
    let query = supabase
      .from('announcements')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.status) query = query.eq('status', options.status);
    if (options?.category) query = query.eq('category', options.category);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload: AnnouncementInsert): Promise<AnnouncementRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('announcements')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: AnnouncementUpdate): Promise<AnnouncementRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('announcements')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
  },
};
