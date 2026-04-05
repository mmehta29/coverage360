'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { compareCoverage, getPayers } from '@/lib/api'

interface Payer {
  id: string
  name: string
  type: string | null
}

interface Indication {
  indication_name: string | null
  coverage_status: string | null
  icd10_codes: string[]
}

interface StepTherapy {
  order?: number
  step_order?: number
  required_agents?: string[]
  reason?: string
}

interface PayerComparison {
  payer_name: string
  payer_type: string | null
  drug_brand_name: string | null
  drug_generic_name: string | null
  coverage_status: string | null
  requires_prior_auth: boolean
  coverage_tier: string | null
  coverage_tier_detail?: string | null
  indications: Indication[]
  step_therapy: StepTherapy[]
  approval_duration_months: number | null
  policy_title: string | null
  effective_date: string | null
}

interface CompareResult {
  comparison: Record<string, PayerComparison>
  payers: string[]
}

function CoverageStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    covered: 'bg-green-100 text-green-800',
    not_covered: 'bg-red-100 text-red-800',
    unproven: 'bg-yellow-100 text-yellow-800',
    preferred: 'bg-green-100 text-green-800',
    non_preferred: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-slate-200 rounded w-1/3"></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="h-6 bg-slate-200 rounded w-2/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComparePage() {
  const [drugSearch, setDrugSearch] = useState('')
  const [payers, setPayers] = useState<Payer[]>([])
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [result, setResult] = useState<CompareResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch payers on mount
  useEffect(() => {
    const fetchPayers = async () => {
      try {
        const data = await getPayers()
        setPayers(data as Payer[])
      } catch (err) {
        console.error('Failed to fetch payers:', err)
      }
    }
    fetchPayers()
  }, [])

  const handlePayerToggle = (payerName: string) => {
    setSelectedPayers((prev) =>
      prev.includes(payerName)
        ? prev.filter((p) => p !== payerName)
        : [...prev, payerName]
    )
  }

  const handleSearch = async () => {
    if (!drugSearch.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await compareCoverage(drugSearch, selectedPayers)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-6 px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold">AntonRx Policy Tracker</h1>
          <p className="text-blue-200 mt-1">Medical Benefit Drug Policy Analysis</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-8 py-3">
        <div className="max-w-6xl mx-auto flex gap-6">
          <Link
            href="/"
            className="text-slate-600 font-medium hover:text-blue-600"
          >
            Search Drugs
          </Link>
          <Link
            href="/compare"
            className="text-blue-600 font-medium hover:text-blue-800"
          >
            Compare Coverage
          </Link>
          <Link
            href="/ask"
            className="text-slate-600 font-medium hover:text-blue-600"
          >
            Ask Questions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">
          Compare Drug Coverage Across Payers
        </h2>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Enter drug name (e.g., Botox, Myobloc)"
              value={drugSearch}
              onChange={(e) => setDrugSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={!drugSearch.trim() || isLoading}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                !drugSearch.trim() || isLoading
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Searching...' : 'Compare'}
            </button>
          </div>

          {/* Payer Filters */}
          {payers.length > 0 && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Filter by payer (optional):</p>
              <div className="flex flex-wrap gap-2">
                {payers.map((payer) => (
                  <label
                    key={payer.id}
                    className="inline-flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPayers.includes(payer.name)}
                      onChange={() => handlePayerToggle(payer.name)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{payer.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && <LoadingSkeleton />}

        {/* Empty State */}
        {!isLoading && !result && !error && (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-slate-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              Search for a drug to compare coverage
            </h3>
            <p className="text-slate-500">
              Enter a drug name above to see side-by-side coverage comparison across payers.
            </p>
          </div>
        )}

        {/* Results - No Data */}
        {!isLoading && result && result.payers.length === 0 && (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-slate-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              No coverage data found for &quot;{drugSearch}&quot;
            </h3>
            <p className="text-slate-500">
              Try uploading policy documents that contain this drug or search for a different drug.
            </p>
          </div>
        )}

        {/* Results - Comparison Table */}
        {!isLoading && result && result.payers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Coverage Comparison for{' '}
              <span className="text-blue-600">
                {Object.values(result.comparison)[0]?.drug_brand_name || Object.values(result.comparison)[0]?.drug_generic_name || drugSearch}
              </span>
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.payers.map((payerName) => {
                const data = result.comparison[payerName]
                return (
                  <div
                    key={payerName}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    {/* Payer Header */}
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-800">{payerName}</h4>
                      <p className="text-sm text-slate-500">{data.payer_type}</p>
                    </div>

                    {/* Coverage Details */}
                    <div className="p-6 space-y-4">
                      {/* Coverage Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Coverage Status</span>
                        <CoverageStatusBadge status={data.coverage_status || 'unknown'} />
                      </div>

                      {/* Prior Auth */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Prior Auth Required</span>
                        <span
                          className={`text-sm font-medium ${
                            data.requires_prior_auth ? 'text-orange-600' : 'text-green-600'
                          }`}
                        >
                          {data.requires_prior_auth ? 'Yes' : 'No'}
                        </span>
                      </div>

                      {/* Coverage Tier */}
                      {data.coverage_tier && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Coverage Tier</span>
                          <span className="text-sm font-medium text-slate-800">
                            {data.coverage_tier_detail || data.coverage_tier}
                          </span>
                        </div>
                      )}

                      {/* Indications Count */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Covered Indications</span>
                        <span className="text-sm font-medium text-slate-800">
                          {data.indications.filter((i) => i.coverage_status === 'covered').length}
                        </span>
                      </div>

                      {/* Approval Duration */}
                      {data.approval_duration_months && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Approval Duration</span>
                          <span className="text-sm font-medium text-slate-800">
                            {data.approval_duration_months} months
                          </span>
                        </div>
                      )}

                      {/* Step Therapy */}
                      {data.step_therapy.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-sm font-medium text-slate-700 mb-2">
                            Step Therapy Required
                          </p>
                          <div className="space-y-2">
                            {data.step_therapy.map((step, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-slate-50 rounded p-2"
                              >
                                <span className="font-medium">Step {step.step_order || step.order || idx + 1}:</span>{' '}
                                {(step.required_agents || []).join(' or ') || 'Requirements listed in policy'}
                                <span className="text-slate-500">
                                  {' '}
                                  ({step.reason || 'see policy'})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Policy Info */}
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500 truncate">{data.policy_title}</p>
                      {data.effective_date && (
                        <p className="text-xs text-slate-400">Effective: {data.effective_date}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
