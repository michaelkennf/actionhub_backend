module.exports = {
  apps: [
    {
      name: "actionhub-backend",
      cwd: "./backend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "5016",
      },
    },
  ],
}
