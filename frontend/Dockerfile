# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for any native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm ci for faster, more reliable builds if package-lock.json exists
# Added --legacy-peer-deps to handle potential conflicts in fresh environments
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Final stage - serve with Nginx
FROM nginx:stable-alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
