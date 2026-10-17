// PR uses its established full review chain; it is separate from PO/SR/CR.
export const initialPRStatus = (role, accredited) => Number(accredited) === 0 && accredited != null
  ? 'Pending Accreditation Review'
  : role === 'admin' ? 'For Admin Review' : 'For Engineer Review';

export async function assignPRReviewers(conn, id, owner, role) {
  const roles = role === 'admin'
    ? ['admin', 'senior_project_manager', 'super_admin', 'ceo']
    : ['engineer', 'admin', 'senior_project_manager', 'super_admin', 'ceo'];
  const [people] = await conn.query('SELECT id FROM employees WHERE is_active=1 AND role IN (?) AND id<>?', [roles, owner]);
  for (const person of people) {
    await conn.query('INSERT IGNORE INTO purchase_request_reviews (purchase_request_id,reviewer_id,review_status) VALUES (?,?,?)', [id, person.id, 'pending']);
  }
  return people.map(person => person.id);
}

export async function archivePRReviews(conn, id, actor) {
  const [reviews] = await conn.query('SELECT r.*,e.role AS reviewer_role,e.first_name AS reviewer_first_name,e.last_name AS reviewer_last_name FROM purchase_request_reviews r LEFT JOIN employees e ON e.id=r.reviewer_id WHERE purchase_request_id=? ORDER BY r.id', [id]);
  if (reviews.length) {
    await conn.query('INSERT INTO purchase_request_review_history (purchase_request_id,archived_by,reviews) VALUES (?,?,?)', [id, actor, JSON.stringify(reviews)]);
    await conn.query('DELETE FROM purchase_request_reviews WHERE purchase_request_id=?', [id]);
  }
}
