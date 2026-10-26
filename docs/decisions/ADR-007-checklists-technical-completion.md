# ADR-007 — Checklists, problemas e conclusão técnica

- Status: adotado na entrega 05, base main `403adeb`.
- Referências: PRD MVP 1.0, ADR-001 a ADR-006 e instrução da Implementação 05.

## Decisões

Modelos são configurados por congregação/periodicidade, com versão e pares únicos de tarefa/categoria de equipamento. A chave do par não depende de texto, data, autor ou equipamento individual. Cada ocorrência ganha um snapshot do modelo aprovado; revisão posterior não modifica o existente. Somente administrador altera modelos; administrador/responsável vinculado acrescenta verificações ocasionais sem mudar o modelo. Inicialização técnica do checklist usa o modelo configurado no servidor, por solicitante autorizado a preencher, nunca conteúdo de modelo enviado por membro comum.

Não há catálogo oficial incluído: a matriz revisada em 30/05/2026 não foi localizada e conferida nesta execução. Dados sintéticos dos testes são exemplos de infraestrutura/regra, não procedimentos oficiais. Importação/transcrição validada continua pendente.

Resultados são unfilled/completed/problem_found/not_applicable. Ler não altera resultado. Não existem campos de executor, atribuição, reserva, presença ou métricas pessoais. Relógio/identificador são portas confiáveis; fotos são somente referências opacas futuras, sem armazenamento ou validação de mídia.

Problema encontrado exige descrição e cria registro técnico independente, vinculado à ocorrência e ao par. Repetição do comando não cria outro problema. Reaplicar um resultado sem problema ou reutilizar explicitamente o mesmo problema é no-op. Novo relato com outro comando cria outro problema, mesmo com descrição semelhante: não deduplicar problemas reais por texto; para reutilizar um problema já registrado, seu vínculo deve ser explícito e seus dados imutáveis devem coincidir. Resultado corrigido para concluído/não se aplica nunca elimina nem resolve os problemas anteriores. A resolução tem caso de uso próprio, sem responsável individual nem estado em andamento. Não há criação de problemas avulsos. O responsável confirmou nesta execução: somente administrador ativo ou responsável autorizado da manutenção pode concluir pendências. Resolução posterior à conclusão técnica é permitida como ciclo do problema, sem modificar ou reabrir a ocorrência; canceladas bloqueiam mutações conforme o limite aprovado.

A ocorrência passa explicitamente de scheduled para completed na conclusão autorizada. Completed e cancelled são terminais: sem remarcação, cancelamento de concluída, configuração, designação ou recriação por geração. Resumo informa resultados, verificações sem preenchimento e pendências abertas; ambos são permitidos na conclusão. Checklist selado guarda seu snapshot técnico. Conclusão, CAS dos agregados, atualização idempotente anual, eventos técnicos, recibo do comando e descarte de TODA a disponibilidade compartilham uma transação. A conclusão é um fato de manutenção, nunca presença.

Após conclusão, só administrador ativo corrige resultados, com natureza/data e estado anterior/posterior preservados, sem reabrir ocorrência nem repetir conclusão anual. Não se identifica o executor. Problemas independentes permanecem preservados. Comandos têm identidade opaca e recibo técnico sem ator: identidade não é credencial; autorização atual é revalidada antes de replays. Mesmo identificador com conteúdo diferente é conflito. Proteções de versões rejeitam alterações desatualizadas. Isso não implementa sincronização offline nem mesclagem avançada.

## Limitações

Persistência real, transações entre processos, conclusão/erasure em banco, backend/autenticação, offline, fotos, UI e notificações não foram implementados. Minimização de identificadores em ocorrências terminais, snapshots, eventos, projeções, logs/backups e restaurações permanece obrigatória antes da produção (ADR-006); dados operacionais ativos não são apagados. Texto livre técnico pode conter dados pessoais e exige orientação/minimização e autorização no backend futuro. Critério do ano em remarcações entre anos continua pendente; preservar agendas/fatos, sem painel anual.

## Contratos e alternativas

`ChecklistUseCases` coordena `ChecklistUnitOfWork`: membros atuais, ocorrência, modelos, checklist, problemas, recibos, histórico anual, retenção e eventos. O adaptador futuro deve compartilhar serialização/transação com membros, manutenções e disponibilidade e revalidar o estado da ocorrência até o commit. Apenas CAS do checklist não protege contra cancelamento ou retirada de membro concorrente. Unicidade de recibos e inserções, comparação/gravação por congregação/identidade/versão e rollback integral são obrigatórios no armazenamento.

A hora real da conclusão fica no snapshot selado e no recibo/fato anual gravados atomicamente; o estado da ocorrência representa o término sem inferir hora de leitura ou reagendamento. Manter estes fatos no mesmo commit evita fabricar timestamps em `refresh`. Ocorrência concluída sem marcador de retenção é erro de integração, nunca autorização para recriar disponibilidade.

Escolhemos problemas independentes, em vez de deduplicar por descrição ou apagar ao corrigir resultado, para preservar defeitos reais. Escolhemos snapshot imutável do modelo, em vez de vínculo dinâmico, para impedir mudanças retroativas. A versão do checklist é conservadora e pode causar conflitos entre verificações distintas; sincronização por operação e mesclagem avançada ficam para a entrega offline. Correções preservam conteúdo técnico antes/depois, sem autoria individual. A interface futura deverá explicitar reutilização de problema existente e confirmação da conclusão.

## Correção aprovada — início técnico e cancelamento

A auditoria demonstrou que cancelar após um problema registrado deixava uma pendência sem fluxo de resolução. A decisão do responsável é impedir o cancelamento após qualquer trabalho técnico, preservando as permissões anteriores. Não se acrescenta exceção de resolução em canceladas nem restauração. Interrupções após início seguem a conclusão existente, inclusive com itens não preenchidos e problemas abertos; concluir nunca resolve pendências automaticamente.

Cada checklist guarda `technicalWorkRecorded`, iniciado explicitamente em false e tornado true na primeira alteração para completed/problem_found/not_applicable, na mesma gravação CAS do resultado. O marcador nunca volta a false: limpar o resultado para unfilled preserva o fato. Criar/ler checklist, registrar unfilled sobre unfilled e acrescentar definições ocasionais não o ativam. Reidratação exige o campo e rejeita false contraditório com resultados/links de problemas; não há padrão silencioso para registros antigos. O armazenamento condicional deve rejeitar regressão true -> false, mesmo quando todos os resultados atuais estiverem vazios.

A porta obrigatória `technicalWork.hasRecordedWork` consulta o marcador e a existência de qualquer problema da mesma congregação/ocorrência, incluindo resolvidos, antes de cancelar. É um fato interno de servidor, nunca opção do cliente nem consulta assíncrona de melhor esforço. A unidade de trabalho deve compartilhar a mesma coordenação/serialização com resultados, problemas, membros e manutenção durante toda a transação, inclusive para linhas ainda ausentes. Apenas leitura seguida de CAS em agregados separados não protege a corrida; exigir bloqueio comum ou serialização equivalente no adaptador real. Rejeições e falhas revertem todos os efeitos.

Escolhemos um fato técnico irreversível no checklist em vez de inferir início pela situação atual, acrescentar um botão de início ou identificar executores. CAS de cada resultado persiste o fato; a coordenação comum protege a decisão entre agregados. Registros legados sem histórico confiável devem bloquear cancelamento até migração explícita: não inicializar false com base em checklist atualmente vazio. Nenhuma migração real, banco, interface, presença, atribuição ou sincronização foi implementada. Cancelamentos legados com problemas exigirão tratamento próprio aprovado, sem alteração automática nesta entrega.

Testes cobrem cancelamento sem checklist/vazio, resultados das três classes, retorno a unfilled e reidratação, problemas persistidos/resolvidos, duas ordens da corrida, rollback, falhas da consulta/CAS/histórico/eventos/retenção, isolamento, permissões e conclusão parcial com problemas preservados. Prova transacional de produção e minimização pessoal em ocorrências terminais continuam pendentes obrigatórias.

## Evolução pela entrega 06 — ADR-008

A ausência de catálogo acima descreve a entrega 05. A entrega 06 incorpora a transcrição fornecida pelo responsável, revisão de 2026, sem alegar conferência da fotografia original. A configuração versionada de áudio usa os mesmos modelos, pares e snapshots. O provisionamento inicial explícito de administrador cria somente modelos ausentes e preserva todos os existentes; revisões posteriores seguem o caso de uso administrativo com versão esperada. Não acumular frequências ou atualizar checklists materializados. Ver ADR-008 e a matriz documentada.
