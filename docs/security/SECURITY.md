# Segurança

## Estado atual

Não há autenticação, sessões, conexão ao Supabase ou armazenamento de credenciais implementados. A tela de bootstrap não representa um fluxo seguro de produção. Não adicionar autenticação fictícia.

## Autenticação sem e-mail — plano a validar

Um serviço confiável deverá provisionar contas individuais e emitir tokens temporários de ativação, criptograficamente aleatórios, com expiração curta e uso único. Armazenar apenas representação protegida do token no servidor; limitar tentativas e consumo de forma atômica para evitar replay e concorrência. Entrega, validade, recuperação de conta e autorização do emissor ainda precisam ser definidas.

Na ativação, trocar o token por uma sessão vinculada ao dispositivo. Nunca manter o token de ativação como credencial permanente. O servidor deverá permitir revogar dispositivos, sessões e permissões, com política explícita para expiração, refresh, rotação e prazo efetivo de revogação. Tokens de acesso de curta duração e verificações de sessão devem ser avaliados para evitar acesso residual após revogação.

Credenciais de sessão nativas deverão usar armazenamento seguro do sistema operacional (por exemplo Expo SecureStore após avaliação), jamais AsyncStorage, arquivos públicos ou logs. A estratégia web exige avaliação separada (cookies protegidos e ameaças XSS/CSRF); não assumir equivalência com o armazenamento nativo.

## Autorização e isolamento

Autoridade reside no servidor, não em telas ocultas ou claims controladas pelo cliente. Aplicar privilégio mínimo, verificação de pertencimento à congregação e autorização por operação, incluindo consultas, arquivos e funções. PostgreSQL/RLS deve impedir acesso cruzado entre congregações; testar leituras e escritas negadas. Chaves `service_role` e segredos administrativos permanecem exclusivamente no backend.

Dados pessoais devem ser minimizados, acessíveis apenas a quem necessita e protegidos em trânsito e armazenamento. Definir finalidade, retenção, remoção, auditoria e recuperação antes da produção. Evitar tokens e dados pessoais em telemetria. Importações e documentos exigem validação, limites e autorização; não confiar em arquivos do Hourglass como comandos ou identidades verificadas.

## Configuração e vulnerabilidades

`.env.example` contém apenas nomes públicos opcionais. `EXPO_PUBLIC_*` é incorporado ao bundle e legível pelo usuário; nunca usar para segredos. `.env` não deve ser versionado. A URL e a chave pública do Supabase não substituem RLS ou sessão válida. TLS e verificação de integridade devem permanecer habilitados.

Reportar vulnerabilidades de modo privado ao mantenedor por canal acordado; o canal específico ainda precisa ser definido. Não publicar credenciais, dados pessoais ou provas exploráveis em issues públicas. CI e lockfile ajudam na qualidade, mas não constituem auditoria de segurança nem certificação para produção.

## Pendências verificadas no bootstrap (2026-10-24)

`npm audit --omit=dev --audit-level=high` reportou cinco ocorrências de severidade alta na cadeia da CLI do Expo (incluindo pacotes agregadores), decorrentes de `node-forge@1.4.0` e `zod@3.25.76` transitivos. A dependência direta da aplicação é Zod 4.6.7. O registry ainda informa node-forge 1.4.0 como estável mais recente. A CLI do Expo declara Zod 3; substituir essa dependência por Zod 4 via override não é uma correção de compatibilidade comprovada.

Advisories: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) e [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). O npm propõe downgrade incompatível para Expo 54 como correção forçada; ele não foi aplicado. Acompanhar correção upstream e repetir auditoria antes de distribuição. Esses resultados são pendências de dependências, não uma declaração de segurança do aplicativo.
