import { jest, afterEach, expect, it } from '@jest/globals';
import { getBranches, invalidateBranchCache } from '../utils/branchProjects.js';

afterEach(() => { jest.restoreAllMocks(); invalidateBranchCache(); });

it('reports an unavailable upstream instead of inventing usable projects', async () => {
  invalidateBranchCache();
  const fetch = jest.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Upstream unavailable'));
  await expect(getBranches()).rejects.toMatchObject({statusCode:503,message:expect.stringContaining('temporarily unavailable')});
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('preserves an actual empty project response', async () => {
  invalidateBranchCache();
  jest.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>[]});
  await expect(getBranches()).resolves.toEqual([]);
});
