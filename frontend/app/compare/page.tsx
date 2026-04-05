'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import DrugComparisonReal, { PayerComparison } from '@/components/DrugComparisonReal'

interface Payer {
  id: string
  name: string
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 bg-slate-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
        </div>
        <div className="h-10 bg-slate-200 rounded w-80"></div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-64">
            <div className="h-6 bg-slate-200 rounded w-20 mb-4"></div>
            <div className="h-5 bg-slate-200 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-full mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Empty state with example chips
function EmptyState({ onSelectDrug }: { onSelectDrug: (drug: string) => void }) {
  const exampleDrugs = ['Botox', 'Dysport', 'Rituximab']

  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Search className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-700 mb-2">
        Search for a drug to compare coverage
      </h3>
      <p className="text-slate-500 mb-6">
        Enter a drug name above to see side-by-side coverage comparison across payers.
      </p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-slate-500">Try:</span>
        {exampleDrugs.map((drug) => (
          <button
            key={drug}
            onClick={() => onSelectDrug(drug)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            {drug}
          </button>
        ))}
      </div>
    </div>
  )
}

// No results state
function NoResults({ drugName }: { drugName: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Search className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-700 mb-2">
        No coverage data found for &quot;{drugName}&quot;
      </h3>
      <p className="text-slate-500">
        Try searching for a different drug or check back later.
      </p>
    </div>
  )
}

export default function ComparePage() {
  const [drugSearch, setDrugSearch] = useState('')
  const [searchedDrug, setSearchedDrug] = useState('')
  const [payers, setPayers] = useState<Payer[]>([])
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [results, setResults] = useState<PayerComparison[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch payers on mount
  useEffect(() => {
    const fetchPayers = async () => {
      try {
        const res = await fetch('/api/payers')
        if (res.ok) {
          const data = await res.json()
          setPayers(data)
          // Select all payers by default
          setSelectedPayers(data.map((p: Payer) => p.name))
        }
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

  const handleSearch = async (drugName?: string) => {
    const drug = drugName || drugSearch
    if (!drug.trim()) return

    setIsLoading(true)
    setError(null)
    setSearchedDrug(drug)
    if (drugName) setDrugSearch(drugName)

    try {
      const params = new URLSearchParams({ drug })
      if (selectedPayers.length > 0 && selectedPayers.length < payers.length) {
        params.set('payers', selectedPayers.join(','))
      }

      const res = await fetch(`/api/compare?${params}`)
      if (!res.ok) {
        throw new Error('Failed to fetch comparison data')
      }

      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setResults(null)
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
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">
          Compare Drug Coverage Across Payers
        </h1>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Enter drug name (e.g., Botox, Dysport)"
                value={drugSearch}
                onChange={(e) => setDrugSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={!drugSearch.trim() || isLoading}
              className={`px-6 py-2.5 rounded-lg font-medium text-white transition-colors ${
                !drugSearch.trim() || isLoading
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Payer Filters */}
          {payers.length > 0 && (
            <div>
              <p className="text-sm text-slate-600 mb-2">Filter by payer:</p>
              <div className="flex flex-wrap gap-3">
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
        {!isLoading && !results && !error && (
          <EmptyState onSelectDrug={(drug) => handleSearch(drug)} />
        )}

        {/* No Results */}
        {!isLoading && results && results.length === 0 && (
          <NoResults drugName={searchedDrug} />
        )}

        {/* Results */}
        {!isLoading && results && results.length > 0 && (
          <DrugComparisonReal drugName={searchedDrug} data={results} />
        )}
      </main>
    </div>
  )
}
