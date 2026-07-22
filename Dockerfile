FROM node:22-alpine AS builder
WORKDIR /app

# Ativa o pnpm nativo
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copia manifestos e instala dependências
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copia código-fonte e compila (Frontend + API)
COPY . .
RUN pnpm run build

# Estágio final de produção
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

ENV NODE_ENV=production
ENV PORT=3000

# Instala apenas dependências de produção
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod

# Copia artefatos compilados
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/boot.js"]
