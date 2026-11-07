# Production runtime is Cloudflare Workers (`npx wrangler deploy`), not this image.
# The image only checks that the frontend build and source package succeed.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["sh", "-c", "echo 'Build complete. Deploy with: npx wrangler deploy'; echo 'Set Worker secret: POE_API_KEY'"]
