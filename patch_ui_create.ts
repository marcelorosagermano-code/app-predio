import fs from 'fs';

let content = fs.readFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', 'utf8');

// Add state
content = content.replace(
`  const [unitNumber, setUnitNumber] = useState<string>('');`,
`  const [unitNumber, setUnitNumber] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('morador');`
);

// Add to handle logic
content = content.replace(
`    setIsSubmittingUser(true);
    try {
      const res = await authService.createMoradorUser(unitNumber.trim(), responsibleName.trim());`,
`    setIsSubmittingUser(true);
    try {
      const res = await authService.createMoradorUser(unitNumber.trim(), responsibleName.trim(), newUserRole);`
);

content = content.replace(
`          email: userEmail,
          role: 'morador',
          cargo: 'Morador',`,
`          email: userEmail,
          role: newUserRole,
          cargo: newUserRole === 'sindico' ? 'Síndico' : newUserRole === 'conselho' ? 'Conselho Fiscal' : 'Morador',`
);

content = content.replace(
`        setUnitNumber('');
        setResponsibleName('');`,
`        setUnitNumber('');
        setResponsibleName('');
        setNewUserRole('morador');`
);

content = content.replace(
`                  setUnitNumber('');
                  setResponsibleName('');
                  setIsAddUserModalOpen(true);`,
`                  setUnitNumber('');
                  setResponsibleName('');
                  setNewUserRole('morador');
                  setIsAddUserModalOpen(true);`
);

// Add the Role Select to the modal (after the 'Responsável' field)
const roleSelectHTML = `
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Perfil de Acesso
            </label>
            <select
              id="input-modal-role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all bg-white"
            >
              <option value="morador">Morador</option>
              <option value="conselho">Conselho Fiscal</option>
              {user?.role === 'admin' && (
                <option value="sindico">Síndico</option>
              )}
            </select>
          </div>
`;

content = content.replace(
`            <input
              id="input-modal-responsible-name"
              type="text"
              required
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>`,
`            <input
              id="input-modal-responsible-name"
              type="text"
              required
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>${roleSelectHTML}`
);

fs.writeFileSync('src/pages/configuracoes/ConfiguracoesPage.tsx', content);
