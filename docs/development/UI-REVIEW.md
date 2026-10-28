# Revisão da interface de demonstração — entrega 07

A interface é navegável, mas todos os dados são fictícios e somente para leitura. Não há autenticação, banco, gravação, notificações ou sincronização. Nenhuma tela é declarada pronta para produção.

## Como abrir

```sh
npm ci
npm run web
# ou, para dispositivo compatível com Expo SDK 58
npm start
```

Na web, abrir a URL exibida pelo Expo. No Android, abrir pelo Expo Go compatível com SDK 58 ou ambiente de desenvolvimento nativo configurado; o telefone precisa alcançar o servidor (rede compartilhada ou túnel previamente configurado). O ambiente de nuvem não garante acesso direto pela rede do celular. Não foram instaladas ferramentas de túnel ou SDK Android nesta entrega.

## Roteiro de revisão

- Início: saudação, próxima manutenção fictícia, resumo de pendências e navegação rápida.
- Manutenções: filtros Todas/Programadas/Concluídas/Canceladas e cartões com periodicidade/data/status.
- Abrir uma manutenção: verificações agrupadas por equipamento usando tarefas oficiais da entrega 06. Não há checkbox editável nem botão de salvamento fictício.
- Pendências: exemplos de problemas pendentes/concluídos, detalhes técnicos e acesso à manutenção de origem. Não há reparadores, estado em andamento ou resolução simulada.
- Equipe: três cadastros fictícios ativos, apenas nome e função; nenhum telefone ou métrica individual.
- No Início, “Explorar os estados da interface” permite Com exemplos/Sem dados/Carregando. O controle altera só a visualização; para sair de Carregando, voltar ao Início e escolher Com exemplos.
- Abrir um endereço de detalhe inexistente deve apresentar estado explícito de não encontrado e retorno funcional.

Rotas web: `/`, `/maintenance`, `/issues`, `/team`, `/maintenance/demo-monthly`, `/issues/demo-issue-open`. O servidor de uma exportação web deve oferecer fallback SPA para `index.html` em rotas profundas; o servidor de desenvolvimento Expo já resolve essas rotas.

## Fonte de dados e composição

`app/_layout.tsx` carrega o catálogo e compõe `createDemoSource` com `DemoProvider`. A apresentação consome `PresentationSource.load()` e DTOs mínimos, sem import de Infrastructure, repositórios ou adaptadores de testes. Os exemplos não são persistidos nem executam casos de uso de escrita/provisionamento.

As datas são civis de demonstração (outubro/novembro de 2026), não uma programação real. Papéis exibidos na equipe não definem um usuário autenticado. Resultados e problemas fictícios não representam trabalho executado. A projeção visual exclui inativos/telefones; autorização e minimização real continuam responsabilidade do servidor futuro.

Para integrar dados reais posteriormente, implementar adaptador que valide respostas externas, use identidade confiável e devolva DTOs autorizados; injetá-lo na composição. A identificação de demonstração só deve mudar quando a integração real estiver implementada e autorizada. Não ligar componentes diretamente aos repositórios nem adicionar estado de salvamento fictício.

## Testes reproduzíveis

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run export:web -- --output-dir /tmp/app-navigation-ui-web
npx expo export --platform android --output-dir /tmp/app-navigation-ui-android
```

Os testes Vitest incluem projeções, datas civis, privacidade, quatro destinos, status, estados vazios/carregamento/erro e componentes reais renderizados por React Native Web/React DOM. Apenas o hook de área segura e o contexto de dados são substituídos nesses testes de componente. `@types/react-dom` é a única dependência acrescentada, apenas de desenvolvimento para preservar TypeScript strict; não há biblioteca de UI ou novo framework Node de testes.

Há também um teste opcional de navegação real em Python/Playwright, disponível no ambiente desta execução. Ele não é incluído em `npm test` nem na CI Node: exige Python com Playwright e Chromium instalado (ou navegador gerenciado pelo Playwright).

```sh
python tests/presentation/navigation_web.py \
  --export-dir /tmp/app-navigation-ui-web \
  --screenshots /tmp/app-navigation-ui-review
```

O script serve a exportação somente em localhost, abre três larguras (320, 390 e 768 pixels), testa 18 grupos de verificações e falha em erros JavaScript. As capturas são opcionais e ficam fora do repositório. Não se adiciona dependência Python ao aplicativo.

A exportação Android gera o bundle, sem APK, assinatura ou instalação. Não valida runtime nativo, gesto Voltar do Android, TalkBack, escalas de fonte do sistema ou desempenho. Esses testes em aparelho/emulador permanecem obrigatórios antes da distribuição.

## Hospedagem pública — entrega 08

O modo de desenvolvimento single descrito acima permanece disponível. Para GitHub Pages, existe uma exportação static separada com prefixo `/Manutencao-Salao`, parâmetros fictícios e HTML por rota. Não testar a publicação somente com o servidor SPA. Execute o smoke com `--static --base-path /Manutencao-Salao`, conforme o [guia Pages](../deployment/GITHUB-PAGES.md), para exigir arquivos reais, recursos no prefixo e recarga direta.
