import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeOwnedWorkspaces } from '../src/workspaces.ts';

test('admin workspace ordering prefers the account-owned workspace and preserves other workspace order', () => {
  const workspaces = [
    { slug: 'newer-other-workspace', owner_user_id: 'another-user' },
    { slug: 'older-owned-workspace', owner_user_id: 'current-user' },
    { slug: 'oldest-other-workspace', owner_user_id: null }
  ];

  assert.deepEqual(
    prioritizeOwnedWorkspaces(workspaces, 'current-user').map(workspace => workspace.slug),
    ['older-owned-workspace', 'newer-other-workspace', 'oldest-other-workspace']
  );
});
