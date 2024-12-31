FROM node:20-alpine

LABEL usage="docker build -t <image-name> ."
LABEL usage="docker run -p 5111:5111 <image-name>"

WORKDIR /app

# build dependencies for bcrypt
RUN apk add python3 make g++

# Copy package files first
COPY package*.json ./

# Install dependencies (this layer will be cached)
RUN npm install --include=dev

# Copy source code (this will run on every build)
COPY . .

EXPOSE 5111

CMD ["npm", "start"]