# Fluxo de Hierarquia: Administrador e Síndico

## Visão Geral

Este documento descreve a implementação da hierarquia de acesso e controle para as permissões operacionais do **Síndico** em relação à autoridade máxima, o **Administrador**, mantendo a segurança e isolamento multi-tenant já existentes.

## Regras de Negócio

1.  **Autoridade do Administrador**: O perfil \`admin\` é a autoridade máxima. Pode realizar qualquer operação no sistema, inclusive criar e excluir perfis de síndico e moradores.
2.  **Acesso do Síndico**: O perfil \`sindico\` acessa o mesmo Painel Administrativo que o Administrador. Ele herda as permissões operacionais (financeiro, moradores, manutenções, etc.).
3.  **Restrição de Visibilidade**: Um \`sindico\` **nunca** poderá ver usuários com perfil \`admin\` na lista de usuários. Esta filtragem é imposta diretamente na camada de acesso a dados (backend).
4.  **Restrição de Modificação**: Apenas o Administrador pode promover, editar ou excluir outros administradores. Se um síndico tentar enviar uma requisição forjada (mesmo via API) para alterar um administrador, o backend bloqueará a ação.
5.  **Criação de Síndico**: Apenas perfis \`admin\` têm a interface e autorização na API para cadastrar um novo usuário como \`sindico\`. Um síndico não pode criar outro síndico.

## Implementação Técnica (Backend / APIs)

*   **Listagem Segura de Usuários (\`/api/admin/list-users\`)**:
    *   No lado do servidor, verificamos o \`userRole\` do solicitante.
    *   Se for \`sindico\`, filtramos os resultados para excluir qualquer objeto de usuário onde \`role === 'admin'\`.
*   **Edição e Exclusão Seguras (\`/api/admin/update-morador-user\`, \`/api/admin/delete-morador-user\`)**:
    *   Antes de aplicar qualquer modificação, a API consulta o registro alvo.
    *   Se o alvo for \`admin\`, a operação falha imediatamente com HTTP 403 Forbidden.
    *   Adicionalmente, se o alvo for \`sindico\` e o solicitante for \`sindico\`, a operação também falha com HTTP 403.
*   **Criação de Usuários (\`/api/admin/create-morador-user\`)**:
    *   O endpoint agora suporta receber um atributo \`role\` na requisição.
    *   É realizada validação de segurança: se o \`role\` solicitado for \`admin\`, bloqueia com 403. Se for \`sindico\` e o criador não for \`admin\`, bloqueia com 403.
    *   A geração de e-mail agora utiliza o prefixo de \`role\` dinâmico (ex: \`sindico.apNOME...\`).

## Funcionalidade no Painel Administrativo (Frontend)

*   Em **Configurações > Usuários e Acessos**, o botão "Adicionar Usuário" agora apresenta um campo de seleção "Perfil de Acesso" contendo Morador, Conselho Fiscal e, se o solicitante for \`admin\`, a opção Síndico.
*   Ao navegar para a página de usuários, o \`sindico\` visualiza apenas síndicos, conselheiros e moradores. O administrador da plataforma não é exibido em nenhum momento.
*   A rotação \`/admin\` do \`App.tsx\` agora agrupa o Síndico para o mesmo conjunto de Dashboard utilizado pelo Administrador.

## Checklist de Testes de Segurança Validado

*   [x] \`admin\` cria um \`sindico\` com sucesso
*   [x] \`sindico\` tenta criar outro \`sindico\` (rejeitado por não ter a opção)
*   [x] \`sindico\` não vê \`admin\` na sua lista de acessos
*   [x] \`sindico\` tenta excluir o \`admin\` via API (bloqueado, 403)
*   [x] \`sindico\` cria um morador comum
*   [x] \`admin\` consegue editar e excluir qualquer registro (exceto ele mesmo se protegido ou multi-tenant default)
