import express from 'express';

import { router } from '@/api/index.js';
import { config } from '@/config/index.js';
import { logger } from '@/lib/logger.js';

const app = express();
app.use(express.json());
app.use('/api', router);

app.listen(config.port, () => {
  logger.info(`Arbitra AI Agent listening on port ${config.port}`);
});

export { app };
