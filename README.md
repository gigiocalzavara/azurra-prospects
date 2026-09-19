# Azurra Viral

MVP do radar de inteligência de conteúdo da Azurra.

## Incluído
- Supabase Auth e workspace automático
- Radar Viral
- Monitoramento de perfis
- Biblioteca
- IA de conteúdo opcional
- RLS no banco
- Docker/Portainer/Traefik

## Deploy
Use `stack.portainer.yml`.
A imagem continua em `ghcr.io/gigiocalzavara/azurra-prospects:latest` para preservar o fluxo de deploy existente.
Domínio atual: `https://prospects.azurratech.com.br`.

A variável `OPENAI_API_KEY` é opcional. Sem ela, apenas a aba de IA fica indisponível.
