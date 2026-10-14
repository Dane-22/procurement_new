import { initialPettyCashReviewStage, nextPettyCashReviewStage } from '../utils/pettyCashReviewFlow.js';

test('CEO requests pass through Engineers, Admins, then Senior Project Engineers', () => {
  expect(initialPettyCashReviewStage('ceo')).toBe('engineer');
  expect(nextPettyCashReviewStage('engineer', 'ceo', 150000)).toBe('admin');
  expect(nextPettyCashReviewStage('admin', 'ceo', 150000)).toBe('senior_project_manager');
  expect(nextPettyCashReviewStage('senior_project_manager', 'ceo', 150000)).toBeNull();
});

test('Senior Project Engineer requests pass through Engineers, Admins, then CEO', () => {
  expect(initialPettyCashReviewStage('senior_project_manager')).toBe('engineer');
  expect(nextPettyCashReviewStage('engineer', 'senior_project_manager', 15000)).toBe('admin');
  expect(nextPettyCashReviewStage('admin', 'senior_project_manager', 15000)).toBe('ceo');
  expect(nextPettyCashReviewStage('ceo', 'senior_project_manager', 15000)).toBeNull();
});

test('Other requester roles retain their existing review route', () => {
  expect(initialPettyCashReviewStage('engineer')).toBe('engineer');
  expect(initialPettyCashReviewStage('admin')).toBe('admin');
  expect(nextPettyCashReviewStage('admin', 'engineer', 15000)).toBe('senior_project_manager');
  expect(nextPettyCashReviewStage('admin', 'admin', 150000)).toBe('ceo');
});
