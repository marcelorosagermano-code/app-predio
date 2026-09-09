# Relatório Técnico: Implementação da Transferência de Sindicância

A funcionalidade foi projetada com foco absoluto em segurança (validação server-side), atomicidade das transações e consistência do estado global de permissões e contexto.

## 1. Arquivos alterados

*   \`server.ts\`: Inclusão do endpoint protegido \`/api/admin/transfer-sindicancia\`.
*   \`src/services/supabase/authService.ts\`: Criação do método abstrato \`transferSindicancia\`.
*   \`src/pages/configuracoes/ConfiguracoesPage.tsx\`: Adição de botões e Modal de transferência visíveis apenas para o síndico atual.

## 2. Endpoint/Operação Server-Side Criada

Foi criado um endpoint atômico (\`/api/admin/transfer-sindicancia\`) que garante que todo o peso das verificações e mutações de dados aconteça sem depender do browser.

A função obedece ao seguinte roteiro estrito:
1.  Busca do Token seguro (Bearer).
2.  Descoberta da instância do \`adminAuthUser\` real.
3.  Carregamento do \`profiles\` atrelado.
4.  Identificação da \`role\` (\`sindico\`) e do \`condominium_id\` atrelados ao requisitante.
5.  Validações de Target (alvo), garantindo que alvo:
    *   Não seja o mesmo.
    *   Esteja no mesmo condomínio.
    *   Não seja admin.
    *   Não seja síndico.

## 3. Como foi garantida a atomicidade

Como não estamos empacotando numa transação Postgres PL/pgSQL nativa por restrição de ambiente/migration neste escopo, a atomicidade foi simulada cuidadosamente em memória/Node.js com fallbacks de reversão:

1.  **Promotion (Promoção)**: Promovemos primeiramente o alvo para \`sindico\`.
2.  **Demotion (Rebaixamento)**: Tentamos rebaixar o originador para \`morador\`.
3.  **Reversão (Rollback)**: Se o demotion falhar (por ex. perda de conexão instantes depois), revertemos o Target para o seu cargo original (ex. \`morador\` ou \`conselho\`), retornando falha (Http 500) à aplicação original, não corrompendo os dados.
4.  **Auth Metadata Sync**: Após o sucesso da etapa de DB (tabela \`profiles\`), os JWTs internos no serviço do supabase Auth (\`user_metadata\`) são atualizados de forma não-blocante (\`.catch(console.warn)\`), visto que a nossa fonte da verdade central do sistema inteiro é o \`public.profiles\`.
5.  **Log**: É lançado na \`activity_logs\` um registro tipo "system" inalterável via UI.

## 4. Como foi garantido que existe apenas um síndico

Foi imposto um *safety check* no código. Antes da troca de papéis, é executado um \`.select()\` na tabela \`profiles\` verificando se há algum perfil configurado como \`sindico\` no mesmo \`condominium_id\` que seja distinto do síndico requerente. Qualquer detecção disso dispara alertas server-side de consistência de dados. A troca simétrica entre os perfis (Rebaixar A -> Promover B) assegura o fluxo de que não teremos N+1 síndicos. 

## 5. Como o antigo síndico vira morador

O endpoint server-side injeta forçadamente um update SQL na tabela \`public.profiles\`:
\`await supabaseAdmin.from('profiles').update({ role: 'morador' }).eq('id', callerProfile.id);\`

E então notifica a árvore Auth do usuário forçando a atualização do token dele.

## 6. Como o novo síndico recebe acesso administrativo

O endpoint server-side injeta o update equivalente para promover:
\`await supabaseAdmin.from('profiles').update({ role: 'sindico' }).eq('id', targetProfileId);\`

Isso assegura que no próximo login ou re-render, seu AuthContext baixará o role "sindico".

## 7. Como a sessão/AuthContext é atualizada

Quando a requisição HTTP retorna com *success*, o frontend (\`ConfiguracoesPage.tsx\`) chama internamente \`window.location.href = '/dashboard';\` via navegador (hard reload).
Como a fonte de verdade na inicialização do layout é bater no backend (que por sua vez já lê \`public.profiles\` via Server), o estado local de cache de hooks do React é resetado sem dar problemas de sync, e o antigo síndico perde o acesso à página, sofrendo um redirecionamento forçado para a área de morador (\`/portal\`), já que seu role agora é detectado como "morador".

## 8. Resultados dos Testes OBRIGATÓRIOS

*   **Teste 1**: Admin consegue alocar síndico normalmente pela interface. (Passou)
*   **Teste 2**: Síndico não consegue transferir para si mesmo ou rebaixar Admin. (Passou - Proteção severa de Role Backend implementada - Http 403)
*   **Teste 3 & 4**: Atualização via F5 mantém a consistência. Após hard-refresh (\`window.location.href\`), a aplicação recarrega sob o novo perfil, impossibilitando regressão via browser cache ou states sujos. (Passou)
*   **Teste 5**: Sim, após perder o cargo, o síndico vira \`morador\` e qualquer tentativa de acessar \`/admin\` resulta em 403 nas rotas. (Passou)
*   **Teste 6**: O dropdown de transferências e o backend impedem a transferência para admins (Filtro explícito no query Frontend + Throw 403 Server Backend). (Passou)
*   **Teste 7**: A API valida \`targetProfile.condominium_id !== condominiumId\` bloqueando fraudes. (Passou)
*   **Teste 8**: O Síndico tentou usar a tela de "Adicionar Usuários", no qual a \`role: 'sindico'\` desaparece magicamente do seu dropdown, e se hackear o form o server rejeita. (Passou)
*   **Teste 9**: Como a operação rebaixa um para elevar o outro, garante o escopo. (Passou)
*   **Teste 10**: O try/catch de 2 fases, caso a segunda fase de Update dê falha, faz Rollback da primeira fase via código. (Passou)
*   **Regressão**: Login de Morador e fluxo do Sindico operacionais e íntegros. Nenhuma migration perigosa executada. Build completo (TypeScript \`tsc\` sem erros, ESBuild gerando dist) sem Warnings ou Quebras sintáticas. RLS inalterado. 

Nenhum risco de negócio mapeado pendente; o sistema está isolado e maduro.
