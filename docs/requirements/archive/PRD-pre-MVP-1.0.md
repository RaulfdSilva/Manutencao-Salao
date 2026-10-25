> **Documento histórico — substituído pelo [PRD oficial do MVP 1.0](../PRD.md).**
> Preservado para rastreabilidade da entrega 01. Requisitos, pendências e RFs abaixo refletem a versão anterior; não representam a fonte vigente. Divergências são conciliadas no ADR-003.

# PRD — Manutenção Salão

## Objetivo e estágio

Organizar manutenções preventivas e corretivas dos equipamentos de Áudio e Vídeo de uma congregação. A entrega 01 acrescenta domínio e casos de uso de membros com testes unitários, sem telas, persistência ou autenticação.

## Requisitos confirmados e rastreabilidade

O briefing forneceu os temas, mas não o texto original individual dos RF-01 a RF-24. A numeração abaixo é uma decomposição proposta desses temas para rastreabilidade; deve ser validada com o responsável antes da implementação. Não implica aprovação de detalhes ausentes. Os RF-01 a RF-24 continuam **documentados, não implementados integralmente**. A entrega de membros descrita abaixo implementa apenas regras locais e contratos; não comprova autorização no servidor.

| ID    | Requisito baseado no briefing                                                         |
| ----- | ------------------------------------------------------------------------------------- |
| RF-01 | Permitir contas individuais sem depender de e-mail.                                   |
| RF-02 | Ativar dispositivos por token de uso único.                                           |
| RF-03 | Usar tokens temporários de ativação, distintos das credenciais permanentes de sessão. |
| RF-04 | Permitir revogação de dispositivos.                                                   |
| RF-05 | Controlar e revogar permissões de acesso.                                             |
| RF-06 | Organizar manutenções preventivas.                                                    |
| RF-07 | Organizar manutenções corretivas.                                                     |
| RF-08 | Permitir manutenções recorrentes.                                                     |
| RF-09 | Apresentar calendário de manutenções.                                                 |
| RF-10 | Permitir reagendamento de manutenções.                                                |
| RF-11 | Convidar participantes para manutenções.                                              |
| RF-12 | Permitir confirmação voluntária de participação.                                      |
| RF-13 | Vincular instruções a documentos autorizados.                                         |
| RF-14 | Disponibilizar checklists de execução.                                                |
| RF-15 | Registrar histórico de execução das manutenções.                                      |
| RF-16 | Registrar pendências identificadas.                                                   |
| RF-17 | Acompanhar a resolução de pendências.                                                 |
| RF-18 | Enviar notificações automáticas.                                                      |
| RF-19 | Importar a escala de som exportada pelo Hourglass.                                    |
| RF-20 | Interpretar e validar os dados importados antes de utilizá-los.                       |
| RF-21 | Vincular manutenções quinzenais ao primeiro fim de semana do mês.                     |
| RF-22 | Vincular manutenções quinzenais ao terceiro fim de semana do mês.                     |
| RF-23 | Manter sessões revogáveis associadas aos dispositivos autorizados.                    |
| RF-24 | Isolar dados da congregação e aplicar permissões no servidor.                         |

RF-20 explicita a necessidade técnica de validar entrada externa, e RF-23/RF-24 refletem o requisito de segurança do briefing. Não há especificação anterior disponível para confirmar a correspondência exata dos números.

## Pontos confirmados

Interface em português brasileiro; contas individuais sem e-mail; adesão voluntária aos convites; documentos autorizados como fonte de instruções; recorrência vinculada ao primeiro e terceiro fim de semana, não simplesmente um intervalo fixo de 14 dias. Não inventar instruções técnicas oficiais ou reproduzir conteúdo sem autorização.

## Decisões pendentes

- Validar esta numeração e critérios de aceite detalhados com o responsável.
- Definir identificação de conta, provisionamento e recuperação sem e-mail. Os papéis e a política local inicial de membros estão definidos abaixo.
- Definir duração, entrega, limitação de tentativas e procedimento de revogação dos tokens e sessões.
- Obter uma exportação real e anonimizada do Hourglass: formato, campos, encoding, timezone, identificação de pessoas, duplicatas e versões ainda desconhecidos. Não assumir CSV, JSON ou API disponível.
- Definir fim de semana em fronteiras de mês, horário/fuso da congregação, feriados, exceções, conflitos e efeitos do reagendamento nas próximas ocorrências.
- Definir quem pode convidar, limites de participação e efeitos de cancelamento.
- Definir canais e horários de notificação, consentimento e política de tentativas.
- Definir documentos autorizados, controle de revisão e responsáveis por aprovação.
- Definir catálogo de equipamentos, retenção, auditoria, necessidade de offline e sincronização.

## Fora do escopo deste estágio

Implementar autenticação, backend, calendário, importação, notificações, telas funcionais ou migrações. A autorização da entrega 01 abrange somente domínio, contratos, casos de uso e testes de membros. Integrações exigem nova autorização.

## Entrega 01 — domínio de membros

Regras aprovadas para este módulo:

- Nome obrigatório e telefone opcional, visível somente a administradores ativos.
- Um papel por membro: `administrator`, `maintenance_manager` ou `member`; situação `active` ou `inactive`.
- Somente administradores ativos cadastram membros. A política conservadora desta entrega restringe também edição, troca de papel, desativação, reativação e listagem a administradores ativos. Demais membros ativos podem consultar somente o próprio cadastro, sem a propriedade telefone. A ampliação dessas permissões exige decisão explícita.
- Identificador e congregação são imutáveis; identidades são fornecidas por um gerador injetado e devem ser únicas no armazenamento. O domínio trata identificadores como valores opacos, não documentos pessoais.
- Criação produz membro ativo. Nome e telefone têm espaços nas extremidades removidos; telefone ausente ou em branco vira `null`. Na edição, telefone omitido preserva o valor; `null` remove. Não se impõe limite de nome ou formato internacional sem aprovação. Telefone não comprova identidade e não é único.
- Desativação preserva o cadastro e suas referências históricas; solicita retirada das atribuições futuras com auditoria das retiradas. O contrato é obrigatório, mas não há tarefas ou adaptador implementado.
- Reativação restaura o estado ativo, que é uma condição de elegibilidade, sem restaurar atribuições ou reautorizar dispositivos explicitamente revogados. Não há integração com dispositivos nesta entrega.
- A congregação não pode perder seu último administrador ativo por desativação ou alteração de papel. Administradores inativos ou de outras congregações não contam.
- Cadastro comum exige administrador existente. O primeiro administrador dependerá de procedimento inicial seguro e controlado pelo responsável técnico, ainda não implementado.
- Operações sem mudança efetiva são idempotentes, sem nova gravação, retirada ou evento de mudança.

### Critérios de aceite locais

Validação de dados inválidos; preservação de identidade; autorização baseada no cadastro atual do ator; consulta sem vazamento de telefone; mudanças de papel/situação; proteção do último administrador; solicitação de retirada de atribuições; auditoria de mudanças sem valores pessoais; propagação de falhas e rollback exercitado em adaptador exclusivo de testes.

### Integrações ainda pendentes

Servidor deve resolver a identidade do ator a partir de sessão válida; nunca aceitar o `MemberActor` do corpo da requisição como autenticação. Persistência deve garantir unicidade, isolamento de congregações e transações com serialização por congregação, incluindo leitura do ator, contagem de administradores, escrita, retirada de atribuições e auditoria. O futuro módulo de tarefas definirá exatamente o significado de atribuição futura usando o instante fornecido, preservará execuções passadas e auditará cada retirada. Chamadas externas de melhor esforço não cumprem o contrato atômico.

A listagem atual é um contrato local sem paginação; paginação, minimização de consultas e controle de edições obsoletas devem ser definidos antes de expor uma API. Política de retenção, formato do telefone, limites de tamanho e distribuição de nomes para participantes continuam pendentes. Ver ADR-002.
