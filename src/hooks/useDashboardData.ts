import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  dashboardService,
  AdminDashboardData,
  MoradorDashboardData,
} from '../services/supabase/dashboardService';

export function useAdminDashboard() {
  const { user, condominium, isAdmin, isCouncil } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const condoId = condominium?.id || user?.condominiumId;

  const fetchData = useCallback(async () => {
    if (!condoId) {
      setData(dashboardService.getEmptyAdminData());
      setIsLoading(false);
      return;
    }

    if (!isAdmin && !isCouncil) {
      setError('Acesso não autorizado para indicadores administrativos.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await dashboardService.getAdminDashboardData(condoId);
      setData(result);
    } catch (err: any) {
      console.error('Erro ao carregar dados do dashboard admin:', err);
      setError(err?.message || 'Falha ao sincronizar dados do painel.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId, isAdmin, isCouncil]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}

export function useMoradorDashboard() {
  const { user, condominium } = useAuth();
  const [data, setData] = useState<MoradorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const condoId = condominium?.id || user?.condominiumId;
  const userId = user?.id;
  const unitId = user?.unitId;

  const fetchData = useCallback(async () => {
    if (!condoId || !userId) {
      setData(dashboardService.getEmptyMoradorData());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await dashboardService.getMoradorDashboardData(condoId, userId, unitId);
      setData(result);
    } catch (err: any) {
      console.error('Erro ao carregar dados do painel do morador:', err);
      setError(err?.message || 'Falha ao sincronizar dados da sua unidade.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId, userId, unitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}
