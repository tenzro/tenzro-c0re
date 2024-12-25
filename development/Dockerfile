# Development Dockerfile
FROM node:18-alpine as development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Development ports
EXPOSE 8080 8081

CMD ["npm", "run", "dev"]