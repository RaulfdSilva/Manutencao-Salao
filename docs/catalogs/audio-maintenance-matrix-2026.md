# Catálogo inicial de manutenção de áudio — revisão 2026

Fonte: transcrição de trabalho fornecida pelo responsável no pedido “Implementação 06 — Catálogo oficial de manutenção de áudio”. O responsável confirmou que o ano correto da revisão é 2026. A referência já registrada no PRD/ADR-007 é **30/05/2026**. A fotografia original não estava anexada nesta execução e não foi conferida visualmente; não confundir testes de fidelidade à lista com conferência da imagem.

O arquivo de configuração é [audio-maintenance-2026.json](../../src/infrastructure/catalogs/audio-maintenance-2026.json), schema 1, catálogo `audio-maintenance-matrix`, versão 1, área `audio`. A revisão da matriz, a versão do catálogo e a versão de cada modelo administrativo são conceitos distintos. Não foram acrescentados procedimentos ou associações além da transcrição.

## Categorias de equipamento

| ID estável       | Nome exibido     |
| ---------------- | ---------------- |
| microphones      | Microfones       |
| cd-dvd-player    | CD/DVD Player    |
| mixing-console   | Mesa de som      |
| equalizers       | Equalizadores    |
| amplifiers       | Amplificadores   |
| loudspeakers     | Alto-falantes    |
| speaker-cabinets | Caixas acústicas |
| audio-cables     | Cabos de áudio   |
| power-cables     | Cabos de força   |

Alto-falantes e caixas acústicas permanecem categorias distintas, conforme a lista recebida; não inferir inventário, modelos de equipamentos ou procedimentos de reparo.

## Matriz transcrita

Cada associação abaixo gera uma verificação independente. IDs de tarefa usam o prefixo `audio-` e o código em minúsculas (por exemplo, Q01 é `audio-q01`); alterar uma descrição não altera o ID. Não reutilizar IDs para outra tarefa/categoria em futuras revisões.

| Periodicidade | Código | Tarefa                                    | Categorias associadas                                                                                                                  |
| ------------- | ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Quinzenal     | Q01    | Verificação dos cabos de microfone        | Microfones; Cabos de áudio                                                                                                             |
| Quinzenal     | Q02    | Verificação de pilhas ou baterias         | Microfones                                                                                                                             |
| Quinzenal     | Q03    | Verificação das marcações e ajustes       | Mesa de som; Equalizadores; Amplificadores                                                                                             |
| Mensal        | M01    | Teste de reprodução                       | CD/DVD Player                                                                                                                          |
| Mensal        | M02    | Verificação das luzes piloto              | CD/DVD Player; Mesa de som; Equalizadores; Amplificadores                                                                              |
| Mensal        | M03    | Limpeza geral                             | Microfones; CD/DVD Player; Mesa de som; Equalizadores; Amplificadores; Cabos de áudio; Cabos de força                                  |
| Mensal        | M04    | Teste das entradas (line, mic, aux, etc.) | Mesa de som; Equalizadores; Amplificadores                                                                                             |
| Trimestral    | T01    | Verificação do estado do cordão de força  | CD/DVD Player; Mesa de som; Equalizadores; Amplificadores                                                                              |
| Trimestral    | T02    | Inspeção e limpeza dos potenciômetros     | Mesa de som; Equalizadores; Amplificadores                                                                                             |
| Trimestral    | T03    | Verificação dos cabos dos equipamentos    | Mesa de som; Equalizadores; Amplificadores                                                                                             |
| Trimestral    | T04    | Inspeção visual de soldas/conexões        | Cabos de áudio; Cabos de força                                                                                                         |
| Semestral     | S01    | Inspeção visual dos sonofletores          | Alto-falantes; Caixas acústicas                                                                                                        |
| Semestral     | S02    | Inspeção visual de conexões e cones       | Alto-falantes; Caixas acústicas                                                                                                        |
| Semestral     | S03    | Teste geral do sistema                    | Microfones; CD/DVD Player; Mesa de som; Equalizadores; Amplificadores; Alto-falantes; Caixas acústicas; Cabos de áudio; Cabos de força |
| Semestral     | S04    | Verificação dos fusíveis reservas         | CD/DVD Player; Mesa de som; Equalizadores; Amplificadores                                                                              |

Totais: **15 tarefas, 9 categorias, 50 verificações**. Distribuição: quinzenal 6; mensal 15; trimestral 12; semestral 17. A tarefa S03 tem as nove associações explícitas, sem curinga que acrescente futuras categorias silenciosamente.

As periodicidades são independentes, como os modelos existentes: o modelo semestral contém somente S01–S04. Não foi implementada acumulação automática de tarefas quinzenais/mensais/trimestrais numa ocorrência semestral. Se a prática oficial exigir outra composição, validar com o responsável antes de alterar.

## Provisionamento explícito, seguro e idempotente

1. Uma futura composição confiável de servidor carrega e valida o JSON com `loadAudioMaintenanceCatalog()` e converte com `toInitialChecklistCatalog()`.
2. A identidade autenticada é resolvida no servidor; `MemberActor` não constitui autenticação. Somente administrador atualmente ativo pode chamar `ChecklistUseCases.provisionInitialCatalog(actor, catalog, commandId)`.
3. Usar um ID opaco estável para o comando inicial, por exemplo `provision-audio-matrix-2026-v1`, com escopo da congregação. Não colocar nomes ou tokens nesse ID.
4. O caso de uso cria apenas modelos ausentes e devolve `created`/`preserved` e versões por periodicidade. Qualquer modelo existente, mesmo vazio ou personalizado na versão 1, é preservado integralmente.
5. Modelos, evento técnico mínimo e recibo pertencem à mesma transação. Recusa de inserção única, falha do evento ou do recibo provoca rollback integral. O servidor deve serializar também com edição administrativa.
6. Repetir o mesmo comando retorna o recibo histórico sem repetir efeitos; ele não é uma consulta da versão atual. Outro ID de comando também preserva todos os modelos existentes. Reutilizar o ID com conteúdo diferente gera conflito.
7. Revisões posteriores usam `saveTemplate` com expectedVersion e aprovação administrativa. Atualizar o JSON ou repetir o provisionamento não atualiza modelos já instalados nem checklists materializados. Não existe atualização automática do catálogo instalado.

Exemplo de composição futura (não é um script executável de persistência):

```ts
const catalog = toInitialChecklistCatalog(loadAudioMaintenanceCatalog());
const receipt = await checklistUseCases.provisionInitialCatalog(
  authenticatedActor,
  catalog,
  'provision-audio-matrix-2026-v1',
);
```

`authenticatedActor` e `checklistUseCases` deverão vir do servidor e dos adaptadores reais. Esta entrega não fornece autenticação, conexão, comando de seed, dados persistidos em produção nem execução automática. O provisionamento só foi exercitado com o adaptador de testes.

## Revisões e pendências

A configuração identifica a área para futura evolução, mas o armazenamento atual continua usando congregação/periodicidade. Apenas áudio é suportado; outra área exige decisão sobre identidade dos modelos e migração. Não reaproveitar os mesmos modelos para áreas diferentes.

Permanecem pendentes conferência visual da fotografia, backend/autorização e transações reais, interface, fotos, sincronização offline e minimização dos identificadores de ocorrências terminais. Os testes não validam a execução ou a segurança dos procedimentos técnicos em equipamentos.
