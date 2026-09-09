import { supabase } from './client';
import {
  mockCondominio,
  mockUnidades,
  mockLancamentosFinanceiros,
  mockManutencoes,
  mockComunicados,
  mockDocumentos,
  mockAssembleias,
} from '../mockData';

export interface TableCheckResult {
  table: string;
  status: 'ok' | 'empty' | 'missing' | 'error';
  count?: number;
  message?: string;
}

export interface SupabaseDiagnosticReport {
  isConfigured: boolean;
  url: string;
  hasKey: boolean;
  canConnect: boolean;
  latencyMs?: number;
  error?: string;
  tables: TableCheckResult[];
  schemaReady: boolean;
}

export const TABLES_TO_CHECK = [
  'condominiums',
  'roles',
  'permissions',
  'profiles',
  'units',
  'unit_owners',
  'unit_residents',
  'financial_entries',
  'maintenance_requests',
  'announcements',
  'documents',
  'assemblies',
  'activity_logs',
];

export async function runSupabaseDiagnostics(): Promise<SupabaseDiagnosticReport> {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key || !supabase) {
    return {
      isConfigured: false,
      url: url ? `${url.substring(0, 15)}...` : 'Não definida',
      hasKey: Boolean(key),
      canConnect: false,
      error: 'Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no ambiente.',
      tables: [],
      schemaReady: false,
    };
  }

  const startTime = performance.now();
  const results: TableCheckResult[] = [];
  let canConnect = false;

  const isTableMissingError = (error: any) => {
    if (!error) return false;
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    return (
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('relation') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache')
    );
  };

  try {
    // 1. Test basic connectivity by querying condominiums table
    const { data: condData, error: condError } = await (supabase as any)
      .from('condominiums')
      .select('id', { count: 'exact' })
      .limit(1);

    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    if (condError) {
      if (isTableMissingError(condError)) {
        canConnect = true; // Connection is active, table missing
        results.push({
          table: 'condominiums',
          status: 'missing',
          message: 'Tabela ainda não criada no banco.',
        });
      } else {
        return {
          isConfigured: true,
          url: url.replace(/(https?:\/\/)(.*)/, '$1***.supabase.co'),
          hasKey: true,
          canConnect: false,
          latencyMs: latency,
          error: `Erro na autenticação com o Supabase: ${condError.message}`,
          tables: [],
          schemaReady: false,
        };
      }
    } else {
      canConnect = true;
      results.push({
        table: 'condominiums',
        status: condData && condData.length > 0 ? 'ok' : 'empty',
        count: condData?.length || 0,
        message: condData && condData.length > 0 ? `${condData.length} registro(s)` : 'Tabela criada (vazia)',
      });
    }

    // 2. Check remaining tables
    for (const table of TABLES_TO_CHECK.slice(1)) {
      try {
        const { data, error } = await (supabase as any)
          .from(table)
          .select('*', { count: 'exact' })
          .limit(1);

        if (error) {
          if (isTableMissingError(error)) {
            results.push({
              table,
              status: 'missing',
              message: 'Tabela não criada no banco.',
            });
          } else {
            // Might be RLS protected, but relation exists!
            if (error.code === '42501' || error.message?.includes('violates row-level security')) {
              results.push({
                table,
                status: 'ok',
                message: 'Tabela criada & RLS ativo',
              });
            } else {
              results.push({
                table,
                status: 'error',
                message: error.message,
              });
            }
          }
        } else {
          results.push({
            table,
            status: data && data.length > 0 ? 'ok' : 'empty',
            count: data?.length || 0,
            message: data && data.length > 0 ? `${data.length} registro(s)` : 'Tabela criada (vazia)',
          });
        }
      } catch (err: any) {
        results.push({
          table,
          status: 'error',
          message: err.message || 'Erro ao consultar',
        });
      }
    }

    const missingCount = results.filter((r) => r.status === 'missing').length;
    const schemaReady = missingCount === 0 && results.length > 0;

    return {
      isConfigured: true,
      url: url.replace(/(https?:\/\/)(.*)/, '$1***.supabase.co'),
      hasKey: true,
      canConnect: true,
      latencyMs: latency,
      tables: results,
      schemaReady,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      url: url ? `${url.substring(0, 15)}...` : 'Configurada',
      hasKey: true,
      canConnect: false,
      error: `Falha de rede: ${err.message}`,
      tables: [],
      schemaReady: false,
    };
  }
}

/**
 * Utilitário para semear dados de teste iniciais no banco real
 */
export async function seedInitialDataToSupabase(): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Supabase não inicializado.' };
  }

  try {
    // 1. Inserir Condomínio
    const { data: condData, error: condError } = await (supabase as any)
      .from('condominiums')
      .upsert({
        id: mockCondominio.id,
        name: mockCondominio.nome,
        document: mockCondominio.cnpj || '12.345.678/0001-90',
        address: mockCondominio.endereco,
        city: mockCondominio.cidade,
        state: mockCondominio.estado,
        zip_code: mockCondominio.cep || '01415-000',
        phone: mockCondominio.telefoneContato,
        email: mockCondominio.emailContato,
        total_units: mockCondominio.totalUnidades,
      })
      .select()
      .single();

    if (condError) {
      return { success: false, message: `Erro ao inserir condomínio: ${condError.message}` };
    }

    // 2. Inserir Unidades
    const unitsPayload = mockUnidades.map((u) => ({
      id: u.id,
      condominium_id: mockCondominio.id,
      unit_number: u.numero,
      block: u.bloco || 'Bloco A',
      floor: u.andar || 1,
      sqm: u.metragem || 75.5,
      ideal_fraction: u.fracaoIdeal || 0.025,
      status: u.situacao === 'DESOCUPADA' ? 'vacant' : u.situacao === 'EM_REFORMA' ? 'under_renovation' : 'occupied',
    }));

    const { error: unitsError } = await (supabase as any).from('units').upsert(unitsPayload);
    if (unitsError) {
      return { success: false, message: `Erro ao inserir unidades: ${unitsError.message}` };
    }

    // 3. Inserir Proprietários e Moradores
    for (const u of mockUnidades) {
      await (supabase as any).from('unit_owners').upsert({
        unit_id: u.id,
        name: u.proprietarioNome,
        email: u.proprietarioEmail,
        phone: u.proprietarioTelefone,
        is_primary: true,
      });

      if (u.moradorNome) {
        await (supabase as any).from('unit_residents').upsert({
          unit_id: u.id,
          name: u.moradorNome,
          email: u.moradorEmail,
          phone: u.moradorTelefone,
          relationship_type: u.situacao === 'OCUPADA_INQUILINO' ? 'tenant' : 'owner',
          is_primary: true,
        });
      }
    }

    return { success: true, message: 'Dados de condomínio, unidades e moradores sincronizados com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Falha na sincronização: ${err.message}` };
  }
}
