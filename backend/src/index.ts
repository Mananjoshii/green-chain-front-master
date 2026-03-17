import "dotenv/config";

import { loadEnv } from "./env.js";
import { createApp } from "./server.js";

const env = loadEnv(process.env);
const app = createApp(env);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`EcoChain backend listening on :${env.PORT}${env.API_BASE_PATH}`);
});

