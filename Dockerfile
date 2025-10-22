FROM node:18-bullseye

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (this will work without package-lock.json)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]