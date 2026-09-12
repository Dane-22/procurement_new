# PR Bypass Feature Tasks

- [x] Backend: Add `is_bypassed` and `bypassed_by` columns to the database
- [x] Backend: Implement `PUT /api/purchase-requests/:id/bypass` route
- [x] Update `mobile/App.js` to register `ProcessPR`# Include Supplier on Mobile Tasks

- [x] Create `mobile/screens/CreateSupplierScreen.js`
  - [x] Build form with required fields (name, contact_person, phone, email, address)
  - [x] Integrate with `POST /suppliers` API endpoint
  - [x] Handle successful creation (navigate back, pass new supplier ID)
- [x] Modify `mobile/screens/ProcessPRScreen.js`
  - [x] Add "Add New Supplier" option to the end of the Picker list
  - [x] Update `onValueChange` to intercept "ADD_NEW" selection and navigate to `CreateSupplierScreen`
  - [x] Refresh supplier list and auto-select new supplier upon return
- [x] Update `mobile/App.js`
  - [x] Register `CreateSupplierScreen` in the navigation stack
- [x] Verify functionality end-to-endt
- [x] Frontend: Show "Bypassed By" information in PR details if `is_bypassed` is true
- [x] Documentation: Update `system-flowchart.md` with bypass flow
