# Portable production image for the SPA.
# NOTE: production runs on Vercel — this container is a self-host/preview
# fallback. It intentionally skips the Puppeteer prerender postbuild step
# (SEO prerendering is only wired up for the Vercel deploy).

# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# plain vite build (npm run build would trigger the puppeteer postbuild)
RUN npx vite build

# --- serve stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1, not localhost: on Alpine "localhost" resolves to ::1 first, and a
# probe that only ever reached IPv6 kept the container "starting" forever.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
