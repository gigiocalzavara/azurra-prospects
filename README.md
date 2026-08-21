# Azurra Prospects

Sistema independente de prospeccao da Azurra Tech, integrado ao Azurra Leads por API. O primeiro canal sera Instagram, limitado a informacoes publicas e operando inicialmente em `shadow mode`.

## Arquitetura inicial

- Next.js/TypeScript para painel e API.
- Supabase/Postgres para autenticacao, dados, RLS e migrations.
- Rule Registry versionado para regras operacionais e de conformidade.
- Clock Engine e workers separados da aplicacao web.
- Livro-razao de creditos append-only e idempotente.
- Superadmin global com interface para gestao de organizacoes.
- Docker, Portainer e Traefik para producao.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e preencha somente no ambiente local.
2. Execute `npm install`.
3. Execute `npm run dev`.
4. Acesse `http://localhost:3000`.

Nunca envie chaves do Supabase, tokens do Azurra Leads ou `.env` ao GitHub.

## Documentacao

- [Arquitetura e desenvolvimento](docs/DEVELOPMENT.md)
- [Manual de uso](docs/USER-GUIDE.md)
- [Deploy no Portainer](docs/DEPLOY-PORTAINER.md)
- [Politica de documentacao](docs/DOCUMENTATION-POLICY.md)
