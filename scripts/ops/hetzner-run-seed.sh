#!/bin/sh
set -e
cd /app
npm install --no-save ts-node typescript
TS_NODE_TRANSPILE_ONLY=1 npx ts-node prisma/seed.ts
