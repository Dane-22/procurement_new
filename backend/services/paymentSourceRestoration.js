// Call inside the payment document's transaction. Only restore a source when
// no other active payment/voucher exists and its current approval still holds.
export async function restorePaymentSource(conn, payment, excludedTable, excludedId) {
  for (const [table, fk, kind, target] of [
    ['purchase_requests', 'purchase_request_id', null, 'For Purchase'],
    ['cash_requests', 'cash_request_id', 'cr', 'Approved'],
    ['service_requests', 'service_request_id', 'sr', 'Approved'],
    ['reimbursements', 'reimbursement_id', null, 'For Purchase']
  ]) {
    if (!payment[fk]) continue;
    const [sources] = await conn.query(`SELECT status FROM ${table} WHERE id=? FOR UPDATE`, [payment[fk]]);
    if (!sources.length || !['Payment Request Created', 'Payment Order Created'].includes(sources[0].status)) continue;
    if (kind) {
      const [rounds] = await conn.query('SELECT status FROM request_workflow_rounds WHERE module=? AND document_id=? ORDER BY round_number DESC LIMIT 1', [kind, payment[fk]]);
      if (rounds[0]?.status !== 'approved') continue;
    }
    let active = false;
    for (const linkedTable of ['payment_requests', 'payment_orders', 'disbursement_vouchers']) {
      // Not every legacy payment table supports every source column.
      const [columns] = await conn.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [linkedTable, fk]);
      if (!columns.length) continue;
      const [links] = await conn.query(`SELECT id FROM ${linkedTable} WHERE ${fk}=? AND status NOT IN ('Rejected','Cancelled') ${linkedTable === excludedTable ? 'AND id<>?' : ''} LIMIT 1`, linkedTable === excludedTable ? [payment[fk], excludedId] : [payment[fk]]);
      if (links.length) { active = true; break; }
    }
    if (!active) await conn.query(`UPDATE ${table} SET status=?,updated_at=NOW() WHERE id=?`, [target, payment[fk]]);
  }
}
