# Manual de uso

## Acesso

1. Acesse `/login` e informe o e-mail convidado e sua senha.
2. Superadmins sao direcionados para `/admin`.
3. Use **Sair** para encerrar a sessao no navegador.

Se o convite inicial nao tiver permitido criar uma senha, use **Esqueci minha senha** na tela de login. Informe o e-mail cadastrado, abra o link recebido e defina uma senha com pelo menos 8 caracteres. Links expirados devem ser solicitados novamente.

O link pode ser solicitado em um dispositivo e aberto em outro. Os links novos passam pelo callback seguro do sistema, que reconhece tanto o formato atual do Supabase quanto links legados. Depois de uma atualizacao do fluxo de autenticacao, links emitidos anteriormente podem deixar de ser validos e devem ser solicitados novamente.

Se o Supabase recusar o envio, a tela informa um codigo de diagnostico. `over_email_send_rate_limit` indica bloqueio temporario por excesso de tentativas; `unexpected_failure` indica configuracao incompleta do servico de e-mail.

## Criar uma organização como superadmin

1. Abra **Organizações** em `/admin`.
2. Informe o nome comercial.
3. Informe um identificador em letras minusculas, numeros e hifens, como `empresa-exemplo`.
4. Clique em **Criar organização**.

A nova organização e criada isoladamente e o superadmin que realizou a operacao se torna seu owner inicial. Identificadores nao podem ser repetidos.

Para entrar em uma conta, clique no cartao da organizacao. O ambiente aberto mostra o resumo de creditos, pesquisas e membros, alem dos modulos planejados. Use **Organizações** no topo para retornar a administracao global.

## Estado atual

O produto esta em fundacao tecnica. Autenticacao e administracao inicial de organizacoes estao disponiveis, mas nenhuma coleta real esta habilitada.

## Fluxo planejado para Instagram

1. Criar uma pesquisa com criterios permitidos.
2. Revisar a estimativa de creditos.
3. Executar a pesquisa.
4. Avaliar os perfis e sinais publicos encontrados.
5. Selecionar prospects para envio ao Azurra Leads.
6. Consultar origem, regra aplicada e historico de creditos.

Abra a organizacao, clique em **Instagram**, informe nicho, localizacao, faixa de seguidores, tipo de perfil e quantidade desejada. O limite atual e de 250 perfis por pesquisa. O sistema mostra a estimativa maxima e registra os criterios antes de qualquer consumo.

O painel **Pesquisas recentes** e o historico da organizacao. Clique em **Ver detalhes** para consultar data, localizacao, faixa de seguidores, tipo de perfil, quantidade solicitada, estado da pesquisa e creditos consumidos. Os estados tecnicos sao apresentados em linguagem simples, sem expor fornecedores ou componentes internos.

Uma pesquisa com status **Aguardando execucao** pode ser aberta e validada pelo botao **Simular execucao**. A simulacao valida a regra operacional, cria o plano de processamento e conclui o trabalho sem consultar fontes externas. O historico confirma que zero credito foi consumido.

Para realizar a coleta, abra a pesquisa e clique em **Executar pesquisa**. Antes de iniciar, o sistema confirma o limite maximo: um credito por perfil qualificado encontrado. A execucao respeita a quantidade solicitada, filtra a faixa de seguidores e o tipo de perfil, grava apenas dados publicamente visiveis e cobra somente os resultados qualificados efetivamente salvos.

Quando a pesquisa terminar, o proprio cartao exibe **Perfis encontrados** com nome, usuario, biografia, seguidores, categoria, localizacao e contatos publicos quando disponiveis. Use **Abrir Instagram** para consultar o perfil original. Uma simulacao aparece como **Simulacao concluida** e nao deve ser confundida com uma pesquisa real.

No topo do modulo, **Motor de busca conectado** confirma que a infraestrutura de pesquisa esta disponivel. O sistema nunca exibe ao cliente o nome de fornecedores externos. Esse indicador nao significa que uma coleta foi iniciada: somente a confirmacao do botao **Executar pesquisa** inicia uma operacao real.

## Perfis privados

O sistema nao contorna privacidade nem acessa conteudo restrito. Um perfil privado pode ser registrado apenas com os metadados publicamente visiveis e nao deve ser tratado como fonte de conteudo privado.

## Transparencia e LGPD

Cada organizacao podera publicar uma pagina de transparencia e usar seu link no primeiro contato. O sistema devera registrar fonte, finalidade, base operacional, retencao e solicitacoes do titular. A decisao juridica final e responsabilidade do controlador dos dados.

## Creditos

Creditos sao consumidos por operacoes claramente precificadas. Reservas, consumo, liberacoes e estornos aparecem como lancamentos separados, permitindo auditoria do saldo.
