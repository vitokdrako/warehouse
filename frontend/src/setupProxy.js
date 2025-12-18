const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Only proxy API requests to the backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      logLevel: 'debug'
    })
  );
  
  // Proxy uploads and static backend files
  app.use(
    '/uploads',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true
    })
  );
  
  app.use(
    '/static',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true
    })
  );
};