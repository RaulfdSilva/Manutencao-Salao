# ADR-010 — Prévia pública estática no GitHub Pages

- Status: adotado na Implementação 08, base main `0281c94`.
- Referências: autorização explícita de prévia pública fictícia; ADR-009 e catálogo ADR-008.

A publicação usa um workflow separado da CI, limitado a push em main ou disparo manual em main. Não publicar branches de desenvolvimento ou PRs. Build recebe contents:read/pages:read; deploy recebe apenas pages:write/id-token:write e usa o ambiente github-pages. Actions oficiais configuram Pages, enviam o artefato e fazem deploy com credencial automática do GitHub, sem PAT.

`app.config.ts` mantém o desenvolvimento normal na raiz com saída single; quando `GITHUB_PAGES_PREVIEW=1`, usa saída static e `experiments.baseUrl=/Manutencao-Salao`, mecanismo documentado pelo SDK 58. Links internos continuam sendo rotas reais do Expo Router. `generateStaticParams` enumera os IDs da própria fonte fictícia, sem lista paralela ou acesso a repositórios. A composição pública é explicitamente somente demonstração e não aceita sessão/servidor/dados externos.

O exportador gera HTML por rota. O preparo do artefato move cada HTML de rota para `<rota>/index.html`, preservando seu conteúdo, adiciona .nojekyll e mantém 404 real quando disponível. Isso atende servidores puramente estáticos sem depender de fallback SPA, reescrita de URL, hash ou suporte implícito a extensão .html. JS/CSS/assets usam o prefixo oficial, inclusive quando a URL profunda termina em barra.

O build desabilita leitura de .env, usa somente a composição fictícia e executa testes antes de exportar. Fonte pública não possui portas de escrita nem dados pessoais. Guardas/testes de privacidade são regressões do conjunto atual, não garantia de que alterações futuras sejam automaticamente seguras: qualquer ligação a adaptadores reais exige separar/remover a prévia pública antes da integração. Nunca publicar credenciais, registros privados ou variáveis públicas com dados sensíveis.

A branch configura e testa a publicação, mas o primeiro deploy real depende de merge autorizado em main e de Settings > Pages > Source: GitHub Actions. Não fazer merge ou habilitar publicação de branch para contornar essa dependência. Atualizações do site ocorrerão apenas após o fluxo autorizado em main. Execução manual em outra ref é recusada pelos jobs.

A validação usa servidor estático local sem fallback sob o subdiretório exato, navegador em largura móvel, navegação real, recargas, links diretos, recursos e ausência de ações de escrita. GitHub Pages é cache público, sem autenticação ou backend; não é ambiente de produção nem oferece offline/sincronização. Rotas dinâmicas novas precisam ser enumeradas antes de publicar; URLs inexistentes retornam 404.
