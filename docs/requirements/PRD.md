# PRD — Manutenção Salão

## Objetivo e estágio

Organizar manutenções preventivas e corretivas dos equipamentos de Áudio e Vídeo de uma congregação. Este estágio entrega somente infraestrutura, documentação e ferramentas de qualidade.

## Requisitos confirmados e rastreabilidade

O briefing forneceu os temas, mas não o texto original individual dos RF-01 a RF-24. A numeração abaixo é uma decomposição proposta desses temas para rastreabilidade; deve ser validada com o responsável antes da implementação. Não implica aprovação de detalhes ausentes. Todos os requisitos estão **documentados, não implementados**.

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
- Definir identificação de conta, provisionamento, recuperação sem e-mail, aprovadores e papéis/permissões.
- Definir duração, entrega, limitação de tentativas e procedimento de revogação dos tokens e sessões.
- Obter uma exportação real e anonimizada do Hourglass: formato, campos, encoding, timezone, identificação de pessoas, duplicatas e versões ainda desconhecidos. Não assumir CSV, JSON ou API disponível.
- Definir fim de semana em fronteiras de mês, horário/fuso da congregação, feriados, exceções, conflitos e efeitos do reagendamento nas próximas ocorrências.
- Definir quem pode convidar, limites de participação e efeitos de cancelamento.
- Definir canais e horários de notificação, consentimento e política de tentativas.
- Definir documentos autorizados, controle de revisão e responsáveis por aprovação.
- Definir catálogo de equipamentos, retenção, auditoria, necessidade de offline e sincronização.

## Fora do escopo deste estágio

Implementar autenticação, backend, calendário, importação, notificações, modelos de negócio, telas funcionais ou migrações. Protótipos visuais e integrações exigem nova autorização.
