# Deploy com Portainer e Traefik

Dominio oficial: `prospects.azurratech.com.br`.

## Pre-requisitos

- Portainer conectado ao Docker Swarm.
- Traefik na rede externa `network_public`.
- Certresolver `letsencryptresolver` configurado.
- Imagem publicada em `ghcr.io/gigiocalzavara/azurra-prospects`.

## Implantacao

1. Crie uma stack no Portainer a partir de `stack.portainer.yml`.
2. Cadastre as variaveis do `.env.production.example` no ambiente da stack; nunca cole valores secretos no GitHub.
3. Mantenha `CLOCK_ENGINE_MODE=shadow` no primeiro deploy.
4. Publique a stack e aguarde o healthcheck.
5. Teste `https://prospects.azurratech.com.br/api/system/health`.
6. `clock-engine` e `worker` comecam com zero replicas. Eles so devem ser escalados depois que seus executores forem implementados e validados em shadow mode.

## Rollback

A atualizacao do servico web usa `start-first` e `failure_action: rollback`. Preserve a tag anterior da imagem para rollback manual dos workers, se necessario.
