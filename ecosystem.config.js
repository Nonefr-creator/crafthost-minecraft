module.exports = {
  apps: [
    {
      name: 'crafthost-backend',
      script: 'backend/api.cjs',
      watch: false,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: process.env.JWT_SECRET || 'change_this'
      }
    }
  ]
};
