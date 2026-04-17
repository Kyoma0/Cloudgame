Cloudflare Tunnel para Moonlight Web (Navegador)

- Objetivo: Expor o Moonlight Web Server (portas 8080) de forma segura para que um amigo possa acessar via internet.
- Requisitos: Conta Cloudflare, domínio (ou usar o domínio gratuito gerado pelo Cloudflare Tunnel), acesso ao host onde o Moonlight Web Server está rodando.
- Visão geral: o tunnel cria um URL público que aponta para http://localhost:8080, com potencial integração via Cloudflare Access para autenticação.

Pré-requisitos
- Conta Cloudflare e domínio configurado no painel da Cloudflare (opcional, pode usar o domínio gerado pelo tunnel).
- Ferramenta cloudflared instalada na máquina que hospeda o Moonlight Web Server.
- Moonlight Web Server já configurado e funcionando localmente em http://localhost:8080.

Passos básicos (Windows)
1) Instale cloudflared (baixar o executável e adicionar ao PATH).
2) Faça login no Cloudflare com cloudflared:
   cloudflared tunnel login
3) Crie o túnel:
   cloudflared tunnel create cloudgame
   # Isso criará credenciais em: C:\Users\<usuario>\.cloudflared\<tunnel-id>.json
4) Mapear hostname para o serviço local (8080):
   cloudflared tunnel route dns cloudgame cloudgame.example.com
   # Se não tiver domínio, use uma configuração ingress com a URL cfargotunnel fornecida pelo Cloudflare.
5) Configure o arquivo de configuração (config.yaml) para o túnel:
   ---
   tunnel: cloudgame
   credentials-file: C:\Users\Hanak\.cloudflared\cloudgame.json
   ingress:
     - hostname: cloudgame.example.com
       service: http://localhost:8080
     - service: http_status:404
   ---
6) Rode o túnel:
   cloudflared tunnel run cloudgame

Segurança e acesso
- Ative Cloudflare Access para exigir login antes de permitir que usuários acessem o túnel.
- Habilite TLS (via Cloudflare) e políticas adicionais conforme necessário.
- Restrinja com regras de IP ou geografias se necessário.

Notas importantes
- Latência/qualidade do streaming dependem da rede entre o usuário e o host. Para melhor experiência, prefira uma região geográfica próxima.
- Se você não possui domínio, o Cloudflare ainda fornece um hostname público sob cfargotunnel.com que pode ser usado temporariamente.
- Teste com a pessoa que vai usar o serviço para confirmar que o túnel está estável antes de colocar em produção.
