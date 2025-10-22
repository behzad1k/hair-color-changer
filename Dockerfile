FROM node:18-bullseye

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3002

# Bind to 0.0.0.0 to allow external access
CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3002"]