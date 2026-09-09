# RELATÓRIO TÉCNICO DE AUDITORIA E ENDURECIMENTO DE SEGURANÇA (ETAPA 4.1)

**Sistema de Gestão Condominial Multi-Tenant**  
**Data:** 01/09/2026  
**Status:** Concluído com Sucesso e Auditado  
**Ambiente:** Local (Nenhuma operação remota executada)  

---

## 1. OBJETIVO DA ETAPA 4.1

O objetivo desta etapa foi realizar a revisão e correção profunda de segurança das políticas de **Row Level Security (RLS)**, regras do **Supabase Storage**, funções `SECURITY DEFINER` e gatilhos de autenticação/perfil, garantindo:
1. **Isolamento Multi-Tenant Estrito:** Um usuário autenticado **jamais** poderá ler, criar, editar ou excluir dados ou arquivos pertencentes a outro condomínio.
2. **Mitigação de Elevação de Privilégios (Privilege Escalation):** Bloqueio de injeção de cargos administrativos durante o cadastro no Supabase Auth (`raw_user_meta_data`) e restrição estrita para que usuários comuns não possam alterar seu próprio `role`, `condominium_id` ou `is_active`.
3. **Proteção contra SQL Search Path Hijacking:** Todas as funções com privilégios elevados (`SECURITY DEFINER`) foram blindadas com `SET search_path = public, pg_temp`.
4. **Alinhamento Completo no Código-Fonte:** Sincronização entre `docs/supabase-initial-schema.sql`, migrations, types do TypeScript e serviços frontend.

---

## 2. VULNERABILIDADES IDENTIFICADAS E CORREÇÕES IMPLEMENTADAS

| # | Vulnerabilidade Identificada | Risco | Correção Técnica Aplicada |
|---|-----------------------------|-------|---------------------------|
| **1** | Políticas RLS baseadas apenas em `auth.uid() IS NOT NULL` | Vazamento de dados entre condomínios (Cross-tenant leak) | Todas as políticas RLS agora validam `condominium_id = public.get_auth_condominium_id()` ou vinculação direta via unidades (`get_user_unit_ids()`). |
| **2** | Auto-cadastro confiando em `raw_user_meta_data->>'role'` | Usuário malicioso poderia enviar `role: 'admin'` no signup e obter controle total | O gatilho `handle_new_auth_user()` agora força o cargo `'morador'` e `condominium_id = null` para qualquer novo usuário registrado. |
| **3** | Falta de proteção contra edição do próprio perfil | Usuário comum poderia enviar UPDATE em `profiles` alterando seu próprio `role` para `admin` | Criado trigger de proteção `protect_profile_changes()` e cláusula `WITH CHECK` na policy `profiles` que bloqueia alterações não autorizadas em `role`, `condominium_id` e `is_active`. |
| **4** | Storage policies sem validação de pasta do condomínio | Usuário autenticado de condomínio A poderia baixar arquivos de condomínio B | As políticas no bucket `storage.objects` agora exigem que o primeiro segmento do caminho do arquivo coincida com o condomínio do usuário (`split_part(name, '/', 1) = public.get_auth_condominium_id()::text`). |
| **5** | Funções `SECURITY DEFINER` sem `search_path` fixado | Risco de substituição de schema / execução de código arbitrário | Adicionado `SET search_path = public, pg_temp;` em todas as funções de segurança. |
| **6** | Presença da role não oficial `porteiro` no type TypeScript | Divergência com a especificação de 4 cargos oficiais | Tipo `UserRole` em `src/types/database.ts` atualizado para conter estritamente `'admin' \| 'sindico' \| 'conselho' \| 'morador'`. |

---

## 3. MATRIZ DE SEGURANÇA E POLÍTICAS RLS (14 TABELAS)

| Tabela | RLS Ativo | SELECT | INSERT | UPDATE | DELETE |
|--------|:---------:|--------|--------|--------|--------|
| **`roles`** | Sim | Autenticados | Bloqueado | Bloqueado | Bloqueado |
| **`permissions`** | Sim | Autenticados | Bloqueado | Bloqueado | Bloqueado |
| **`role_permissions`** | Sim | Autenticados | Bloqueado | Bloqueado | Bloqueado |
| **`condominiums`** | Sim | Membros do condomínio (`id = get_auth_condominium_id()`) | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`profiles`** | Sim | Próprio perfil ou membros do mesmo condomínio ativo | Controlado pelo trigger de auth | Usuário (apenas campos básicos) / Admin (membros do mesmo condomínio) | Admin do próprio condomínio (não pode excluir a si mesmo) |
| **`units`** | Sim | Membros do condomínio | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`unit_owners`** | Sim | Admins/Conselho do condomínio ou donos da própria unidade | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`unit_residents`** | Sim | Admins/Conselho do condomínio ou moradores da própria unidade | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`financial_entries`** | Sim | Admins/Conselho do condomínio ou Morador titular da respectiva `unit_id` | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`maintenance_requests`** | Sim | Admins/Conselho, autor do chamado (`requester_id`), moradores da unidade ou áreas comuns | Membros do condomínio (`requester_id = auth.uid()`) | Admin do condomínio ou autor enquanto `status = 'open'` | Admin do próprio condomínio |
| **`announcements`** | Sim | Admins/Conselho ou Moradores se `status = 'published'` | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`documents`** | Sim | Por visibilidade: `all` (todos), `council` (conselho/admin), `admin_only` (apenas admin) | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`assemblies`** | Sim | Membros do condomínio | Admin do próprio condomínio | Admin do próprio condomínio | Admin do próprio condomínio |
| **`activity_logs`** | Sim | Apenas Admin do próprio condomínio | Usuários registrando ações no seu condomínio | Bloqueado (Imutável) | Bloqueado (Imutável) |

---

## 4. MATRIZ DE SEGURANÇA DO SUPABASE STORAGE

Convenção de Caminhos no Storage:  
`{condominium_id}/{caminho_do_arquivo}` (Ex: `d3b07384-d113-4c92-8089-8d76d410d57e/documentos/convencao.pdf`)

| Bucket | Visibilidade | Limite de Tamanho | Tipos MIME Permitidos | SELECT (Download) | INSERT (Upload) | DELETE (Exclusão) |
|--------|:------------:|:-----------------:|:---------------------:|-------------------|-----------------|-------------------|
| **`condominium_documents`** | Privado (`public = false`) | 20 MB | PDF, DOC, DOCX, JPG, PNG | Membros do condomínio cujo ID coincide com o primeiro segmento | Administradores do condomínio | Administradores do condomínio |
| **`maintenance_attachments`** | Privado (`public = false`) | 10 MB | JPG, PNG, WEBP, PDF | Membros do condomínio cujo ID coincide com o primeiro segmento | Membros do condomínio | Administradores do condomínio |
| **`assembly_minutes`** | Privado (`public = false`) | 20 MB | PDF | Membros do condomínio cujo ID coincide com o primeiro segmento | Administradores do condomínio | Administradores do condomínio |

---

## 5. FUNÇÕES E TRIGGERS DE SEGURANÇA

### Funções Auxiliares:
1. **`public.handle_updated_at()`**: Atualização atômica de timestamps UTC.
2. **`public.get_auth_profile()`**: Retorna a tupla de perfil do usuário logado e ativo.
3. **`public.get_auth_condominium_id()`**: Retorna com segurança o `condominium_id` ativo do usuário autenticado.
4. **`public.is_admin()`**: Valida se o usuário autenticado possui role `admin` ou `sindico` no condomínio ativo.
5. **`public.is_council_or_admin()`**: Valida se o usuário autenticado possui role `admin`, `sindico` ou `conselho`.
6. **`public.get_user_unit_ids()`**: Retorna as unidades pertencentes ou habitadas pelo usuário no condomínio.

### Triggers de Proteção:
1. **`on_auth_user_created` (`handle_new_auth_user`)**: Executado após inserções em `auth.users`, cria o perfil padrão como `morador` e isolado sem condomínio vinculado.
2. **`trg_protect_profile_changes` (`protect_profile_changes`)**: Executado antes de updates em `profiles`, aborta transações que tentem modificar perfil/cargo ou condomínio sem permissão de administrador.

---

## 6. ARQUIVOS ATUALIZADOS NO PROJETO

- `docs/supabase-initial-schema.sql`: Script SQL definitivo auditado para execução manual.
- `docs/supabase-verification.sql`: Script de validação read-only pós-execução.
- `supabase/migrations/20260901000001_initial_schema.sql`: Cópia sincronizada na árvore de migrations.
- `src/services/supabase/schema.sql`: Cópia sincronizada no backend do serviço.
- `src/services/supabase/rawSchema.ts`: String constante sincronizada.
- `src/types/database.ts`: Tipagem TypeScript alinhada (4 roles oficiais).
- `docs/etapa-4-1-relatorio.md`: Este relatório técnico.

---

## 7. VALIDAÇÃO DE INTEGRIDADE E COMPILAÇÃO

Todos os arquivos TypeScript e componentes React foram validados:
- **`npm run build`**: Compilação estática concluída sem erros ou avisos de tipagem.
- **`tsc --noEmit`**: Nenhuma inconsistência de tipos entre a modelagem de dados e a interface.
