import { supabase } from './client';
import { Database, Json } from '../../types/database';

export type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row'];
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];

export const activityLogService = {
  async listByCondominium(condominiumId: string, limit = 50): Promise<ActivityLogRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async log(payload: {
    condominiumId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    description: string;
    metadata?: Json;
  }): Promise<ActivityLogRow | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          condominium_id: payload.condominiumId,
          user_id: payload.userId,
          action: payload.action,
          entity_type: payload.entityType,
          entity_id: payload.entityId,
          description: payload.description,
          metadata: payload.metadata || {},
        })
        .select()
        .single();
      if (error) {
        console.warn('Falha ao gravar log de auditoria no Supabase:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('Erro ao registrar atividade:', err);
      return null;
    }
  },
};
