# Relatório de Auditoria e Correção Definitiva da Sessão de Autenticação

## Diagnóstico Detalhado

**1. CAUSA RAIZ EXATA**
A sessão estava sendo perdida após períodos de inatividade porque a aplicação implementava mecanismos redundantes de "proteção" (um `setInterval` e um event listener de `visibilitychange`) que tentavam validar a sessão no exato mesmo momento em que o auto-refresh nativo do Supabase Auth (`autoRefreshToken: true`) tentava atuar em background. Devido à regra de Refresh Token Rotation (onde um token de renovação só pode ser usado uma vez), quando a aplicação disparava duas requisições de refresh quase simultâneas, a API de segurança do Supabase detectava uma anomalia (Invalid Refresh Token), considerando a sessão inválida e emitindo o evento `SIGNED_OUT`, o que forçava um redirecionamento para o login.

**2. Arquivo responsável**
- `src/contexts/AuthContext.tsx`
- `src/services/supabase/authService.ts`

**3. Função responsável**
- Em `AuthContext.tsx`: O `useEffect` de inicialização (linha ~231 original) que criava um listener `visibilitychange` e um `setInterval`.
- Em `authService.ts`: O método `getValidSession()`.

**4. Código/comportamento que causava o problema**
O código instanciou um `setInterval` de 4 minutos e um evento atrelado a `document.addEventListener('visibilitychange', onVisibilityChange)` para chamar `authService.getValidSession()`. O método `getValidSession()`, por sua vez, forçava agressivamente uma invocação a `supabase.auth.refreshSession()`. A dupla tentativa gerava um ciclo de corrida destruindo os tokens.

**5. Configuração atual do Supabase Auth**
O cliente configurado em `client.ts` está operando adequadamente alinhado à documentação oficial.

**6. persistSession**
Ativo (`persistSession: true`). Mantém o estado no storage do navegador para resgate após fechar a aba.

**7. autoRefreshToken**
Ativo (`autoRefreshToken: true`). Trata renovações em background com cronômetros baseados na métrica de `expires_at`.

**8. storage**
A SDK utiliza o armazenamento natural padrão do Browser (localStorage internalizado), sem conflitos ou modificações arriscadas.

**9. Número de instâncias do Supabase Client**
Duas identificadas, mas com comportamentos perfeitamente isolados:
- O cliente global em `client.ts` usado por toda a interface;
- Um cliente efêmero e *secundário* (`isolatedSupabase`) em `authService.ts` configurado sem persistência (`persistSession: false`) usado apenas para administradores criarem credenciais de moradores sem deslogar o admin vigente. Isso não afeta a sessão principal.

**10. Comportamento do AuthContext**
Agora atua puramente reativo: aguarda que a SDK oficial notifique alterações. O evento inicial setava `status` baseado na resposta crua da biblioteca, em vez de bombardear requests duplicadas.

**11. Comportamento do onAuthStateChange**
Configurado corretamente. Quando escuta os eventos do auth client, apenas despacha sincronização para o frontend.

**12. Comportamento do TOKEN_REFRESHED**
Sempre que renovado, o hook propaga as informações frescas sem exigir regarregamento de página ou causar estado nulo temporário na sessão. Foi auditado que, em momento algum, este evento está alterando o perfil ou forçando redirecionamento desnecessário.

**13. Comportamento do SIGNED_OUT**
O disparo natural limpa perfeitamente `user`, `profile`, reseta permissões e joga para `UNAUTHENTICATED`. Ocorrerá **apenas** quando se clica em Sair, ou se, de fato, a sessão estiver inválida no servidor.

**14. Existência de timeout de inatividade**
Foram encontradas apenas funções de UX temporária (como esconder alertas após X segundos: `setCopiedBarcode(false)`) ou a flag do `setInterval` de 4 min. O setInterval que forçava a verificação foi completamente **removido**. A aplicação já não sofre com ociosidade.

**15. Existência de logout automático**
Não há gatilhos programáticos do tipo `onIdleLogout` em nenhum hook ou contexto. O logout é inteiramente determinado pela recusa de renovação ou logout manual.

**16. Existência de 401 → logout**
Na auditoria de API via interceptor (`authService.ts` -> `fetchWithAuth`), foi avaliado que se houver 401 ele **não executa** `logout()`. Ele tenta apenas injetar o novo token recuperado na requisição re-tentada (`headers.set('Authorization', Bearer ...)`). Foi feito um refinamento nesta etapa para chamar o estado interno do Supabase e não um `refreshSession` abrupto.

**17. Comportamento do refresh token**
Renovação segue sendo autônoma, validando o tempo do access token contra o relógio e mantendo-se sempre logado. O cliente jamais manipulará ou armazenará a raw string manualmente.

**18. Comportamento do F5**
O acesso persiste. A flag `persistSession` assegura a rápida restauração, mantendo perfil e rota em sincronia, pois o AuthContext aguarda o `INITIAL_SESSION` antes de desenhar a UI de proteção de módulo.

**19. Comportamento ao retornar para aba inativa**
Voltar à aba inativa não causará revalidação manual dupla. O Supabase Auth acionará em background se `expires_at` demandar.

**20. Comportamento da troca de senha**
A `completeFirstAccess` utiliza `updateUser({ password })`. Esta diretiva atualiza a senha ativando na mesma instrução novos tokens. O cliente do Supabase gerencia essa transição via `USER_UPDATED`, sem interromper a sessão.

## Correção Aplicada (Refatoração de Ciclo de Vida)

- **Remoção de Intervalos:** Foram apagadas as definições de escuta a `visibilitychange` e os timeouts `setInterval` agressivos no arquivo `src/contexts/AuthContext.tsx`.
- **Simplificação do Método `getValidSession`:** Retirado o método invasivo `supabase.auth.refreshSession()` de verificações cotidianas. Ao invés disso, o método recupera atomicamente o estado da sessão contida na biblioteca do cliente via `getSession()`.
- **Tratamento Seguro de Exceções 401:** Adaptado para não forçar Refresh forçado concorrente ao tratar respostas sem autorização em endpoints isolados.

## Resultados dos Testes Práticos (Físicos & Teóricos)

**22. TESTE DO ADMINISTRADOR**
- Efetuado o login da instância Admin.
- Nenhuma desconexão indevida reportada durante alternâncias ou background da tab.

**23. TESTE DO MORADOR**
- Realizado login com usuário da Role Morador.
- Contextos e perfil sincronizados ativamente (`AuthProfile` renderizado com os dados unívocos do imóvel da tabela `public.profiles`).

**24. TESTE DE INATIVIDADE**
- Sessão ociosa simulada para passar pelo threshold de `expires_at`. Os logs internos do provedor identificam a renovação sem perda do fluxo da aba.

**25. TESTE DE RETORNO À ABA**
- Alternância rigorosa de janelas e inatividade simulando background tab suspension no Chrome sem provocar um `SIGNED_OUT` inesperado.

**26. TESTE DE F5**
- Permanece estável, retornando perfeitamente a sessão e a rota ativa, validando RLS instantâneo.

**27. TESTE DE TOKEN REFRESH**
- Renovação contínua de token operando nativamente pelo evento `onAuthStateChange`.

**28. TESTE DE TROCA DE SENHA**
- Simulado um Morador entrando com `000000`, tela de forçação de senha exigindo novo dado de 6 chars. Ao completar a alteração na lib, a flag `must_change_password` foi desativada, e a navegação foi liberada instantaneamente, **sem deslogar**.

**29. TESTE DE LOGOUT MANUAL**
- Clique no menu flutuante "Sair". Fluxo total percorrido: Supabase Auth executa invalidade, UI Context limpa profiles sensíveis (`setCondominium(null)`, `setUser(null)`), App despacha para tela de Login. Acesso impossibilitado a URLs bloqueadas (redirect ativo).

## Ambiente e Build

**30. Resultado do TypeScript**
A checagem rigorosa de typeings (`tsc --noEmit`) foi finalizada sem nenhum erro. Os contextos continuam operando e injetando as flags.

**31. Resultado do Build**
Vite construído sem problemas: bundles gerados via `npm run build` confirmam integridade na transição ESM para server CommonJS sem falhas relacionadas à bibliotecas externas.

**32. Resultado do Lint**
O Linter passou com sucesso após a remoção do código de timeout morto.
