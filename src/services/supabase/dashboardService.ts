import { supabase, isSupabaseConfigured } from './client';
import { MaintenancePriority, MaintenanceStatus, AnnouncementCategory } from '../../types/database';

export interface AdminDashboardData {
  summary: {
    saldoAtual: number;
    receitasMes: number;
    despesasMes: number;
    taxaInadimplencia: number;
    totalInadimplente: number;
    totalUnidades: number;
    unidadesInadimplentesCount: number;
    mesReferencia: string;
  };
  contasProximas: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    type: 'income' | 'expense';
    category: string;
    unitNumber?: string | null;
  }>;
  contasAtrasadas: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    type: 'income' | 'expense';
    category: string;
    unitNumber?: string | null;
  }>;
  maintenanceSummary: {
    abertas: number;
    emAndamento: number;
    concluidas: number;
    urgentes: number;
  };
  recentMaintenance: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
    openedAt: string;
    requesterName?: string | null;
    unitNumber?: string | null;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    isPinned: boolean;
    publishedAt: string | null;
    createdAt: string;
    authorName?: string | null;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    entityType: string;
    description: string;
    createdAt: string;
    userName?: string | null;
    userRole?: string | null;
  }>;
}

export interface MoradorDashboardData {
  unit: {
    id: string;
    unitNumber: string;
    block: string | null;
    floor: number | null;
    sqm: number | null;
    status: string;
    ownerName?: string | null;
    situacaoFinanceira: 'EM_DIA' | 'PENDENTE' | 'INADIMPLENTE';
  } | null;
  pendingFee: {
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    status: string;
    barcode?: string | null;
  } | null;
  recentPayments: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    paymentDate: string | null;
    status: string;
  }>;
  myMaintenanceRequests: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
    openedAt: string;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    isPinned: boolean;
    publishedAt: string | null;
    createdAt: string;
    authorName?: string | null;
  }>;
  publicDocuments: Array<{
    id: string;
    title: string;
    category: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
  }>;
  upcomingAssemblies: Array<{
    id: string;
    title: string;
    type: string;
    format: string;
    date: string;
    location: string;
    status: string;
  }>;
}

export const dashboardService = {
  /**
   * Consulta indicadores reais para Síndico, Administrador e Conselho Fiscal
   */
  async getAdminDashboardData(condominiumId: string): Promise<AdminDashboardData> {
    if (!supabase || !isSupabaseConfigured) {
      return this.getEmptyAdminData();
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const next7DaysDate = new Date();
      next7DaysDate.setDate(next7DaysDate.getDate() + 7);
      const next7Days = next7DaysDate.toISOString().split('T')[0];

      const currentYearMonth = today.slice(0, 7);
      const mesReferencia = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());

      // Executar consultas simultâneas no Supabase isoladas pelo condomínio
      const [
        entriesResult,
        maintenanceResult,
        announcementsResult,
        activityLogsResult,
        condoResult,
        unitsResult,
      ] = await Promise.all([
        supabase
          .from('financial_entries')
          .select(`
            id,
            unit_id,
            type,
            category,
            description,
            amount,
            due_date,
            payment_date,
            status,
            unit:units(unit_number, block)
          `)
          .eq('condominium_id', condominiumId)
          .order('due_date', { ascending: true }),

        supabase
          .from('maintenance_requests')
          .select(`
            id,
            title,
            description,
            location,
            priority,
            status,
            opened_at,
            created_at,
            unit:units(unit_number, block),
            requester:profiles(full_name)
          `)
          .eq('condominium_id', condominiumId)
          .order('created_at', { ascending: false }),

        supabase
          .from('announcements')
          .select(`
            id,
            title,
            content,
            category,
            status,
            is_pinned,
            published_at,
            created_at,
            author:profiles(full_name)
          `)
          .eq('condominium_id', condominiumId)
          .eq('status', 'published')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('activity_logs')
          .select(`
            id,
            action,
            entity_type,
            description,
            created_at,
            user:profiles(full_name, role)
          `)
          .eq('condominium_id', condominiumId)
          .order('created_at', { ascending: false })
          .limit(6),

        supabase
          .from('condominiums')
          .select('total_units')
          .eq('id', condominiumId)
          .maybeSingle(),

        supabase
          .from('units')
          .select('id, unit_number')
          .eq('condominium_id', condominiumId),
      ]);

      const entries = entriesResult.data || [];
      const maintenanceList = maintenanceResult.data || [];
      const announcementsList = announcementsResult.data || [];
      const logsList = activityLogsResult.data || [];
      const totalUnits = condoResult.data?.total_units || unitsResult.data?.length || 0;

      // 1. Cálculos Financeiros
      let totalReceitasPagas = 0;
      let totalDespesasPagas = 0;
      let receitasMes = 0;
      let despesasMes = 0;
      let totalInadimplente = 0;
      const inadimplentesUnitsSet = new Set<string>();

      const contasProximas: AdminDashboardData['contasProximas'] = [];
      const contasAtrasadas: AdminDashboardData['contasAtrasadas'] = [];

      for (const entry of entries) {
        const amount = Number(entry.amount) || 0;
        const dueDate = entry.due_date;
        const paymentDate = entry.payment_date;
        const isPaid = entry.status === 'paid';
        const isOverdue = entry.status === 'overdue' || (entry.status === 'pending' && dueDate < today);
        const isPendingFuture = entry.status === 'pending' && dueDate >= today;

        // Saldo Acumulado em Caixa
        if (entry.type === 'income' && isPaid) {
          totalReceitasPagas += amount;
        } else if (entry.type === 'expense' && isPaid) {
          totalDespesasPagas += amount;
        }

        // Movimentação do Mês Vigente
        const isCurrentMonth = (paymentDate && paymentDate.startsWith(currentYearMonth)) ||
                               (!paymentDate && dueDate.startsWith(currentYearMonth));

        if (isCurrentMonth) {
          if (entry.type === 'income' && isPaid) {
            receitasMes += amount;
          } else if (entry.type === 'expense' && isPaid) {
            despesasMes += amount;
          }
        }

        // Inadimplência
        if (entry.type === 'income' && isOverdue) {
          totalInadimplente += amount;
          if (entry.unit_id) {
            inadimplentesUnitsSet.add(entry.unit_id);
          }
        }

        const unitData = Array.isArray(entry.unit) ? entry.unit[0] : entry.unit;
        const unitNumberFormatted = unitData?.unit_number
          ? `Unidade ${unitData.unit_number}${unitData.block ? ` - ${unitData.block}` : ''}`
          : null;

        // Contas Próximas (Vencimento nos próximos 7 dias)
        if (isPendingFuture && dueDate <= next7Days) {
          contasProximas.push({
            id: entry.id,
            description: entry.description,
            amount,
            dueDate,
            type: entry.type as 'income' | 'expense',
            category: entry.category,
            unitNumber: unitNumberFormatted,
          });
        }

        // Contas Atrasadas
        if (isOverdue) {
          contasAtrasadas.push({
            id: entry.id,
            description: entry.description,
            amount,
            dueDate,
            type: entry.type as 'income' | 'expense',
            category: entry.category,
            unitNumber: unitNumberFormatted,
          });
        }
      }

      const saldoAtual = totalReceitasPagas - totalDespesasPagas;
      const unidadesInadimplentesCount = inadimplentesUnitsSet.size;
      const taxaInadimplencia = totalUnits > 0
        ? Number(((unidadesInadimplentesCount / totalUnits) * 100).toFixed(1))
        : 0;

      // 2. Indicadores de Manutenção
      let abertas = 0;
      let emAndamento = 0;
      let concluidas = 0;
      let urgentes = 0;

      for (const m of maintenanceList) {
        if (m.status === 'open') abertas++;
        else if (m.status === 'in_progress') emAndamento++;
        else if (m.status === 'completed') concluidas++;

        if (m.priority === 'urgent' && (m.status === 'open' || m.status === 'in_progress')) {
          urgentes++;
        }
      }

      const recentMaintenance: AdminDashboardData['recentMaintenance'] = maintenanceList
        .slice(0, 4)
        .map((m) => {
          const u = Array.isArray(m.unit) ? m.unit[0] : m.unit;
          const req = Array.isArray(m.requester) ? m.requester[0] : m.requester;
          return {
            id: m.id,
            title: m.title,
            description: m.description,
            location: m.location,
            priority: m.priority as MaintenancePriority,
            status: m.status as MaintenanceStatus,
            openedAt: m.opened_at,
            requesterName: req?.full_name || null,
            unitNumber: u?.unit_number ? `Unidade ${u.unit_number}` : null,
          };
        });

      // 3. Comunicados Recentes
      const recentAnnouncements: AdminDashboardData['recentAnnouncements'] = announcementsList.map((a) => {
        const aut = Array.isArray(a.author) ? a.author[0] : a.author;
        return {
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category as AnnouncementCategory,
          isPinned: a.is_pinned,
          publishedAt: a.published_at,
          createdAt: a.created_at,
          authorName: aut?.full_name || 'Administração',
        };
      });

      // 4. Atividades Recentes
      const recentActivities: AdminDashboardData['recentActivities'] = logsList.map((l) => {
        const u = Array.isArray(l.user) ? l.user[0] : l.user;
        return {
          id: l.id,
          action: l.action,
          entityType: l.entity_type,
          description: l.description,
          createdAt: l.created_at,
          userName: u?.full_name || 'Sistema',
          userRole: u?.role || null,
        };
      });

      return {
        summary: {
          saldoAtual,
          receitasMes,
          despesasMes,
          taxaInadimplencia,
          totalInadimplente,
          totalUnidades: totalUnits,
          unidadesInadimplentesCount,
          mesReferencia: mesReferencia.charAt(0).toUpperCase() + mesReferencia.slice(1),
        },
        contasProximas,
        contasAtrasadas,
        maintenanceSummary: {
          abertas,
          emAndamento,
          concluidas,
          urgentes,
        },
        recentMaintenance,
        recentAnnouncements,
        recentActivities,
      };
    } catch (error) {
      console.error('Erro ao buscar dados reais do dashboard administrativo:', error);
      throw error;
    }
  },

  /**
   * Consulta dados reais para o Morador estritamente delimitados à sua unidade e escopo permitido
   */
  async getMoradorDashboardData(
    condominiumId: string,
    userId: string,
    unitId?: string | null
  ): Promise<MoradorDashboardData> {
    if (!supabase || !isSupabaseConfigured) {
      return this.getEmptyMoradorData();
    }

    try {
      let resolvedUnitId = unitId;

      // Se a unidade não estiver no profile, tentar descobrir via unit_residents ou unit_owners
      if (!resolvedUnitId) {
        const { data: residentRecord } = await supabase
          .from('unit_residents')
          .select('unit_id')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();

        if (residentRecord?.unit_id) {
          resolvedUnitId = residentRecord.unit_id;
        } else {
          const { data: ownerRecord } = await supabase
            .from('unit_owners')
            .select('unit_id')
            .eq('profile_id', userId)
            .limit(1)
            .maybeSingle();

          if (ownerRecord?.unit_id) {
            resolvedUnitId = ownerRecord.unit_id;
          }
        }
      }

      // 1. Dados da Unidade
      let unitData: MoradorDashboardData['unit'] = null;
      if (resolvedUnitId) {
        const { data: unitRow } = await supabase
          .from('units')
          .select(`
            id,
            unit_number,
            block,
            floor,
            sqm,
            status,
            owners:unit_owners(name, is_primary)
          `)
          .eq('id', resolvedUnitId)
          .maybeSingle();

        if (unitRow) {
          const owners = (unitRow.owners as any[]) || [];
          const primaryOwner = owners.find((o) => o.is_primary) || owners[0];

          unitData = {
            id: unitRow.id,
            unitNumber: unitRow.unit_number,
            block: unitRow.block,
            floor: unitRow.floor,
            sqm: unitRow.sqm ? Number(unitRow.sqm) : null,
            status: unitRow.status,
            ownerName: primaryOwner?.name || null,
            situacaoFinanceira: 'EM_DIA',
          };
        }
      }

      // 2. Lançamentos Financeiros da Unidade
      let pendingFee: MoradorDashboardData['pendingFee'] = null;
      let recentPayments: MoradorDashboardData['recentPayments'] = [];

      if (resolvedUnitId) {
        const { data: fees } = await supabase
          .from('financial_entries')
          .select(`
            id,
            description,
            amount,
            due_date,
            payment_date,
            status,
            barcode
          `)
          .eq('condominium_id', condominiumId)
          .eq('unit_id', resolvedUnitId)
          .order('due_date', { ascending: false });

        const entries = fees || [];
        const today = new Date().toISOString().split('T')[0];

        // Determinar pendência principal (em atraso ou a vencer)
        const pending = entries.find((e) => e.status === 'pending' || e.status === 'overdue');
        if (pending) {
          const isOverdue = pending.status === 'overdue' || (pending.status === 'pending' && pending.due_date < today);
          pendingFee = {
            id: pending.id,
            description: pending.description,
            amount: Number(pending.amount),
            dueDate: pending.due_date,
            status: isOverdue ? 'overdue' : 'pending',
            barcode: pending.barcode,
          };

          if (unitData) {
            unitData.situacaoFinanceira = isOverdue ? 'INADIMPLENTE' : 'PENDENTE';
          }
        }

        // Histórico de pagamentos
        recentPayments = entries
          .filter((e) => e.status === 'paid')
          .slice(0, 4)
          .map((e) => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            dueDate: e.due_date,
            paymentDate: e.payment_date,
            status: e.status,
          }));
      }

      // 3. Chamados de Manutenção do Morador
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select(`
          id,
          title,
          description,
          location,
          priority,
          status,
          opened_at
        `)
        .eq('condominium_id', condominiumId)
        .or(resolvedUnitId ? `requester_id.eq.${userId},unit_id.eq.${resolvedUnitId}` : `requester_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(4);

      const myMaintenanceRequests: MoradorDashboardData['myMaintenanceRequests'] = (maintenance || []).map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        location: m.location,
        priority: m.priority as MaintenancePriority,
        status: m.status as MaintenanceStatus,
        openedAt: m.opened_at,
      }));

      // 4. Comunicados Publicados do Condomínio
      const { data: announcements } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          category,
          is_pinned,
          published_at,
          created_at,
          author:profiles(full_name)
        `)
        .eq('condominium_id', condominiumId)
        .eq('status', 'published')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);

      const recentAnnouncements: MoradorDashboardData['recentAnnouncements'] = (announcements || []).map((a) => {
        const aut = Array.isArray(a.author) ? a.author[0] : a.author;
        return {
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category as AnnouncementCategory,
          isPinned: a.is_pinned,
          publishedAt: a.published_at,
          createdAt: a.created_at,
          authorName: aut?.full_name || 'Administração',
        };
      });

      // 5. Documentos Públicos
      const { data: documents } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          category,
          file_name,
          file_type,
          file_size,
          created_at
        `)
        .eq('condominium_id', condominiumId)
        .eq('visibility', 'all')
        .order('created_at', { ascending: false })
        .limit(4);

      const publicDocuments: MoradorDashboardData['publicDocuments'] = (documents || []).map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        fileName: d.file_name,
        fileType: d.file_type,
        fileSize: Number(d.file_size),
        createdAt: d.created_at,
      }));

      // 6. Assembleias Agendadas / Recentes
      const { data: assemblies } = await supabase
        .from('assemblies')
        .select(`
          id,
          title,
          type,
          format,
          date,
          location,
          status
        `)
        .eq('condominium_id', condominiumId)
        .order('date', { ascending: false })
        .limit(3);

      const upcomingAssemblies: MoradorDashboardData['upcomingAssemblies'] = (assemblies || []).map((ass) => ({
        id: ass.id,
        title: ass.title,
        type: ass.type,
        format: ass.format,
        date: ass.date,
        location: ass.location,
        status: ass.status,
      }));

      return {
        unit: unitData,
        pendingFee,
        recentPayments,
        myMaintenanceRequests,
        recentAnnouncements,
        publicDocuments,
        upcomingAssemblies,
      };
    } catch (error) {
      console.error('Erro ao buscar dados reais do dashboard do morador:', error);
      throw error;
    }
  },

  getEmptyAdminData(): AdminDashboardData {
    const mesReferencia = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    return {
      summary: {
        saldoAtual: 0,
        receitasMes: 0,
        despesasMes: 0,
        taxaInadimplencia: 0,
        totalInadimplente: 0,
        totalUnidades: 0,
        unidadesInadimplentesCount: 0,
        mesReferencia: mesReferencia.charAt(0).toUpperCase() + mesReferencia.slice(1),
      },
      contasProximas: [],
      contasAtrasadas: [],
      maintenanceSummary: {
        abertas: 0,
        emAndamento: 0,
        concluidas: 0,
        urgentes: 0,
      },
      recentMaintenance: [],
      recentAnnouncements: [],
      recentActivities: [],
    };
  },

  getEmptyMoradorData(): MoradorDashboardData {
    return {
      unit: null,
      pendingFee: null,
      recentPayments: [],
      myMaintenanceRequests: [],
      recentAnnouncements: [],
      publicDocuments: [],
      upcomingAssemblies: [],
    };
  },
};
