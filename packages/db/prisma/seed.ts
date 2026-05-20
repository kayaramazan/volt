// Seed: demo user + sample workspace with example requests.
// Run: pnpm db:seed:backend

import { PrismaClient, TeamRole } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Volt backend...');

  // Wipe existing demo data (idempotent)
  await prisma.conflictLog.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.apiRequest.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash('volt-demo-1234');

  const user = await prisma.user.create({
    data: {
      email: 'demo@volt.test',
      passwordHash,
      name: 'Demo User',
    },
  });

  // Personal workspace with one example collection + one request
  const ws = await prisma.workspace.create({
    data: {
      name: 'My Workspace',
      ownerUserId: user.id,
      currentRevision: 3n,
    },
  });

  const collectionId = randomUUID();
  await prisma.collection.create({
    data: {
      id: collectionId,
      workspaceId: ws.id,
      name: 'Examples',
      sortOrder: 0,
      revision: 1n,
      variables: [],
    },
  });

  await prisma.apiRequest.create({
    data: {
      id: randomUUID(),
      workspaceId: ws.id,
      collectionId,
      name: 'GitHub status',
      method: 'GET',
      url: 'https://www.githubstatus.com/api/v2/status.json',
      headers: [],
      queryParams: [],
      bodyType: 'none',
      body: {},
      auth: { type: 'none' },
      sortOrder: 0,
      revision: 2n,
    },
  });

  await prisma.environment.create({
    data: {
      id: randomUUID(),
      workspaceId: ws.id,
      name: 'Development',
      sortOrder: 0,
      revision: 3n,
      variables: [
        { key: 'baseUrl', value: 'https://api.dev.example.com', secretRef: null },
      ],
    },
  });

  console.log(`✓ User: demo@volt.test / volt-demo-1234`);
  console.log(`✓ Workspace: ${ws.name} (id ${ws.id})`);
  console.log('✓ Sample collection + request + environment created');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
