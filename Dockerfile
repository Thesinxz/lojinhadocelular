FROM node:22-alpine AS builder
WORKDIR /app

# Instala pnpm 9 de forma explícita e determinística
RUN npm install -g pnpm@9.15.9

# Copia manifestos e instala dependências para o build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --production=false

# Copia código-fonte e compila (Frontend + API)
COPY . .
RUN pnpm run build

# Estágio final de produção
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@9.15.9

ENV NODE_ENV=production
ENV PORT=3000

# Instala dependências de produção
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copia artefatos compilados
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/boot.js"]
