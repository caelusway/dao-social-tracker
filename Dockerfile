# Use Node.js 18 Alpine for smaller image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "
    const http = require('http');
    const options = {
      host: 'localhost',
      port: process.env.PORT || 3000,
      path: '/health',
      timeout: 2000,
    };
    const request = http.request(options, (res) => {
      console.log(\`STATUS: \${res.statusCode}\`);
      process.exitCode = (res.statusCode === 200) ? 0 : 1;
      process.exit();
    });
    request.on('error', function(err) {
      console.log('ERROR');
      process.exit(1);
    });
    request.end();
  "

# Start application
CMD ["npm", "run", "railway:start"] 