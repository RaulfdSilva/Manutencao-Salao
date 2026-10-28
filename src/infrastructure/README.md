# Infrastructure

Futuros adaptadores de persistência, notificações e integrações implementarão os contratos internos. Validar entradas externas com Zod na fronteira e mapear erros explicitamente. O backend definitivo permanece em aberto no PRD oficial do MVP 1.0; Supabase/PostgreSQL é somente uma alternativa histórica. Não há cliente, migrações, conexão ou credenciais obrigatórias neste estágio.

Persistência local, fila de sincronização por operação, fotos offline e agendamento no servidor são necessidades do MVP ainda sem adaptadores ou tecnologias escolhidas. Não implementar nesta consolidação documental. Ver ARCHITECTURE, SECURITY e ADR-003.

`catalogs/` contém a configuração JSON de áudio, validação Zod e conversão para o contrato interno de provisionamento. Carregamento é puro: não escreve dados nem chama casos de uso. Não há adaptador de banco. A fonte é a transcrição de 2026 fornecida pelo responsável; ver ADR-008 e a matriz documentada.
