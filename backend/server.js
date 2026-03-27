const app = require('./app');
const db = require('./src/models');
const PORT = process.env.PORT || 5431;

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      await db.sequelize.sync({ alter: true });
      console.log('✅ All models synchronized (dev mode)');
    } else {
      console.log('⚠️ Skipping sync in production, use migrations instead');
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('🔻 Closing server...');
      server.close(async () => {
        await db.sequelize.close();
        console.log('✅ Server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
