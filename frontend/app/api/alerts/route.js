const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const days = searchParams.get('days') || '1'

  if (!BACKEND_URL) {
    return Response.json({ days: Number(days), alerts: [], error: 'Backend not configured' }, { status: 503 })
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/changes/recent?days=${encodeURIComponent(days)}`, { cache: 'no-store' })
  } catch {
    return Response.json({ days: Number(days), alerts: [], error: 'Backend unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    return Response.json({ days: Number(days), alerts: [], error: 'Unable to load alerts' }, { status: res.status })
  }

  const data = await res.json()
  const alerts = (data.changes || []).map((change, index) => adaptAlert(change, index))

  return Response.json({ days: Number(days), alerts })
}

function adaptAlert(change, index) {
  const payer = change.policies?.payers?.short_name || change.policies?.payers?.name || 'Unknown payer'
  const policyTitle = change.policies?.policy_title || 'Policy update'

  // diff_summary may be a JSON string, a parsed object, or a plain string
  let diffObj = change.diff_summary
  if (typeof diffObj === 'string') {
    try { diffObj = JSON.parse(diffObj) } catch { /* leave as string */ }
  }
  const summary = typeof diffObj === 'object' && diffObj !== null
    ? (diffObj.diff_summary || 'Meaningful policy change detected.')
    : (diffObj || 'Meaningful policy change detected.')
  const lower = summary.toLowerCase()

  let type = 'warning'
  if (lower.includes('removed') || lower.includes('not covered') || lower.includes('restricted') || lower.includes('step therapy')) {
    type = 'negative'
  } else if (lower.includes('expanded') || lower.includes('added') || lower.includes('preferred') || lower.includes('cover')) {
    type = 'positive'
  }

  return {
    id: `${change.version_number}-${index}`,
    type,
    drug: extractDrugName(summary) || policyTitle,
    payer,
    summary,
    date: formatDate(change.snapshotted_at),
    policyRef: policyTitle,
    policyId: change.policies?.id || null,
  }
}

function extractDrugName(summary) {
  const match = summary.match(/\b([A-Z][a-z]+(?:mab|cept|nib|zumab|ximab|limab))\b/)
  return match ? match[1] : null
}

function formatDate(iso) {
  if (!iso) return 'Unknown date'
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
