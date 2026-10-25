# ADR-003 — Consolidação do PRD oficial do MVP 1.0

- **Status:** adotado para documentação e orientação das próximas entregas; sem mudança de código.
- **Referência de produto:** PRD fornecido pelo responsável, datado de 24 de outubro de 2026.
- **Base da implementação inspecionada:** `1c7412f`, entrega 01 do domínio de membros.
- **Relação:** complementa ADR-001 e substitui parcialmente a política de consulta/listagem da decisão 4 do ADR-002. A escolha definitiva do backend permanece pendente.

## Contexto

O PRD inicial era uma decomposição proposta de temas em RF-01 a RF-24 e ainda deixava offline e várias regras de produto em aberto. A entrega 01 adotou uma política conservadora: somente administradores listavam membros, e os demais consultavam apenas a si mesmos.

O responsável forneceu o PRD do MVP 1.0 e autorizou sua consolidação oficial com ajustes de documentação, sem alterar código. Ele limita o público a uma congregação e a área a áudio, exige offline desde a primeira versão, detalha permissões, calendário, participação, checklists, pendências e notificações e exclui controle de presença ou avaliação individual.

## Decisões

1. `docs/requirements/PRD.md` é a fonte oficial. Preservar as 14 seções fornecidas, com mudanças somente de formatação e notas de conciliação identificadas. O documento anterior fica em `docs/requirements/archive/PRD-pre-MVP-1.0.md`, marcado como histórico. Não renumerar os antigos RFs como se tivessem equivalência aprovada com os novos requisitos.
2. Separar requisitos, implementação e testes. O produto exige consulta da equipe ativa pelos membros autorizados, sem telefone ou inativos para não administradores. Os casos `get`/`list` e testes de `1c7412f` continuam mais restritos; a adequação precisa de entrega funcional específica. Escritas administrativas, primeiro provisionamento seguro, proteção do último administrador e dispositivos revogados preservam as decisões anteriores não conflitantes.
3. Manter o texto histórico dos ADRs, indicando a substituição parcial. Não reescrever a decisão 4 do ADR-002 para aparentar que o código já implementa a política nova. Arquitetura, README, orientações de agentes e segurança devem apontar para este contexto.
4. Backend definitivo em aberto. Supabase/PostgreSQL é alternativa histórica, não compromisso de arquitetura. Manter os arquivos de configuração existentes intactos nesta tarefa; a presença de nomes Supabase em `.env.example` não exige valores ou integração. Avaliar a tecnologia em ADR próprio, considerando sincronização, autorização, transações, fotos, operação e notificações no servidor.
5. Offline é obrigatório no MVP. Orientar contratos desde o domínio para operações individuais, idempotência, preservação independente de problemas, conflitos explícitos e autorização revalidada ao sincronizar. Não escolher biblioteca local, protocolo ou estratégia de resolução final nesta documentação. Uma cópia inteira do checklist sobrescrita por outro celular não atende ao PRD.
6. Disponibilidade, designações, edição técnica e auditoria não são controle de presença. Não gerar frequência, rankings, avaliações individuais ou produtividade de reparadores. Preservar registros técnicos sem ampliar a finalidade de tratamento de dados.
7. Recorrência quinzenal continua vinculada ao Hourglass, com formato real pendente. A regra anterior de primeiro/terceiro fim de semana não aparece explicitamente no texto novo: sua permanência requer conciliação antes do cálculo, sem assumir revogação ou aprovação automática.
8. O escopo de uma congregação não exige remover `congregationId` de contratos existentes nem autoriza suporte completo a várias congregações. Não implementar novas telas, tema, casos de uso ou infraestrutura durante esta consolidação.

## Alternativas e consequências

Manter dois PRDs simultaneamente vigentes criaria conflitos de permissão e escopo. Sobrescrever o anterior sem arquivo histórico reduziria rastreabilidade dos RFs propostos. Adotamos uma fonte oficial e um arquivo histórico explicitamente marcado.

Modificar a consulta de membros junto da documentação resolveria uma divergência, mas extrapolaria o pedido de não alterar código. Registramos a diferença como pendência verificável, com uma futura entrega que deverá atualizar casos de uso e testes sem expor telefone ou inativos.

Escolher Supabase ou uma biblioteca offline agora anteciparia decisões técnicas que o responsável manteve abertas. A arquitetura conserva portas e requisitos de qualidade, enquanto a implementação dos adaptadores aguarda avaliação própria.

## Pendências e validação

Continuam as seis validações da seção 13 do PRD: fonte legível do checklist, Hourglass, backend/autenticação, conclusão de pendências, fotos offline e conflitos/encerramento colaborativo. Somam-se a conciliação da regra quinzenal anterior e a adequação funcional da consulta da equipe. Não inventar procedimentos oficiais.

A validação desta entrega é documental: revisar cobertura das 14 seções, consistência entre documentos, links, formatação e ausência de alterações fora de Markdown. Verificações existentes podem ser executadas como regressão, sem provar offline, backend ou os novos comportamentos. O estado dos commits, branches e PR deve ser reportado separadamente da aprovação de requisitos e da publicação do ambiente.
