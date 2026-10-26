# Domain

Entidades, invariantes e contratos em TypeScript puro, sem React, Expo, bibliotecas de validação ou persistência. `members/` contém a entidade imutável Member, erros e contrato de armazenamento sem exclusão. A regra que envolve vários membros (último administrador) é coordenada pela aplicação dentro da unidade de trabalho. Ver ADR-002.

`maintenance/` contém calendário civil, configuração, regra recorrente e ocorrência imutáveis, erros e portas de repositório. Recorrência não é ocorrência: uma remarcação preserva origem/identidade e não altera as outras. Ver ADR-005 para fins de semana, meses, participação, cancelamento e limites de geração.
