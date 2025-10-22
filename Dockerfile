FROM node:18-bullseye

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with platform-specific binaries
RUN npm ci

# Copy source code
COPY . .

# Rebuild native modules for the container's platform
RUN npm rebuild

# Build the application
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]