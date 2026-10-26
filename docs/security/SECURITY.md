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

A política de produto permite a membros com acesso autorizado consultar membros ativos e seus papéis. Telefone e cadastros inativos permanecem exclusivos de administradores ativos. A entrega 02 adequou a consulta no domínio/aplicação: solicitantes ativos consultam ativos; somente administradores ativos consultam inativos e telefone. A identidade ainda depende de um futuro servidor. A listagem pública da equipe no aplicativo nunca significa acesso anônimo ou permissão para dispositivos revogados.

O aplicativo não registra presença, ausência ou frequência individual e não gera rankings ou avaliações. Disponibilidade serve ao planejamento; autoria de alterações e auditoria técnica não comprovam comparecimento e não podem ser reutilizadas para fiscalização. Definir minimização, retenção e acesso a esses registros antes da produção.

Offline exige avaliar proteção do banco/cache local, filas e fotos, incluindo acesso ao dispositivo, armazenamento, descarte e dados pessoais. Essas tecnologias e políticas ainda não foram escolhidas. Um dispositivo desconectado não recebe uma revogação nova instantaneamente. O servidor deve revalidar sessão, dispositivo, membro e permissão da operação ao sincronizar; negar uma operação não pode ser tratado silenciosamente como envio bem-sucedido. A apresentação e a recuperação de alterações recusadas precisam de definição técnica.

A central de avisos permanece disponível como canal mesmo sem permissão push; isso não garante que um dispositivo offline receba avisos novos imediatamente. Fotos, conteúdo de problemas e notificações precisam de autorização e limites a definir. Primeira ativação exige internet. Os estados de conflito e a sincronização colaborativa do PRD são requisitos, não garantias já entregues.

## Edição concorrente — entrega 02

Toda alteração de perfil, papel ou situação exige versão esperada. A aplicação rejeita versões obsoletas e o contrato `saveIfVersion` exige comparação/gravação atômicas no armazenamento, sem produzir auditoria ou retirada em caso de conflito. Versão não é credencial: autorização é verificada primeiro e continua dependendo de identidade confiável no servidor. O futuro transporte deve tratar erros sem vazar informação sobre cadastros inacessíveis.

O repositório não oferece gravação irrestrita; um adaptador que apenas leia a versão e depois grave sem condição não cumpre o contrato. As garantias do último administrador, revogação de acesso, retirada de designações e rollback real ainda exigem implementação e testes no servidor/banco. O adaptador de testes e sua fila em memória não demonstram segurança em produção. Não resolver conflito sobrescrevendo automaticamente os dados recentes com um formulário antigo.

## Planejamento de manutenções — entrega 03

Casos de uso leem o papel/situação atual pelo contrato de membros. Administrador ativo é exigido para aprovação/revisão de regras e alterações administrativas da ocorrência; organização de equipe também admite responsável ativo explicitamente autorizado. Membros ativos consultam a programação e sua elegibilidade. Não há endpoint, autenticação real ou confiança em papel enviado no comando. Registros/eventos retornam referências técnicas de membros, sem copiar telefone.

Cancelamento não apaga a ocorrência ou designações históricas, não possui restauração e não é revertido pela geração de slots. Mudanças exigem CAS e eventos na mesma transação; o servidor deverá garantir unicidade de ciclos por congregação/regra, origem imutável, histórico de revisões somente por acréscimo, autorização e rollback reais. Revisar vigência não pode contornar cancelamentos ou recriar ciclos materializados; revisão e geração compartilham a serialização transacional. O consumo de eventos precisa revalidar versão/situação antes de enviar avisos, evitando notificações obsoletas. O código desta entrega não envia notificações nem prova que avisos chegaram ao celular.

A porta de escala de áudio não é integração Hourglass e requer fonte/mapeamento autorizados. A revisão de disponibilidade não armazena respostas; ela não pode virar controle de frequência. O futuro adaptador da retirada de designações deve preservar registros técnicos e operar na transação de desativação do membro. Conversão de horário com DST, banco, outbox e sincronização exigem validação futura. Ver ADR-005.

## Convites e disponibilidade — entrega 04

Responder exige identidade confiável, cadastro ativo, congregação, revisão atual, ocorrência não cancelada e, na modalidade designada, designação atual. Não confiar em papéis enviados no comando. Administrador/responsável não designado administra o planejamento, mas não responde na modalidade designada. Consultas próprias não expõem respostas alheias ou telefones; totais são restritos a administradores/responsáveis vinculados.

Eventos são registros técnicos, não histórico individual de participação. Respostas anteriores não são copiadas para eventos; guardar somente a última resposta por membro/revisão para planejamento. Todas as revisões de convites/respostas/disponibilidade individual são temporárias e devem ser eliminadas após conclusão técnica ou cancelamento. Remoção invalida respostas atuais e geração do convite; reinclusão nunca recupera a resposta anterior. Histórico anual utiliza apenas fatos técnicos por manutenção, sem avaliações por pessoa.

`closeDue`, `refresh`/`refreshIn` e verificação de convites são contratos de processamento confiável, sem autenticação fornecida por esta entrega. Não expô-los publicamente. O futuro servidor deve executar encerramentos sem o celular, reconciliar elegibilidade na transação comum e revalidar eventos antes da entrega. Testes locais não comprovam execução contínua, autorização de endpoints, outbox ou atomicidade distribuída. Ver ADR-006.

## Descarte de disponibilidade — decisões finais

O contrato de retenção deve remover eventos individuais e suas chaves (que também podem conter identificadores), filas, projeções, todas as revisões e caches, preservando somente fatos técnicos/operacionais necessários. O marcador não pessoal impede que uploads offline antigos recriem respostas ou convites após descarte. Um aparelho desconectado só recebe a exclusão na sincronização futura; tombstones devem sobreviver à restauração de backups para impedir ressurreição de dados. Definir prazos físicos de expiração, réplicas, backups, logs, observabilidade sem dados pessoais e procedimento de restauração com supressão antes de produção, sem inventar prazo nesta entrega.

Os snapshots antigos de manutenção contêm atores/designações; não equivalem à projeção minimizada de controle anual. O adaptador futuro deverá remover/minimizar referências individuais desnecessárias em outbox/auditoria e dados derivados, sem alterar artificialmente o estado de negócio da ocorrência. O descarte atual é demonstrado somente no adaptador de testes, não é exclusão física nem anonimização certificada. Conclusão real deve ser autorizada e verificada no servidor antes de emitir recibo para os contratos futuros de retenção. Ver ADR-006.

## Requisito obrigatório de liberação — referências pessoais em ocorrências terminais

A reconciliação de equipe/modalidade passou a ser obrigatória na mesma transação da ocorrência, via `availabilityAudienceChanged`/`refreshIn`. Assim, exclusão e reinclusão não reaproveitam respostas ou convites revogados. Eventos assíncronos posteriores não substituem essa garantia; falhas devem reverter também a equipe e seu evento.

Permanece uma pendência obrigatória antes da produção: minimizar `assignedMemberIds`, `responsibleMemberIds` e outros identificadores em ocorrências canceladas/encerradas, saídas `get`/`list`, snapshots, eventos/chaves, projeções, logs e armazenamento futuro. Incluir cópias offline, backups e restaurações nos testes de conformidade dos adaptadores reais. A auditoria encontrou referências retornadas em consultas de ocorrência cancelada; o descarte da disponibilidade não cobre automaticamente todas essas representações. Preservar dados operacionais necessários de ocorrências ativas e somente história técnica necessária após o término, sem avaliação individual. A entrega 04 não implementou conclusão; a entrega 05 a introduz no domínio/aplicação, sem validar eliminação física em banco.

## Entrega 05 — limites de segurança e privacidade

A conclusão técnica agora existe no domínio/aplicação (ADR-007), sem backend real. Administrador ativo ou responsável vinculado conclui manutenção e resolve pendências; só administrador altera modelos e corrige resultados após conclusão. Preenchimento revalida situação, congregação e modalidade. Identidade continua sendo porta confiável futura; nenhum comando deve aceitar papel declarado pelo cliente como autorização.

Checklists, problemas, correções, recibos e novos eventos técnicos não guardam executor/ator individual. Texto livre e referências de fotos podem conter dados pessoais: orientar conteúdo estritamente técnico, validar na fronteira futura e controlar acesso/mídia no servidor. IDs de comandos devem ser opacos e não conter nomes/identificadores de pessoas. Respostas individuais de disponibilidade não são copiadas para histórico técnico.

Conclusão, retenção em todas as revisões e fatos anuais são atômicos por contrato. Testes em memória demonstram comportamento e rollback, não exclusão física, RLS, sincronização ou segurança de produção. Continuam obrigatórios expurgo/minimização de assignedMemberIds/responsibleMemberIds e representações legadas, eventos/snapshots/logs, caches offline, backups e restaurações. Não remover dados necessários de manutenção ativa. Nenhuma implementação de fotos, autenticação, armazenamento real ou painel anual foi adicionada.
