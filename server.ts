/**
 * API entry point. Lives outside src/ (alongside db/migrate.ts,
 * db/seeds/index.ts) and is run directly via tsx — it's the one place
 * allowed to wire src/ (app code) together with db/ (Drizzle schema and
 * adapters), which the tsc build for src/** intentionally keeps apart.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createApp } from './src/app';
import { AuthService } from './src/auth/authService';
import { db } from './db/client';
import { DrizzleRefreshTokenRepository } from './db/adapters/refreshTokenRepository';
import { DrizzleUserDirectory } from './db/adapters/userDirectory';

const authService = new AuthService(
  new DrizzleRefreshTokenRepository(db),
  new DrizzleUserDirectory(db),
);
const app = createApp(authService);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`🌐 API listening on port ${port}`);
});
