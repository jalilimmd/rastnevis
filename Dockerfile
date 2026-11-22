# Static image for self-hosting: nginx as a non-root user, listening on 8080.
# For reproducible builds, pin the base image by digest, e.g. nginxinc/nginx-unprivileged:stable-alpine@sha256:...
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx public/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
