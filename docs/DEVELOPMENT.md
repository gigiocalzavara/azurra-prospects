# Desenvolvimento e arquitetura

## Limites do sistema

Azurra Prospects e Azurra Leads sao sistemas independentes. O Prospects descobre e qualifica oportunidades; o Leads recebe apenas registros explicitamente enviados por uma integracao autenticada e idempotente.

## Componentes

- `app`: painel, API e healthcheck.
- `clock-engine`: seleciona tarefas vencidas e registra a decisao de execucao.
- `worker`: processa tarefas autorizadas pelo Rule Registry.
- `rule_registry`: regras imutaveis por versao, com estados draft, shadow, active e retired.
- `credit_ledger`: lancamentos append-only; nao existe atualizacao direta de saldo.
- `audit_events`: trilha de decisoes e operacoes relevantes.
- `platform_admins`: concessoes globais de superadmin, separadas dos papeis de cada organizacao.

## Administracao global

Superadmins usam `/admin`. A interface chama somente funcoes RPC `security definer` que validam `auth.uid()` em `platform_admins`. O cliente nunca recebe a service role. Ao criar uma organizacao, a operacao tambem inclui o superadmin como `owner` e grava um evento de auditoria.

Os cartoes da listagem global abrem `/organizations/[slug]`, que representa o ambiente isolado da organizacao. O painel consulta organizacao, membros, pesquisas e livro-razao diretamente pelo cliente autenticado, sempre sujeito as politicas RLS. A area global de superadmin permanece separada do contexto operacional de cada conta.

O carregamento inicial da area administrativa e agendado fora do corpo sincrono do efeito React, evitando atualizacoes em cascata e mantendo compatibilidade com as regras do React 19.

## Shadow mode

`CLOCK_ENGINE_MODE=shadow` e o padrao. Nesse modo, o motor calcula o que faria, registra a decisao e nao realiza coleta externa, consumo definitivo de credito ou envio ao Leads. A mudanca para `active` exige validacao operacional e regra ativa correspondente.

Na fundacao inicial, os servicos de Clock Engine e worker ficam desativados no Portainer (`replicas: 0`). A imagem e as variaveis ja estao separadas, mas eles nao devem ser escalados antes da implementacao dos respectivos executores.

## Pesquisa Instagram

O modulo `/organizations/[slug]/instagram` registra pesquisas por nicho, localizacao, faixa de seguidores, limite e escopo de perfil. A RPC `create_instagram_prospect_job` valida a participacao na organizacao, grava um `prospect_job` com a regra `instagram-public-prospecting` versao 1 e produz evento de auditoria. Toda pesquisa nasce com `shadow_mode=true`; a estimativa e de um credito por resultado solicitado, mas nenhum lancamento e criado no livro-razao enquanto nao houver execucao ativa.

O escopo `public_metadata` permite apenas metadados visiveis publicamente em perfis privados. A regra proibe acesso a conteudo privado, contorno de autenticacao ou qualquer tecnica destinada a superar restricoes do Instagram.

A migration `20260822000200_instagram_shadow_executor.sql` adiciona `prospect_jobs.output`, a tabela normalizada `prospect_results` e a RPC `run_instagram_shadow_job`. O executor shadow bloqueia trabalhos de outro canal ou modo, exige status `queued`, valida a versao da regra e grava o plano completo em `output`. A execucao termina como `completed`, produz auditoria e mantem `credit_effect=0`. O provedor fica identificado como `adapter_pending` ate a escolha e configuracao de uma fonte externa autorizada.

## Adaptador externo de pesquisa

As credenciais e identificadores do adaptador existem somente no servidor e nunca recebem prefixo `NEXT_PUBLIC_`. O endpoint publico `/api/system/integrations/search-engine` retorna exclusivamente `configured`, `connected` e um codigo generico de erro. Nomes de fornecedores, credenciais, contas e identificadores de executores nao podem fazer parte de respostas publicas nem da interface.

O modulo exibe apenas **Motor de busca conectado/indisponivel**, enquanto o executor shadow continua impedindo execucoes pagas. A ativacao real exige um adaptador autorizado, reserva de creditos e promocao explicita da regra no Rule Registry.

O historico e carregado de `prospect_jobs` e cada cartao pode ser expandido para exibir criterios e resumo da execucao. Campos internos como `provider`, nomes de adapters e o modo tecnico de execucao nunca devem ser renderizados para usuarios finais.

## Execucao ativa do Instagram

O endpoint autenticado `POST /api/instagram/jobs/execute` recebe apenas o `jobId` e exige o access token do usuario. O servidor valida usuario, organizacao e papel (`owner`, `admin` ou `operator`) antes de chamar o adaptador. A interface pede confirmacao imediata, informa o teto de creditos e nunca envia credenciais do provedor ao navegador.

A execucao e assincrona para nao depender dos limites de timeout do proxy. O endpoint de execucao inicia o run, persiste identificadores internos no `output` e responde `202`. A interface consulta `POST /api/instagram/jobs/status` em intervalos de cinco segundos. Quando o run termina, esse endpoint recupera o dataset, normaliza, liquida os creditos e conclui o job. Identificadores externos nunca sao devolvidos ao navegador.

O adaptador executa pesquisa de usuarios com limite maximo de 250 itens, `maxItems` e teto monetario por run. Enriquecimento adicional fica desabilitado por padrao. A normalizacao aplica escopo publico, faixa de seguidores e minimizacao de dados antes de persistir em `prospect_results`. Apenas nome, usuario, URLs publicas, biografia, metricas, categoria, localizacao e contatos explicitamente publicos podem ser gravados.

Cada perfil qualificado salvo consome um credito por meio de `credit_ledger`, usando chave idempotente por job. Falhas anteriores a liquidacao deixam `credit_effect=0`; se a liquidacao falhar depois da insercao, os resultados inseridos sao removidos de forma compensatoria. O job guarda somente contagens e estado generico no `output`, sem identificar fornecedor.

## Banco e seguranca

O projeto Supabase e `laayrkwqvdwucwaipnma`. As migrations ficam em `supabase/migrations`. RLS fica habilitado desde a primeira migration e o acesso e limitado pela organizacao do usuario. A `service_role` existe apenas no servidor e nunca pode usar prefixo `NEXT_PUBLIC_`.

O cliente do navegador usa fluxo `implicit` com deteccao de sessao na URL. Isso permite solicitar a recuperacao em um dispositivo e abrir o link em outro, sem depender de um verifier armazenado localmente. `/forgot-password` solicita o e-mail com redirecionamento para `/auth/callback?next=/reset-password`. O callback registra o observador de autenticacao antes de validar a sessao e aceita tanto o evento `PASSWORD_RECOVERY` no fragmento da URL quanto links legados com `code`. A pagina inicial mantem o redirecionador como compatibilidade para links emitidos antes dessa mudanca.

Falhas de recuperacao sao traduzidas por `error.code` para mensagens operacionais, mantendo o codigo visivel para suporte sem expor payloads, chaves ou detalhes internos.

## Convencoes de API

- Base: `/api/v1`.
- JSON como formato padrao.
- Operacoes mutaveis devem aceitar chave de idempotencia.
- Erros devem incluir codigo estavel, mensagem e `requestId`.
- Integracao Leads sera autenticada servidor a servidor.

## Definicao de pronto

Uma mudanca so esta pronta quando possui validacao automatizada aplicavel e atualiza tanto a documentacao tecnica quanto a documentacao de uso, quando houver impacto para o usuario.

O workflow `.github/workflows/ci.yml` executa lint, typecheck e build em pushes e pull requests direcionados a `main`. Enquanto o primeiro lockfile ainda nao foi gerado, a instalacao usa `npm install` sem cache. Os valores usados no build sao placeholders e nao concedem acesso ao Supabase.

O workflow `.github/workflows/publish-image.yml` constroi a imagem de producao e publica as tags `latest` e `sha-*` no GitHub Container Registry. O Portainer consome `latest`; a tag de commit permite rollback deterministico.

As configuracoes publicas do Supabase sao injetadas como build args porque variaveis `NEXT_PUBLIC_*` sao incorporadas ao bundle do navegador pelo Next.js. A URL usa GitHub Actions Variable e a chave publicavel usa GitHub Actions Secret. Nenhuma service role participa do build.
