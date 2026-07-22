FROM node:20-alpine AS base
WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia o código-fonte e faz a compilação
COPY . .
RUN npm run build

# Configuração de produção
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
