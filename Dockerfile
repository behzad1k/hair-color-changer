FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept build arguments for NEXT_PUBLIC_* variables
ARG NEXT_PUBLIC_APP_LANGUAGE
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG NEXT_PUBLIC_APP_TITLE

# Set them as ENV so they're available during build
ENV NEXT_PUBLIC_APP_LANGUAGE=$NEXT_PUBLIC_APP_LANGUAGE
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV NEXT_PUBLIC_APP_TITLE=$NEXT_PUBLIC_APP_TITLE

# Now build with these variables baked in
RUN npm run build

EXPOSE 3002 3006

CMD ["sh", "-c", "npm start -- -H ${HOSTNAME:-0.0.0.0} -p ${PORT:-3002}"]