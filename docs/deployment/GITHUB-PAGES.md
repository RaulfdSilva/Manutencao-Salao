# Prévia pública pelo navegador do celular

A prévia publica somente os exemplos fictícios da interface, com o catálogo de áudio da entrega 06. É somente leitura, sem login, banco, salvamento, notificações ou dados reais da congregação. Não é uma versão de produção nem um APK. Depois do deploy, basta abrir o link no Chrome do Android; não é necessário computador, Expo Go, servidor local, token pessoal ou serviço pago. GitHub Pages para repositório público usa a hospedagem gratuita do GitHub.

## Configurar pelo celular

Com uma conta que possa administrar este repositório, abra no navegador:

`https://github.com/RaulfdSilva/Manutencao-Salao`

1. Entre em **Settings**. Se a aba estiver oculta, use o menu de abas do repositório; se necessário, ative “Versão para computador” no menu do Chrome, ainda no próprio celular.
2. Abra **Pages**.
3. Em **Build and deployment**, escolha **Source: GitHub Actions**. Não selecione uma branch/pasta de publicação. Se aparecer um botão de confirmação, salve a escolha.
4. Revise e integre manualmente `feat/github-pages-preview` em `main` quando aprovado. Esta entrega não cria PR nem faz merge automaticamente. Configure a origem Pages antes do primeiro deploy ou reexecute o workflow após configurá-la.
5. Em **Actions**, selecione **Public demo preview**. Após o merge, um push na main inicia o workflow automaticamente.
6. Para publicar novamente sem novo commit, toque em **Run workflow**, escolha a branch **main** e confirme. Esse botão só estará disponível depois de o workflow existir na branch padrão. Outra branch não é publicada: os jobs verificam a ref main também no disparo manual.

O workflow usa credenciais temporárias automáticas do próprio GitHub/OIDC. Não cadastre PAT, chave Supabase, segredo Expo ou token pessoal. A fonte atual não requer credenciais.

## Encontrar o endereço e o resultado

A URL esperada para este projeto é:

**https://raulfdsilva.github.io/Manutencao-Salao/**

O endereço real aparecerá em **Settings > Pages**, na etapa **Publish public demo** do job deploy e no ambiente **github-pages**. Só considerar publicado após observar deploy concluído com sucesso. A branch de configuração publicada não significa que o site já está no ar.

Na execução de Actions, dois jobs devem concluir:

- **build:** configura Pages, instala pelo lockfile, verifica TypeScript/testes, exporta Expo web estático, prepara diretórios e envia o artefato.
- **deploy:** publica o artefato no ambiente github-pages. Apenas este job tem pages:write e id-token:write.

A CI existente permanece independente e não foi alterada. O workflow de publicação não roda em Pull Requests ou pushes de branches de desenvolvimento. O disparo manual também depende de main. As regras de proteção do ambiente/repositório continuam valendo.

## Testar no Android

Abra a URL publicada e confira as quatro abas. Abra um cartão de manutenção e uma pendência, use Voltar e atualize a página. Estes links também devem abrir diretamente, sem passar antes pelo Início:

- `/Manutencao-Salao/maintenance/`
- `/Manutencao-Salao/issues/`
- `/Manutencao-Salao/team/`
- `/Manutencao-Salao/maintenance/demo-fortnightly/`
- `/Manutencao-Salao/maintenance/demo-monthly/`
- `/Manutencao-Salao/maintenance/demo-quarterly/`
- `/Manutencao-Salao/maintenance/demo-semiannual/`
- `/Manutencao-Salao/issues/demo-issue-open/`
- `/Manutencao-Salao/issues/demo-issue-resolved/`

Os caminhos sem barra final também são atendidos pelo redirecionamento normal de diretórios. O aviso de demonstração deve permanecer visível. Não há formulários ou botões de edição/gravação. Para explorar estados vazios/carregamento, use o controle de demonstração no Início. Isso não altera dados.

## Entender e investigar falhas

Abra **Actions > Public demo preview > execução com falha > job vermelho > etapa vermelha** e leia as últimas linhas.

| Sintoma                                         | Conferência                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Workflow não aparece                            | Confirmar que o arquivo foi integrado à main e Actions está habilitado.                                                              |
| Jobs pulados no disparo manual                  | Escolher main; outra ref é bloqueada intencionalmente.                                                                               |
| Configure Pages informa site não configurado    | Voltar a Settings > Pages e selecionar GitHub Actions; depois reexecutar jobs.                                                       |
| Instalação/testes/exportação falham             | Corrigir a falha indicada no log; não pular a verificação ou publicar artefato antigo.                                               |
| Deploy negado ou aguardando aprovação           | Conferir permissões de Actions e regras do ambiente github-pages com o administrador. Não resolver criando PAT.                      |
| Página sem JavaScript, CSS ou imagens           | Conferir o prefixo `/Manutencao-Salao` na configuração da exportação e se o artefato dist foi preparado.                             |
| Detalhe abre pela navegação, mas recarga dá 404 | Conferir generateStaticParams, o arquivo `<rota>/index.html` e o preparo do artefato; não aceitar teste com fallback SPA como prova. |
| Conteúdo antigo após deploy correto             | Confirmar o SHA da execução; atualizar a página ou testar em aba anônima. Pages/navegador podem manter cache.                        |

## Decisão técnica e reprodução local opcional

`app.config.ts` usa `GITHUB_PAGES_PREVIEW=1` para ativar `web.output=static` e `experiments.baseUrl=/Manutencao-Salao` do SDK 58. Sem esse sinalizador, desenvolvimento/CI normal permanecem na raiz com saída single. Os parâmetros dinâmicos são obtidos da mesma fonte fictícia pela composição pública, sem consultar registros reais.

`prepare-pages.mts` converte cada HTML realmente gerado pelo Expo para `<rota>/index.html`, sem substituir seu conteúdo por uma página genérica. Acrescenta .nojekyll para preservar `_expo` e mantém um 404 exportado. Falha se houver colisão de páginas, arquivo de ambiente ou symlink no artefato. Usa suporte nativo a TypeScript do Node 24 do repositório, sem dependências adicionais.

Para reproduzir tecnicamente (opcional, não necessário para o responsável testar o site pelo celular):

```sh
npm ci
npx expo install --check
npm run lint
npm run format:check
npm run typecheck
npm test
GITHUB_PAGES_PREVIEW=1 EXPO_NO_DOTENV=1 npm run export:web -- --output-dir /tmp/pages-preview
node scripts/prepare-pages.mts /tmp/pages-preview
python tests/presentation/navigation_web.py \
  --export-dir /tmp/pages-preview --static --base-path /Manutencao-Salao
```

O teste opcional de navegador requer Python/Playwright/Chromium e serve os arquivos reais sem fallback, em 320/390/768 pixels. Confere recursos sob o prefixo, dez rotas canônicas, barras finais, abertura direta, recargas, detalhes, Voltar, estados e ausência de formulários/escritas. Rotas dinâmicas novas precisam ser enumeradas; URLs desconhecidas retornam 404. O teste web não comprova execução em aparelho Android físico.

## Privacidade e futuras integrações

O build desabilita `.env` e usa somente `createPublicDemoSource`, sem portas de escrita, sessão ou adaptadores reais. Os testes fixam os IDs e nomes fictícios e a ausência de telefones/tokens/atribuições individuais nos DTOs. Não inserir dados reais, identificadores privados, credenciais ou variáveis EXPO_PUBLIC sensíveis na fonte ou no build: conteúdo estático publicado é público e pode ser copiado/cacheado.

Antes de ligar o aplicativo a informações reais, manter a composição pública separada e revisar a publicação automática. Não trocar a fonte desta prévia por dados privados. Os testes atuais não certificam a segurança de alterações futuras; minimização/retenção de dados pessoais do produto real continuam pendentes conforme ADR-006. Ver ADR-010.

Nesta entrega, a branch e o artefato foram preparados para revisão; o deploy real só pode ser confirmado após merge manual em main, configuração de Pages e execução observada do workflow.
