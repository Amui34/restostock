# =============================================================================
# Grimoire Bivouak — site statique (app/) servi par Caddy en HTTP interne.
#   :80 → app/index.html (+ livre-de-prix*.html)
# Le TLS est géré par le proxy partagé (amui-proxy), pas ici.
#
# Les fichiers de app/ sont GÉNÉRÉS depuis source/ (python3 source/build.py) et
# versionnés : l'image ne fait que les servir, pas de build au déploiement.
# =============================================================================

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY app /srv
EXPOSE 80
