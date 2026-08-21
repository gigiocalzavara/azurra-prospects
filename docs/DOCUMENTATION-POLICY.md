# Politica de atualizacao da documentacao

Toda alteracao funcional deve atualizar a documentacao no mesmo pull request.

## Obrigatorio por tipo de mudanca

- Arquitetura, banco, API, seguranca ou deploy: atualizar `docs/DEVELOPMENT.md` ou o documento tecnico correspondente.
- Tela, fluxo, permissao ou comportamento percebido: atualizar `docs/USER-GUIDE.md`.
- Variavel de ambiente ou infraestrutura: atualizar `.env.example`, `.env.production.example` e `docs/DEPLOY-PORTAINER.md`.
- Decisao relevante: registrar contexto e consequencias em um ADR futuro dentro de `docs/adr`.

O checklist de pull request devera bloquear a conclusao quando o autor marcar impacto documental sem fornecer a atualizacao correspondente.
