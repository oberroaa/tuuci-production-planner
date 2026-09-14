module.exports = {
  apps: [
    {
      name: 'tuuci-production-planner-api',
      script: 'api/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
