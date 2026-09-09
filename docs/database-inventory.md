# Inventário Oficial do Banco de Dados PostgreSQL (Supabase)

**Sistema:** Gestão Condominial Multi-Tenant  
**Total Exato de Tabelas:** 14  
**Data:** 2026-09-01  

---

| # | Tabela | Finalidade | PK | Principais FKs | RLS Ativo |
|---|---|---|---|---|---|
| 1 | `condominiums` | Dados cadastrais e institucionais do condomínio (Tenant principal) | `id` (UUID) | — | ✅ Sim |
| 2 | `roles` | Catálogo dos perfis de acesso do sistema (`admin`, `sindico`, `conselho`, `morador`) | `id` (TEXT) | — | ✅ Sim |
| 3 | `permissions` | Catálogo de permissões granulares dos módulos funcionais | `id` (TEXT) | — | ✅ Sim |
| 4 | `role_permissions` | Relação N:N associando perfis às suas permissões | `(role_id, permission_id)` (Composta) | `role_id` ➔ `roles(id)`<br>`permission_id` ➔ `permissions(id)` | ✅ Sim |
| 5 | `profiles` | Perfil estendido de usuários, vinculado diretamente ao Supabase Auth | `id` (UUID) | `id` ➔ `auth.users(id)`<br>`condominium_id` ➔ `condominiums(id)`<br>`role` ➔ `roles(id)` | ✅ Sim |
| 6 | `units` | Cadastro de unidades autônomas (apartamentos, blocos, frações ideais) | `id` (UUID) | `condominium_id` ➔ `condominiums(id)` | ✅ Sim |
| 7 | `unit_owners` | Registro de proprietários e titulares das unidades | `id` (UUID) | `unit_id` ➔ `units(id)`<br>`profile_id` ➔ `profiles(id)` | ✅ Sim |
| 8 | `unit_residents` | Registro de moradores, inquilinos e dependentes da unidade | `id` (UUID) | `unit_id` ➔ `units(id)`<br>`profile_id` ➔ `profiles(id)` | ✅ Sim |
| 9 | `financial_entries` | Lançamentos financeiros de receitas (taxas/boletos) e despesas | `id` (UUID) | `condominium_id` ➔ `condominiums(id)`<br>`unit_id` ➔ `units(id)` | ✅ Sim |
| 10 | `maintenance_requests` | Chamados de manutenção, solicitações de reparo e ordens de serviço | `id` (UUID) | `condominium_id` ➔ `condominiums(id)`<br>`unit_id` ➔ `units(id)`<br>`requester_id` ➔ `profiles(id)` | ✅ Sim |
| 11 | `announcements` | Mural de avisos, comunicados informativos e notícias urgentes | `id` (UUID) | `condominium_id` ➔ `condominiums(id)`<br>`author_id` ➔ `profiles(id)` | ✅ Sim |
| 12 | `documents` | Metadados de arquivos oficiais (atas, regimentos, contratos, balancetes) | `id` (UUID) | `condominium_id` ➔ `condominiums(id)`<br>`uploaded_by` ➔ `profiles(id)` | ✅ Sim |
| 13 | `assemblies` | Controle de assembleias gerais (ordinárias/extraordinárias), pautas e atas | `id` (UUID) | `condominium_id` ➔ `condominiums(id)` | ✅ Sim |
| 14 | `activity_logs` | Trilha de auditoria e registro de atividades de usuários para conformidade | `id` (UUID) | `condominium_id` ➔ `condominiums(id)`<br>`user_id` ➔ `profiles(id)` | ✅ Sim |
