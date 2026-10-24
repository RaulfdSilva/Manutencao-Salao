# ADR-001 — Arquitetura modular e stack inicial

- Status: adotado para o bootstrap, conforme solicitação do projeto
- Data: 2026-10-24

## Contexto

O repositório estava inicializado, mas sem commits, código ou branch main no remoto. O aplicativo terá regras de recorrência, participação e autorização que precisam permanecer testáveis e independentes de UI e persistência. Esta entrega não implementa essas regras.

## Decisão

Usar React Native com Expo estável, Expo Router e TypeScript strict. Adotar Domain, Application, Infrastructure e Presentation com dependências para as camadas internas. ESLint verifica limites e ciclos, Prettier padroniza estilo, Vitest testa TypeScript puro e Zod valida dados externos. npm e package-lock garantem instalação reproduzível; CI verifica qualidade e exportação web.

Preparar documentação de integração Supabase/PostgreSQL sem adicionar SDK, schema, migrações ou credenciais antes de existir um consumidor. Manter uma única tela estática de inicialização. Não criar contêiner de injeção, estado global ou contratos especulativos.

## Alternativas e consequências

Uma organização apenas por tipo de arquivo seria mais curta, mas misturaria regras e integrações conforme o produto crescesse. Uma arquitetura com serviços genéricos, muitos pacotes ou microsserviços traria custo antecipado sem demanda. As quatro camadas adotadas tornam as fronteiras explícitas com poucos arquivos.

A exportação web fornece uma validação acessível na nuvem, mas não substitui execução Android/iOS. Vitest em Node não carrega componentes React Native; testes nativos/UI exigirão decisão futura. A autenticação sem e-mail e o formato Hourglass permanecem abertos. Alterar estas decisões exige novo ADR com evidências e impacto.

## Compatibilidade do lint

ESLint 9 foi mantido porque os plugins React e import usados pelo preset Expo ainda declaram suporte até a série 9. O npm sinaliza essa série como descontinuada; migrar para ESLint 10 assim que os peers do preset forem compatíveis, sem forçar a resolução de dependências.
