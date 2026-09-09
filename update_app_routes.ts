import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace getInitialTab to support pathname
content = content.replace(
  "  const getInitialTab = () => {",
  `  const getInitialTab = () => {
    try {
      const path = window.location.pathname;
      if (path === '/portal') return 'morador-dashboard';
      if (path === '/dashboard') return 'dashboard';`
);

// Update URL in handleSelectTab to use pathname if it's the main ones
// Actually, let's just make it push to /dashboard or /portal if it's a main tab
content = content.replace(
  `      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());`,
  `      const url = new URL(window.location.href);
      if (tab === 'dashboard') {
        url.pathname = '/dashboard';
        url.search = '';
      } else if (tab === 'morador-dashboard') {
        url.pathname = '/portal';
        url.search = '';
      } else {
        url.searchParams.set('tab', tab);
      }
      window.history.replaceState({}, '', url.toString());`
);

// Update the useEffect that syncs tab in URL
content = content.replace(
  `      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
        url.searchParams.set('tab', currentTab);
        window.history.replaceState({}, '', url.toString());
      }`,
  `      const url = new URL(window.location.href);
      if (currentTab === 'dashboard' && url.pathname !== '/dashboard') {
        url.pathname = '/dashboard';
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } else if (currentTab === 'morador-dashboard' && url.pathname !== '/portal') {
        url.pathname = '/portal';
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } else if (currentTab !== 'dashboard' && currentTab !== 'morador-dashboard' && url.searchParams.get('tab') !== currentTab) {
        url.searchParams.set('tab', currentTab);
        window.history.replaceState({}, '', url.toString());
      }`
);

// Update redirect logic for users
// From:
/*
  // Ajustar tab inicial conforme o perfil do usuário logado
  useEffect(() => {
    if (user) {
      if (isAdmin || isSindico || isCouncil) {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      } else {
        if (!currentTab.startsWith('morador-')) {
          handleSelectTab('morador-dashboard');
        }
      }
    }
  }, [user?.role, user?.id, isAdmin, isSindico, isCouncil]);
*/
// We need to enforce that Sindico goes to /dashboard (which is 'dashboard' tab), and Morador goes to /portal (which is 'morador-dashboard').
content = content.replace(
  `  // Ajustar tab inicial conforme o perfil do usuário logado
  useEffect(() => {
    if (user) {
      if (isAdmin || isSindico || isCouncil) {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      } else {
        if (!currentTab.startsWith('morador-')) {
          handleSelectTab('morador-dashboard');
        }
      }
    }
  }, [user?.role, user?.id, isAdmin, isSindico, isCouncil]);`,
  `  // Ajustar tab inicial conforme o perfil do usuário logado
  useEffect(() => {
    if (user) {
      // Admin e Síndico: Forçar para o painel administrativo caso tentem acessar área de morador
      if (user.role === 'admin' || user.role === 'sindico') {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      } 
      // Conselho: Também utiliza a visão administrativa mas com permissões restritas
      else if (user.role === 'conselho') {
        if (currentTab.startsWith('morador-')) {
          handleSelectTab('dashboard');
        }
      }
      // Morador: Forçar para o portal do morador caso tentem acessar área administrativa
      else if (user.role === 'morador') {
        if (!currentTab.startsWith('morador-')) {
          handleSelectTab('morador-dashboard');
        }
      }
    }
  }, [user?.role, user?.id, currentTab]);`
);

fs.writeFileSync('src/App.tsx', content);
