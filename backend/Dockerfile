# Start with a lightweight Node.js image
FROM node:22-slim
# Install OpenSSL (Required by Prisma for database communication)
RUN apt-get update -y && apt-get install -y openssl
# Set the working directory inside the container
WORKDIR /app
# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
# Copy the rest of the application code
COPY . .
# Generate Prisma Client and build the NestJS app
RUN npx prisma generate
RUN npm run build
# Expose the API port
EXPOSE 3000
# Start the production build
CMD ["npm", "run", "start:prod"]