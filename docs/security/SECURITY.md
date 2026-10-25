# Segurança

## Estado atual

Não há autenticação, sessões, conexão ao Supabase ou armazenamento de credenciais implementados. A tela de bootstrap não representa um fluxo seguro de produção. Não adicionar autenticação fictícia.

## Autenticação sem e-mail — plano a validar

Um serviço confiável deverá provisionar contas individuais e emitir tokens temporários de ativação, criptograficamente aleatórios, com expiração curta e uso único. Armazenar apenas representação protegida do token no servidor; limitar tentativas e consumo de forma atômica para evitar replay e concorrência. Entrega, validade, recuperação de conta e autorização do emissor ainda precisam ser definidas.

Na ativação, trocar o token por uma sessão vinculada ao dispositivo. Nunca manter o token de ativação como credencial permanente. O servidor deverá permitir revogar dispositivos, sessões e permissões, com política explícita para expiração, refresh, rotação e prazo efetivo de revogação. Tokens de acesso de curta duração e verificações de sessão devem ser avaliados para evitar acesso residual após revogação.

Credenciais de sessão nativas deverão usar armazenamento seguro do sistema operacional (por exemplo Expo SecureStore após avaliação), jamais AsyncStorage, arquivos públicos ou logs. A estratégia web exige avaliação separada (cookies protegidos e ameaças XSS/CSRF); não assumir equivalência com o armazenamento nativo.

## Autorização e isolamento

Autoridade reside no servidor, não em telas ocultas ou claims controladas pelo cliente. Aplicar privilégio mínimo, verificação de pertencimento à congregação e autorização por operação, incluindo consultas, arquivos e funções. O backend escolhido deve impedir acesso a dados fora do escopo autorizado e testar leituras/escritas negadas. Se PostgreSQL/Supabase for adotado, avaliar RLS; chaves `service_role`, quando aplicáveis, e demais segredos administrativos permanecem exclusivamente no backend. O MVP atende uma única congregação; o isolamento é uma proteção de dados, não autorização para implementar suporte completo a várias congregações.

Dados pessoais devem ser minimizados, acessíveis apenas a quem necessita e protegidos em trânsito e armazenamento. Definir finalidade, retenção, remoção, auditoria e recuperação antes da produção. Evitar tokens e dados pessoais em telemetria. Importações e documentos exigem validação, limites e autorização; não confiar em arquivos do Hourglass como comandos ou identidades verificadas.

## Configuração e vulnerabilidades

`.env.example` contém apenas nomes públicos opcionais. `EXPO_PUBLIC_*` é incorporado ao bundle e legível pelo usuário; nunca usar para segredos. `.env` não deve ser versionado. A URL e a chave pública do Supabase não substituem RLS ou sessão válida. TLS e verificação de integridade devem permanecer habilitados.

Reportar vulnerabilidades de modo privado ao mantenedor por canal acordado; o canal específico ainda precisa ser definido. Não publicar credenciais, dados pessoais ou provas exploráveis em issues públicas. CI e lockfile ajudam na qualidade, mas não constituem auditoria de segurança nem certificação para produção.

## Pendências verificadas no bootstrap (2026-10-24)

`npm audit --omit=dev --audit-level=high` reportou cinco ocorrências de severidade alta na cadeia da CLI do Expo (incluindo pacotes agregadores), decorrentes de `node-forge@1.4.0` e `zod@3.25.76` transitivos. A dependência direta da aplicação é Zod 4.6.7. O registry ainda informa node-forge 1.4.0 como estável mais recente. A CLI do Expo declara Zod 3; substituir essa dependência por Zod 4 via override não é uma correção de compatibilidade comprovada.

Advisories: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) e [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). O npm propõe downgrade incompatível para Expo 54 como correção forçada; ele não foi aplicado. Acompanhar correção upstream e repetir auditoria antes de distribuição. Esses resultados são pendências de dependências, não uma declaração de segurança do aplicativo.

## Limites da entrega 01 de membros

A aplicação verifica o cadastro atual do ator, restringe escritas a administradores ativos e projeta respostas sem telefone para os demais. `MemberActor` é um contrato para a futura identidade resolvida no servidor: receber esse objeto não autentica uma pessoa. O domínio não deve ser exposto diretamente como resposta porque seu registro interno contém telefone.

A proteção do último administrador exige transação serializada por congregação no servidor. O adaptador em memória e seus testes demonstram a orquestração, não segurança ou concorrência distribuída reais. Remoção de atribuições futuras, auditoria e mudança de estado precisarão compartilhar a mesma transação; um adaptador que ignore essas portas é incompleto. Dados históricos não podem ser apagados.

Reativar só altera o estado do membro: não existe operação de dispositivos nestes casos de uso. O futuro módulo de autenticação deve continuar negando dispositivos explicitamente revogados e verificar a situação atual do membro em cada operação protegida. O primeiro administrador não pode ser criado por um endpoint público sem identidade; o procedimento inicial controlado será implementado separadamente. Permanecem pendentes testes de servidor, RLS, sessões e revogação.

## Privacidade e offline no PRD oficial do MVP 1.0

A política de produto permite a membros com acesso autorizado consultar membros ativos e seus papéis. Telefone e cadastros inativos permanecem exclusivos de administradores ativos. A implementação 01 ainda é mais restritiva na consulta; sua adequação não foi realizada nesta consolidação documental. A listagem pública da equipe no aplicativo nunca significa acesso anônimo ou permissão para dispositivos revogados.

O aplicativo não registra presença, ausência ou frequência individual e não gera rankings ou avaliações. Disponibilidade serve ao planejamento; autoria de alterações e auditoria técnica não comprovam comparecimento e não podem ser reutilizadas para fiscalização. Definir minimização, retenção e acesso a esses registros antes da produção.

Offline exige avaliar proteção do banco/cache local, filas e fotos, incluindo acesso ao dispositivo, armazenamento, descarte e dados pessoais. Essas tecnologias e políticas ainda não foram escolhidas. Um dispositivo desconectado não recebe uma revogação nova instantaneamente. O servidor deve revalidar sessão, dispositivo, membro e permissão da operação ao sincronizar; negar uma operação não pode ser tratado silenciosamente como envio bem-sucedido. A apresentação e a recuperação de alterações recusadas precisam de definição técnica.

A central de avisos permanece disponível como canal mesmo sem permissão push; isso não garante que um dispositivo offline receba avisos novos imediatamente. Fotos, conteúdo de problemas e notificações precisam de autorização e limites a definir. Primeira ativação exige internet. Os estados de conflito e a sincronização colaborativa do PRD são requisitos, não garantias já entregues.
