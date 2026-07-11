module.exports = {
  apps: [
    {
      name: 'skyprints-api',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'prod',
      },
      max_memory_restart: '400M',
      autorestart: true,
    },
  ],
};
