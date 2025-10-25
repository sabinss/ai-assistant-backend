# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the backend application code to the working directory
COPY . .

# Copy environment file if it exists, otherwise create a template
COPY .env* ./

# Expose the port your backend app runs on
EXPOSE 5001

# Command to run your backend app
CMD ["npm", "start"]
