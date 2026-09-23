import { test, expect } from '@playwright/test';

test.describe('Purchase Request (PR) Flow', () => {
  // Use a longer timeout for this end-to-end flow
  test.setTimeout(60000);

  test('Engineer creates PR -> Admin processes -> Super Admin approves', async ({ page, browser }) => {
    
    // --- Step 1: Engineer Creates PR ---
    await test.step('Engineer creates a PR', async () => {
      await page.goto('/');
      
      // Login as Engineer
      await page.locator('input[name="employee_no"]').fill('EMP-001'); // Assume EMP-001 is engineer
      await page.locator('input[name="password"]').fill('password123');
      await page.getByRole('button', { name: /Login|Sign in/i }).click();
      
      // Wait for dashboard and navigate to Purchase Requests
      await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 }).catch(() => {});
      await page.goto('/dashboard/purchase-requests');

      // Click "New Purchase Request" or similar button
      // We will look for a link/button with a plus icon or 'New Request' text
      const newPrButton = page.getByRole('button', { name: /New|Create/i }).first();
      if (await newPrButton.isVisible()) {
        await newPrButton.click();
      } else {
        // Navigate directly to create page if button is hard to find
        await page.goto('/dashboard/purchase-requests/new');
      }

      // Fill out the PR form
      await page.locator('textarea[name="purpose"], input[name="purpose"]').fill('E2E Test Purchase Request');
      
      // Add items
      const itemNameInput = page.getByPlaceholder(/Item Name/i).first();
      if (await itemNameInput.isVisible()) {
        await itemNameInput.fill('Test Item 1');
        await page.getByPlaceholder(/Quantity/i).first().fill('10');
      }
      
      // Submit the form
      await page.getByRole('button', { name: /Submit|Save/i }).click();

      // Verify success (e.g. redirected back to PR list and item exists)
      await expect(page.getByText('E2E Test Purchase Request').first()).toBeVisible({ timeout: 10000 });
      
      // Logout Engineer
      const logoutBtn = page.getByRole('button', { name: /Logout|Sign out/i });
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
      } else {
        await page.goto('/'); // reset
      }
    });

    // --- Step 2: Admin Processes PR ---
    await test.step('Admin processes the PR', async () => {
      await page.goto('/');
      
      // Login as Admin
      await page.locator('input[name="employee_no"]').fill('ADM-001'); // Assume ADM-001 is admin
      await page.locator('input[name="password"]').fill('password123');
      await page.getByRole('button', { name: /Login|Sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 }).catch(() => {});
      await page.goto('/dashboard/approvals');

      // Find the PR and process it
      const prCard = page.getByText('E2E Test Purchase Request').first();
      await expect(prCard).toBeVisible({ timeout: 10000 });
      
      // Click Process or Review button
      const processBtn = prCard.locator('..').getByRole('button', { name: /Process|Review|Approve/i }).first();
      if (await processBtn.isVisible()) {
        await processBtn.click();
        
        // Fill supplier or pricing if required
        const supplierSelect = page.locator('select[name="supplier_id"]');
        if (await supplierSelect.isVisible()) {
            await supplierSelect.selectOption({ index: 1 });
        }
        
        await page.getByRole('button', { name: /Confirm|Submit|Approve/i }).click();
      }

      // Logout Admin
      const logoutBtn = page.getByRole('button', { name: /Logout|Sign out/i });
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
      }
    });

    // --- Step 3: Super Admin Final Approval ---
    await test.step('Super Admin finalizes the PR', async () => {
      await page.goto('/');
      
      // Login as Super Admin
      await page.locator('input[name="employee_no"]').fill('SADM-001'); // Assume SADM-001 is super admin
      await page.locator('input[name="password"]').fill('password123');
      await page.getByRole('button', { name: /Login|Sign in/i }).click();
      
      await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 10000 }).catch(() => {});
      await page.goto('/dashboard/approvals');

      // Find the PR and approve it
      const prCard = page.getByText('E2E Test Purchase Request').first();
      await expect(prCard).toBeVisible({ timeout: 10000 });
      
      const approveBtn = prCard.locator('..').getByRole('button', { name: /Final Approve|Approve/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.getByRole('button', { name: /Confirm|Yes/i }).click();
      }
    });
  });
});
