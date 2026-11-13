import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, TeamRole } from '@volt/db';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';

import { SyncService } from '../src/sync/sync.service';
import { SyncStreamService } from '../src/sync/sync-stream.service';
import { AppError } from '../src/common/app.error';

describe('SyncService — last-write-wins', () => {
  let sync: SyncService;
  let userIdA: string;
  let userIdB: string;
  let workspaceId: string;

  beforeAll(async () => {
    // Construct directly: vitest's esbuild transform doesn't emit decorator
    // metadata, so Nest's DI would inject `undefined` for the stream service.
    sync = new SyncService(new SyncStreamService());
  });

  beforeEach(async () => {
    // Clean slate
    await prisma.conflictLog.deleteMany();
    await prisma.environment.deleteMany();
    await prisma.apiRequest.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await argon2.hash('test-password');
    const userA = await prisma.user.create({
      data: { email: 'a@volt.test', passwordHash, name: 'Alice' },
    });
    const userB = await prisma.user.create({
      data: { email: 'b@volt.test', passwordHash, name: 'Bob' },
    });
    userIdA = userA.id;
    userIdB = userB.id;

    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        ownerId: userIdA,
        members: {
          create: [
            { userId: userIdA, role: TeamRole.OWNER },
            { userId: userIdB, role: TeamRole.EDITOR },
          ],
        },
      },
    });

    const workspace = await prisma.workspace.create({
      data: { name: 'WS', ownerTeamId: team.id, currentRevision: 0n },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applies a single change and increments revision', async () => {
    const requestId = randomUUID();
    const result = await sync.push(userIdA, workspaceId, '0', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: {
          id: requestId,
          name: 'Test request',
          method: 'GET',
          url: 'https://example.com',
        },
      },
    ]);

    expect(result.newRevision).toBe('1');
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.revision).toBe('1');

    const stored = await prisma.apiRequest.findUnique({ where: { id: requestId } });
    expect(stored?.name).toBe('Test request');
    expect(stored?.revision).toBe(1n);
  });

  it('rejects push with stale baseRevision and returns 409 with currentRevision', async () => {
    // Alice pushes first
    const requestId = randomUUID();
    await sync.push(userIdA, workspaceId, '0', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Alice version', method: 'GET', url: 'https://x' },
      },
    ]);

    // Bob tries to push from same baseRevision (still 0)
    let caught: AppError | undefined;
    try {
      await sync.push(userIdB, workspaceId, '0', [
        {
          op: 'upsert',
          table: 'request',
          rowId: requestId,
          data: { id: requestId, name: 'Bob version', method: 'GET', url: 'https://y' },
        },
      ]);
    } catch (e) {
      caught = e as AppError;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect(caught?.code).toBe('REVISION_CONFLICT');
    expect(caught?.status).toBe(409);
    expect(caught?.extra?.currentRevision).toBe('1');

    // Alice's version remains
    const stored = await prisma.apiRequest.findUnique({ where: { id: requestId } });
    expect(stored?.name).toBe('Alice version');
  });

  it('last-write-wins after Bob pulls and re-pushes from updated revision', async () => {
    const requestId = randomUUID();

    // Alice pushes first
    const aliceResult = await sync.push(userIdA, workspaceId, '0', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Alice version', method: 'GET', url: 'https://x' },
      },
    ]);

    // Bob pulls — sees Alice's change
    const pullResult = await sync.pull(workspaceId, '0');
    expect(pullResult.currentRevision).toBe('1');
    expect(pullResult.changes).toHaveLength(1);

    // Bob now pushes with the updated baseRevision
    const bobResult = await sync.push(userIdB, workspaceId, aliceResult.newRevision, [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Bob version', method: 'GET', url: 'https://y' },
      },
    ]);

    expect(bobResult.newRevision).toBe('2');

    // Bob's version wins
    const stored = await prisma.apiRequest.findUnique({ where: { id: requestId } });
    expect(stored?.name).toBe('Bob version');

    // Alice's overwritten state is in conflict log
    const conflicts = await sync.listConflicts(workspaceId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.rowId).toBe(requestId);
    expect((conflicts[0]?.previousState as { name: string }).name).toBe('Alice version');
    expect(conflicts[0]?.overwrittenBy).toBe(userIdB);
  });

  it('restoreConflict reapplies the overwritten state as a new revision', async () => {
    const requestId = randomUUID();

    // Alice pushes, Bob overwrites
    await sync.push(userIdA, workspaceId, '0', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Alice version', method: 'GET', url: 'https://x' },
      },
    ]);
    await sync.push(userIdB, workspaceId, '1', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Bob version', method: 'GET', url: 'https://y' },
      },
    ]);

    // Alice restores her version
    const conflicts = await sync.listConflicts(workspaceId);
    expect(conflicts).toHaveLength(1);
    await sync.restoreConflict(userIdA, conflicts[0]!.id);

    // Now Alice's version is back
    const stored = await prisma.apiRequest.findUnique({ where: { id: requestId } });
    expect(stored?.name).toBe('Alice version');
    expect(stored?.revision).toBe(3n);

    // And there are now 2 conflict log entries (Bob's was logged when Alice restored)
    const conflictsAfter = await sync.listConflicts(workspaceId);
    expect(conflictsAfter).toHaveLength(2);
  });

  it('delete is a sync operation, logged as conflict', async () => {
    const requestId = randomUUID();
    await sync.push(userIdA, workspaceId, '0', [
      {
        op: 'upsert',
        table: 'request',
        rowId: requestId,
        data: { id: requestId, name: 'Will be deleted', method: 'GET', url: 'https://x' },
      },
    ]);

    await sync.push(userIdB, workspaceId, '1', [
      { op: 'delete', table: 'request', rowId: requestId },
    ]);

    // Soft delete: row still exists with deletedAt set
    const stored = await prisma.apiRequest.findUnique({ where: { id: requestId } });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(stored?.revision).toBe(2n);

    // Pull returns it as a delete operation
    const pull = await sync.pull(workspaceId, '1');
    expect(pull.changes).toHaveLength(1);
    expect(pull.changes[0]?.op).toBe('delete');
  });

  it('pull returns rows ordered by revision ASC across tables', async () => {
    // Mix of operations across tables
    const collId = randomUUID();
    const reqId = randomUUID();
    const envId = randomUUID();

    await sync.push(userIdA, workspaceId, '0', [
      { op: 'upsert', table: 'collection', rowId: collId, data: { id: collId, name: 'C1' } },
      { op: 'upsert', table: 'request', rowId: reqId, data: { id: reqId, name: 'R1', method: 'GET', url: 'https://x' } },
      { op: 'upsert', table: 'environment', rowId: envId, data: { id: envId, name: 'E1' } },
    ]);

    const pull = await sync.pull(workspaceId, '0');
    expect(pull.changes).toHaveLength(3);
    // Revisions should be 1, 2, 3 in order
    expect(pull.changes.map((c) => c.revision)).toEqual(['1', '2', '3']);
    expect(pull.currentRevision).toBe('3');
  });
});
