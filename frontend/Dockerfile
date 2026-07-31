# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
