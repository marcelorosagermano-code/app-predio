import { supabase } from './client';
import { Database, FinancialStatus, FinancialEntryType } from '../../types/database';

export type FinancialEntryRow = Database['public']['Tables']['financial_entries']['Row'];
export type FinancialEntryInsert = Database['public']['Tables']['financial_entries']['Insert'];
export type FinancialEntryUpdate = Database['public']['Tables']['financial_entries']['Update'];

export interface FinancialSummary {
  totalReceitasPagas: number;
  totalReceitasPendentes: number;
  totalDespesasPagas: number;
  totalDespesasPendentes: number;
  totalInadimplencia: number;
  saldoAtual: number;
}

export const financialService = {
  async listByCondominium(condominiumId: string, options?: {
    type?: FinancialEntryType;
    status?: FinancialStatus;
    unitId?: string;
  }): Promise<FinancialEntryRow[]> {
    if (!supabase) return [];
    let query = supabase
      .from('financial_entries')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('due_date', { ascending: false });

    if (options?.type) query = query.eq('type', options.type);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.unitId) query = query.eq('unit_id', options.unitId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getSummary(condominiumId: string): Promise<FinancialSummary> {
    const entries = await this.listByCondominium(condominiumId);
    
    let totalReceitasPagas = 0;
    let totalReceitasPendentes = 0;
    let totalDespesasPagas = 0;
    let totalDespesasPendentes = 0;
    let totalInadimplencia = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.type === 'income') {
        if (entry.status === 'paid') {
          totalReceitasPagas += amount;
        } else if (entry.status === 'pending') {
          totalReceitasPendentes += amount;
          if (entry.due_date < today) {
            totalInadimplencia += amount;
          }
        } else if (entry.status === 'overdue') {
          totalInadimplencia += amount;
          totalReceitasPendentes += amount;
        }
      } else if (entry.type === 'expense') {
        if (entry.status === 'paid') {
          totalDespesasPagas += amount;
        } else if (entry.status === 'pending' || entry.status === 'overdue') {
          totalDespesasPendentes += amount;
        }
      }
    }

    const saldoAtual = totalReceitasPagas - totalDespesasPagas;

    return {
      totalReceitasPagas,
      totalReceitasPendentes,
      totalDespesasPagas,
      totalDespesasPendentes,
      totalInadimplencia,
      saldoAtual,
    };
  },

  async create(payload: FinancialEntryInsert): Promise<FinancialEntryRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('financial_entries')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, payload: FinancialEntryUpdate): Promise<FinancialEntryRow> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase
      .from('financial_entries')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAsPaid(id: string, paymentDate?: string): Promise<FinancialEntryRow> {
    return this.update(id, {
      status: 'paid',
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
    });
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.from('financial_entries').delete().eq('id', id);
    if (error) throw error;
  },
};
