# Use an official Node.js runtime as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

COPY .env.example .env

# Install dependencies
RUN npm install

# Copy the rest of the backend application code to the working directory
COPY . .

# Expose the port your backend app runs on
EXPOSE 5000

# Command to run your backend app
CMD ["npm", "start"]
