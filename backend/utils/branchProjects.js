import { isOrderNumberLocked, normalizeOrderNumber } from './orderNumberLocks.js';
const BRANCHES_API_URL = process.env.BRANCHES_API_URL || 'https://jajr.xandree.com/get_branches_api.php';
const BRANCH_CACHE_TTL_MS = Number(process.env.BRANCH_CACHE_TTL_MS || 60_000);
const BRANCH_FETCH_TIMEOUT_MS = Number(process.env.BRANCH_FETCH_TIMEOUT_MS || 10_000);

let branchCache = {
  data: null,
  fetchedAt: 0
};

const normalizeBranches = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.branches)) return payload.branches;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'active'].includes(normalized);
  }
  return false;
};

const normalizeBranch = (branch) => ({
  id: branch?.id ?? branch?.branch_id ?? null,
  branch_name: String(branch?.branch_name || branch?.name || '').trim(),
  branch_address: String(branch?.branch_address || branch?.address || '').trim(),
  order_number: String(branch?.order_number || branch?.code || '').trim(),
  is_active: toBoolean(branch?.is_active)
});

const normalizeProjectName = (project) => String(project || '').trim().toLowerCase();

const createProjectValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const invalidateBranchCache = () => {
  branchCache = {
    data: null,
    fetchedAt: 0
  };
};

export const getBranches = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && branchCache.data && now - branchCache.fetchedAt < BRANCH_CACHE_TTL_MS) {
    return branchCache.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRANCH_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(BRANCHES_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Branches API failed with status ${response.status}`);
    }

    const payload = await response.json();
    const branches = normalizeBranches(payload)
      .map(normalizeBranch)
      .filter((branch) => branch.branch_name);

    branchCache = {
      data: branches,
      fetchedAt: now
    };

    return branches;
  } catch (error) {
    throw createProjectValidationError(
      'Project validation is currently unavailable. Please try again later.',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const getActiveBranches = async () => {
  const branches = await getBranches();
  return branches.filter((branch) => branch.is_active);
};

export const findBranchByName = async (project) => {
  const normalizedProject = normalizeProjectName(project);
  if (!normalizedProject) return null;

  const branches = await getBranches();
  return branches.find((branch) => normalizeProjectName(branch.branch_name) === normalizedProject) || null;
};

export const assertProjectIsActive = async (project, { providedOrderNumber = null } = {}) => {
  const normalizedProject = normalizeProjectName(project);
  if (!normalizedProject) {
    throw createProjectValidationError('Project is required.');
  }

  const branch = await findBranchByName(project);
  if (!branch) {
    throw createProjectValidationError(`Project "${project}" is invalid.`);
  }

  if (!branch.is_active) {
    throw createProjectValidationError(
      `Project "${branch.branch_name}" is archived and cannot be used for new requests.`
    );
  }

  const normalizedBranchOrderNumber = normalizeOrderNumber(branch.order_number);
  if (!normalizedBranchOrderNumber) {
    throw createProjectValidationError(
      `Project "${branch.branch_name}" has no order number assigned.`
    );
  }

  const normalizedProvidedOrderNumber = normalizeOrderNumber(providedOrderNumber);
  if (normalizedProvidedOrderNumber && normalizedProvidedOrderNumber !== normalizedBranchOrderNumber) {
    throw createProjectValidationError(
      `Order number does not match the selected project "${branch.branch_name}".`
    );
  }

  const locked = await isOrderNumberLocked(normalizedBranchOrderNumber);
  if (locked) {
    throw createProjectValidationError(
      `Order number "${normalizedBranchOrderNumber}" is locked and cannot be used for new requests.`
    );
  }

  return branch;
};
