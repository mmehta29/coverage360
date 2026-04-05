'use client'

import { useState, useEffect } from 'react'
import DrugComparisonReal from './DrugComparisonReal'

// Transform coverage rows (per-indication) to comparison format (per-payer)
function transformToComparisonData(coverageRows) {
  if (!coverageRows || coverageRows.length === 0) return []

  const payerMap = {}
  for (const row of coverageRows) {
    const payer = row.payer || 'Unknown'
    if (!payerMap[payer]) {
      payerMap[payer] = {
        payer,
        policyTitle: row.policyTitle || 'Policy',
        effectiveDate: row.effective || '',
        coverageStatus: row.status === 'covered' ? 'covered' : row.status === 'restricted' ? 'unproven' : 'not_covered',
        tier: null,
        tierDetail: null,
        requiresPriorAuth: row.requiresPriorAuth || false,
        priorAuthCriteria: row.conditions || [],
        stepTherapy: row.stepTherapy || [],
        coveredIndications: [],
        siteOfCare: row.siteOfCare || null,
        dosingNotes: null,
        approvalDurationMonths: row.approvalDuration ? parseInt(row.approvalDuration) || null : null,
        limitations: row.limitations || [],
      }
    }
    if (row.indication && row.status === 'covered') {
      payerMap[payer].coveredIndications.push(row.indication)
    }
    if (row.stepTherapy?.length > 0) {
      payerMap[payer].stepTherapy = [...new Set([...payerMap[payer].stepTherapy, ...row.stepTherapy])]
    }
    if (row.conditions?.length > 0) {
      payerMap[payer].priorAuthCriteria = [...new Set([...payerMap[payer].priorAuthCriteria, ...row.conditions])]
    }
  }

  return Object.values(payerMap)
}

export default function ComparePanel({ initialDrug = '', initialResult = null }) {
  const [drugSearch, setDrugSearch] = useState(initialDrug)
  const [searchedDrug, setSearchedDrug] = useState('')
  const [payers, setPayers] = useState([])
  const [selectedPayers, setSelectedPayers] = useState([])
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  // Fetch payers on mount
  useEffect(() => {
    const fetchPayers = async () => {
      try {
        const res = await fetch('/api/payers')
        if (res.ok) {
          const data = await res.json()
          setPayers(data)
          setSelectedPayers(data.map(p => p.name))
        }
      } catch (err) {
        console.error('Failed to fetch payers:', err)
      }
    }
    fetchPayers()
  }, [])

  // Auto-populate from initial result if available
  useEffect(() => {
    if (!initialized && initialResult && initialResult.coverage && initialResult.coverage.length > 0) {
      setDrugSearch(initialDrug)
      setSearchedDrug(initialResult.name)
      setResults({
        drugName: initialResult.name,
        data: transformToComparisonData(initialResult.coverage)
      })
      setInitialized(true)
    }
  }, [initialResult, initialDrug, initialized])

  const handlePayerToggle = (payerName) => {
    setSelectedPayers(prev =>
      prev.includes(payerName)
        ? prev.filter(p => p !== payerName)
        : [...prev, payerName]
    )
  }

  const handleSearch = async (drugName) => {
    const drug = drugName || drugSearch
    if (!drug.trim()) return

    setIsLoading(true)
    setError(null)
    setSearchedDrug(drug)
    if (drugName) setDrugSearch(drugName)

    try {
      // Use the existing search API which returns coverage data
      const res = await fetch(`/api/search?q=${encodeURIComponent(drug)}`)
      if (!res.ok) {
        throw new Error('Drug not found')
      }
      const data = await res.json()

      if (data.noCoverageData || !data.coverage || data.coverage.length === 0) {
        setResults([])
      } else {
        // Filter by selected payers
        const filteredCoverage = selectedPayers.length > 0 && selectedPayers.length < payers.length
          ? data.coverage.filter(row => selectedPayers.includes(row.payer))
          : data.coverage

        setResults({
          drugName: data.name,
          data: transformToComparisonData(filteredCoverage)
        })
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
      setResults(null)
    } finally {
      setIsLoading(false)
    }
  }

  const exampleDrugs = ['Botox', 'Rituxan', 'Humira']

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <div className="compare-eyebrow">COVERAGE INTELLIGENCE</div>
        <h1 className="compare-title">Compare Drug Coverage</h1>
        <p className="compare-subtitle">
          Search for a drug to compare coverage, prior auth requirements, and step therapy across all payers.
        </p>
      </div>

      {/* Search Card */}
      <div className="compare-search-card">
        <div className="compare-search-row">
          <div className="compare-search-input-wrap">
            <svg className="compare-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l4 4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="compare-search-input"
              placeholder="Drug name, generic name, or J-code..."
              value={drugSearch}
              onChange={(e) => setDrugSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className="btn-solid compare-search-btn"
            onClick={() => handleSearch()}
            disabled={!drugSearch.trim() || isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Payer Filters */}
        {payers.length > 0 && (
          <div className="compare-payer-filters">
            <span className="compare-filter-label">Filter by payer:</span>
            <div className="compare-payer-list">
              {payers.map((payer) => (
                <label key={payer.id} className="compare-payer-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedPayers.includes(payer.name)}
                    onChange={() => handlePayerToggle(payer.name)}
                  />
                  <span>{payer.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="compare-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="compare-loading">
          <div className="compare-loading-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="compare-loading-card" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !results && !error && (
        <div className="compare-empty">
          <div className="compare-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="7" height="16" rx="1" />
              <rect x="14" y="6" width="7" height="14" rx="1" />
            </svg>
          </div>
          <div className="compare-empty-title">Search for a drug to compare coverage</div>
          <div className="compare-empty-hint">
            See side-by-side coverage comparison across all payers with prior auth, step therapy, and more.
          </div>
          <div className="compare-example-chips">
            <span>Try:</span>
            {exampleDrugs.map(drug => (
              <button
                key={drug}
                className="compare-chip"
                onClick={() => {
                  setDrugSearch(drug)
                  handleSearch(drug)
                }}
              >
                {drug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!isLoading && results && results.data?.length === 0 && (
        <div className="compare-empty">
          <div className="compare-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="compare-empty-title">No coverage data found for "{searchedDrug}"</div>
          <div className="compare-empty-hint">
            Try searching for a different drug or check back later.
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && results && results.data?.length > 0 && (
        <DrugComparisonReal
          drugName={results.drugName}
          data={results.data}
        />
      )}
    </div>
  )
}
