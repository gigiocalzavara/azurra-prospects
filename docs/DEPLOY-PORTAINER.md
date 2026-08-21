# Deploy com Portainer e Traefik

Dominio oficial: `prospects.azurratech.com.br`.

## Pre-requisitos

- Portainer conectado ao Docker Swarm.
- Traefik na rede externa `network_public`.
- Certresolver `letsencryptresolver` configurado.
- Imagem publicada automaticamente em `ghcr.io/gigiocalzavara/azurra-prospects` pelo workflow `publish-image.yml`.

## Implantacao

1. Crie uma stack no Portainer a partir de `stack.portainer.yml`.
2. Cadastre as variaveis do `.env.production.example` no ambiente da stack; nunca cole valores secretos no GitHub.
3. Mantenha `CLOCK_ENGINE_MODE=shadow` no primeiro deploy.
4. Publique a stack e aguarde o healthcheck.
5. Teste `https://prospects.azurratech.com.br/api/system/health`.
6. `clock-engine` e `worker` comecam com zero replicas. Eles so devem ser escalados depois que seus executores forem implementados e validados em shadow mode.

## Acesso ao GHCR

Se o pacote estiver privado, cadastre `ghcr.io` em **Registries** no Portainer usando o usuario GitHub e um token com permissao `read:packages`. Nao coloque esse token no arquivo da stack. Como alternativa, torne o pacote publico depois da primeira publicacao.

## Variaveis obrigatorias da stack

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `CLOCK_ENGINE_MODE=shadow`
- `TRAEFIK_NETWORK=network_public`
- `AZURRA_PROSPECTS_IMAGE=ghcr.io/gigiocalzavara/azurra-prospects:latest`

As variaveis `AZURRA_LEADS_API_URL` e `AZURRA_LEADS_API_TOKEN` podem ficar vazias ate a integracao entre os produtos ser habilitada.

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` tambem sao fornecidas ao build no GitHub Actions. Alteracoes nesses valores exigem uma nova publicacao da imagem; defini-las apenas no runtime nao altera o bundle do frontend.

## Rollback

A atualizacao do servico web usa `start-first` e `failure_action: rollback`. Preserve a tag anterior da imagem para rollback manual dos workers, se necessario.
