import fs from 'fs';

let content = fs.readFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', 'utf8');

// Add states
content = content.replace(
`  const [editingUser, setEditingUser] = useState<CondominiumUserItem | null>(null);`,
`  const [editingUser, setEditingUser] = useState<CondominiumUserItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string>('');`
);

// Add Transfer action logic
const transferActionStr = `
  const handleTransferSindicancia = async () => {
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
  };
`;

content = content.replace(
  "  const handleCreateMoradorSubmit = async (e: React.FormEvent) => {",
  transferActionStr + "\n  const handleCreateMoradorSubmit = async (e: React.FormEvent) => {"
);

// Add button in the UI next to Add User
const addTransferBtn = `
              {user?.role === 'sindico' && (
                <Button
                  id="btn-transfer-sindicancia"
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTransferError('');
                    setTransferTargetId('');
                    setIsTransferModalOpen(true);
                  }}
                  className="w-full sm:w-auto justify-center whitespace-nowrap text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  Transferir Sindicância
                </Button>
              )}
`;

content = content.replace(
`              <Button
                id="btn-add-user"
                type="button"
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {`,
addTransferBtn + `
              <Button
                id="btn-add-user"
                type="button"
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {`
);

// Add modal logic
const transferModalJSX = `
      {/* Modal Transferir Sindicância */}
      <Modal
        id="modal-transfer-sindicancia"
        isOpen={isTransferModalOpen}
        onClose={() => {
          if (!isSubmittingTransfer) setIsTransferModalOpen(false);
        }}
        title="Transferir Sindicância"
        description="Atenção: Esta ação transferirá permanentemente o seu cargo de síndico para outro usuário do condomínio."
        maxWidth="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 w-full">
            <Button
              id="btn-cancel-transfer"
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmittingTransfer}
              onClick={() => setIsTransferModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              id="btn-confirm-transfer"
              type="button"
              variant="danger"
              size="md"
              disabled={isSubmittingTransfer || !transferTargetId}
              onClick={handleTransferSindicancia}
              className="w-full sm:w-auto"
            >
              {isSubmittingTransfer ? 'Transferindo...' : 'Confirmar Transferência'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {transferError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h4 className="text-sm font-semibold text-amber-900 mb-2">Você está prestes a transferir a sindicância.</h4>
            <ul className="text-xs text-amber-800 list-disc pl-4 space-y-1">
              <li>O usuário selecionado passará a ser o novo síndico.</li>
              <li>Você deixará de ser síndico imediatamente.</li>
              <li>Seu acesso administrativo será encerrado.</li>
              <li>Você passará automaticamente a acessar o sistema como morador.</li>
            </ul>
            <p className="text-xs text-amber-900 font-bold mt-2">Essa ação não pode ser desfeita automaticamente.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Novo Síndico
            </label>
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all bg-white"
            >
              <option value="">Selecione um usuário...</option>
              {usersList
                .filter(u => u.id !== user?.id && u.role !== 'admin' && u.role !== 'sindico')
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nome} (Ap {u.unidadeNumero})
                  </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
`;

content = content.replace(
  "{/* Modal Adicionar Usuário */}",
  transferModalJSX + "\n      {/* Modal Adicionar Usuário */}"
);

fs.writeFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', content);
