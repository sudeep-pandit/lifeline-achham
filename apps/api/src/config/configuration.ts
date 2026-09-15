export default () => ({
  port: parseInt(process.env.PORT ?? "4000", 10),
  appUrl: process.env.APP_URL ?? "http://localhost:4000",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL,
  },
  auth: {
    jwtSecret: process.env.AUTH_JWT_SECRET ?? "dev-secret-change-me",
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? "15m",
    refreshSecret: process.env.AUTH_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
    refreshExpiresIn: process.env.AUTH_REFRESH_EXPIRES_IN ?? "7d",
    cookieName: process.env.AUTH_COOKIE_NAME ?? "lifeline_session",
    cookieSecure: process.env.AUTH_COOKIE_SECURE === "true",
  },
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12", 10),
  backup: {
    dir: process.env.BACKUP_DIR ?? "./backups",
    automaticEnabled: process.env.BACKUP_AUTOMATIC_ENABLED === "true",
    automaticCron: process.env.BACKUP_AUTOMATIC_CRON ?? "0 2 * * *",
  },
  ai: {
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL ?? "claude-sonnet-4-6",
  },
  payments: {
    esewa: {
      merchantCode: process.env.ESEWA_MERCHANT_CODE,
      secret: process.env.ESEWA_SECRET,
      clientId: process.env.ESEWA_CLIENT_ID,
      verifyUrl: process.env.ESEWA_VERIFY_URL,
    },
    khalti: {
      secretKey: process.env.KHALTI_SECRET_KEY,
      verifyUrl: process.env.KHALTI_VERIFY_URL,
    },
    connectips: {
      merchantId: process.env.CONNECTIPS_MERCHANT_ID,
      appId: process.env.CONNECTIPS_APP_ID,
      appName: process.env.CONNECTIPS_APP_NAME,
      config: process.env.CONNECTIPS_CONFIG,
    },
  },
});
