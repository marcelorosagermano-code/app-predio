const fs = require('fs');

let page = fs.readFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', 'utf8');

// 1. Import refreshSession
page = page.replace(
  "const { condominio, user } = useAuth();",
  "const { condominio, user, refreshSession } = useAuth();"
);

// 2. Fix handleTransferSindicancia
const oldTransfer = 
\`  const handleTransferSindicancia = async () => {
    if (!transferTargetId) {
      setTransferError('Selecione um usuário para transferir a sindicância.');
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError('');

    try {
      const res = await authService.transferSindicancia(transferTargetId, transferSourceSindicoId);
      if (res.success) {
        setIsTransferModalOpen(false);
        // Force full refresh to reflect role changes and potential redirect
        window.location.href = '/dashboard';
      } else {
        setTransferError(res.message || 'Erro ao transferir sindicância.');
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Erro ao transferir sindicância.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };\`;

const newTransfer =
\`  const handleTransferSindicancia = async () => {
    if (!transferTargetId) {
      setTransferError('Selecione um usuário para transferir a sindicância.');
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError('');

    try {
      const res = await authService.transferSindicancia(transferTargetId);
      if (res.success) {
        setIsTransferModalOpen(false);
        // Atualiza a sessão silenciosamente no backend
        await refreshSession();
        // Se a role mudar para morador, a própria aplicação redireciona
        // Caso ainda esteja no painel (admin transferiu para alguém):
        await loadUsers();
      } else {
        setTransferError(res.message || 'Erro ao transferir sindicância.');
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Erro ao transferir sindicância.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };\`;

page = page.replace(oldTransfer, newTransfer);

// 3. Fix handleCreateMoradorSubmit
// Now it returns { success: boolean, message?: string, initialPassword?: string }
// Instead of res.data?.profileId etc.
const oldCreateStart = "const res = await authService.createMoradorUser(unitNumber.trim(), responsibleName.trim(), newUserRole);";
const oldCreateEnd = "setAddUserError(res.message || 'Erro ao criar usuário.');";
// Let's just rewrite the whole method

const createStartIdx = page.indexOf("  const handleCreateMoradorSubmit = async (e: React.FormEvent) => {");
let createEndIdx = page.indexOf("  const handleOpenEditModal", createStartIdx);
if(createEndIdx === -1) createEndIdx = page.indexOf("  const handleUpdateUserSubmit", createStartIdx);

let oldCreateMethod = page.substring(createStartIdx, createEndIdx);

const newCreateMethod = \`  const handleCreateMoradorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');

    if (!unitNumber.trim()) {
      setAddUserError('Por favor, informe o número do apartamento/unidade.');
      return;
    }

    if (!responsibleName.trim()) {
      setAddUserError('Por favor, informe o nome do responsável.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await authService.createMoradorUser(unitNumber.trim(), responsibleName.trim(), newUserRole);
      if (res.success) {
        setCreatedUserSuccess({
          unitNumber: unitNumber.trim(),
          responsibleName: responsibleName.trim(),
          initialPassword: res.initialPassword || '000000',
        });
        
        setUnitNumber('');
        setResponsibleName('');
        setNewUserRole('morador');
        
        // Refresh local list
        await loadUsers();
      } else {
        setAddUserError(res.message || 'Erro ao criar usuário.');
      }
    } catch (err: any) {
      setAddUserError(err.message || 'Erro inesperado ao criar usuário.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

\`;

page = page.replace(oldCreateMethod, newCreateMethod);

// 4. Update the select for Role if Sindico is creating user
// If admin, can create morador, conselho, sindico
// If sindico, can create morador, conselho
// We can change the options in the modal

fs.writeFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', page);
console.log('ConfiguracoesPage updated!');
