import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  rootDir,
  artifactsDir: path.join(rootDir, 'artifacts'),
  dataDir: path.join(rootDir, 'data'),
  dbPath: path.join(rootDir, 'data', 'artifacts.sqlite'),
  appName: process.env.ARTIFACTS_APP_NAME || "Rick's Artifacts",
  ownerNpub:
    process.env.ARTIFACTS_OWNER_NPUB ||
    'npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy',
  port: Number(process.env.PORT || 5178)
};
