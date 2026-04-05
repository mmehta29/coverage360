'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Grid2x2, BarChart3, PieChart as PieChartIcon, Table2, Check, X, AlertCircle, Download } from 'lucide-react'

// Types
export interface PayerComparison {
  payer: string
  policyTitle: string
  effectiveDate: string
  coverageStatus: 'covered' | 'not_covered' | 'unproven'
  tier: string | null
  tierDetail: string | null
  requiresPriorAuth: boolean
  priorAuthCriteria: string[]
  stepTherapy: string[]
  coveredIndications: string[]
  siteOfCare: string | null
  dosingNotes: string | null
  approvalDurationMonths: number | null
  limitations: string[]
}

interface DrugComparisonProps {
  drugName: string
  data: PayerComparison[]
}

type ViewMode = 'cards' | 'bar' | 'pie' | 'table'

// Coverage status badge component
function CoverageStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    covered: 'bg-green-100 text-green-800',
    not_covered: 'bg-red-100 text-red-800',
    unproven: 'bg-yellow-100 text-yellow-800',
  }
  const labels: Record<string, string> = {
    covered: 'Covered',
    not_covered: 'Not Covered',
    unproven: 'Unproven',
  }
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}

// Calculate access burden score
function calculateBurdenScore(item: PayerComparison): number {
  let score = 0
  if (item.requiresPriorAuth) score += 30
  if (item.stepTherapy.length > 0) score += 40
  if (item.coverageStatus === 'not_covered') score += 30
  return score
}

// Cards View
function CardsView({ data }: { data: PayerComparison[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.map((item, idx) => (
        <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <CoverageStatusBadge status={item.coverageStatus} />
              {item.tierDetail && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  {item.tierDetail}
                </span>
              )}
            </div>
            <h4 className="font-semibold text-slate-800 text-lg">{item.payer}</h4>
            <p className="text-sm text-slate-500 truncate">{item.policyTitle}</p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Prior Auth */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-700">Prior Authorization</span>
                {item.requiresPriorAuth ? (
                  <X className="w-4 h-4 text-red-500" />
                ) : (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </div>
              {item.requiresPriorAuth && item.priorAuthCriteria.length > 0 && (
                <ul className="text-xs text-slate-600 ml-4 list-disc">
                  {item.priorAuthCriteria.slice(0, 2).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  {item.priorAuthCriteria.length > 2 && (
                    <li className="text-slate-400">+{item.priorAuthCriteria.length - 2} more</li>
                  )}
                </ul>
              )}
              {!item.requiresPriorAuth && (
                <p className="text-xs text-green-600">Not required</p>
              )}
            </div>

            {/* Step Therapy */}
            <div>
              <span className="text-sm font-medium text-slate-700 block mb-1">Step Therapy</span>
              {item.stepTherapy.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {item.stepTherapy.map((step, i) => (
                    <span key={i} className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs">
                      {step}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">None required</p>
              )}
            </div>

            {/* Covered Indications */}
            <div>
              <span className="text-sm font-medium text-slate-700 block mb-1">Covered Indications</span>
              {item.coveredIndications.length > 0 ? (
                <ul className="text-xs text-slate-600 list-disc ml-4">
                  {item.coveredIndications.slice(0, 4).map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                  {item.coveredIndications.length > 4 && (
                    <li className="text-slate-400">+{item.coveredIndications.length - 4} more</li>
                  )}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No indications listed</p>
              )}
            </div>

            {/* Site of Care */}
            {item.siteOfCare && (
              <div>
                <span className="text-sm font-medium text-slate-700 block mb-1">Site of Care</span>
                <p className="text-xs text-slate-600">{item.siteOfCare}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Effective: {item.effectiveDate || 'Not specified'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Bar Chart View
function BarChartView({ data }: { data: PayerComparison[] }) {
  const chartData = data.map(item => ({
    payer: item.payer,
    score: calculateBurdenScore(item),
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Access Burden by Payer</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'Access Burden Score (0-100)', position: 'bottom', offset: -5 }}
            />
            <YAxis type="category" dataKey="payer" width={90} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Burden Score']}
              labelFormatter={(label) => `Payer: ${label}`}
            />
            <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg">
        <p className="text-sm font-medium text-slate-700 mb-2">Score Calculation:</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span>+30 if prior auth required</span>
          <span>+40 if step therapy required</span>
          <span>+30 if not covered</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">Lower score = easier access</p>
      </div>
    </div>
  )
}

// Pie Chart View
function PieChartView({ data }: { data: PayerComparison[] }) {
  const covered = data.filter(d => d.coverageStatus === 'covered')
  const unproven = data.filter(d => d.coverageStatus === 'unproven')
  const notCovered = data.filter(d => d.coverageStatus === 'not_covered')

  const pieData = [
    { name: 'Covered', value: covered.length, color: '#22c55e' },
    { name: 'Unproven', value: unproven.length, color: '#eab308' },
    { name: 'Not Covered', value: notCovered.length, color: '#ef4444' },
  ].filter(d => d.value > 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Coverage Status Across Payers</h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Payer lists */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-2">Covered ({covered.length})</p>
          <ul className="text-xs text-green-700 space-y-1">
            {covered.map((p, i) => <li key={i}>{p.payer}</li>)}
            {covered.length === 0 && <li className="text-green-500">None</li>}
          </ul>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-2">Unproven ({unproven.length})</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            {unproven.map((p, i) => <li key={i}>{p.payer}</li>)}
            {unproven.length === 0 && <li className="text-yellow-500">None</li>}
          </ul>
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          <p className="text-sm font-medium text-red-800 mb-2">Not Covered ({notCovered.length})</p>
          <ul className="text-xs text-red-700 space-y-1">
            {notCovered.map((p, i) => <li key={i}>{p.payer}</li>)}
            {notCovered.length === 0 && <li className="text-red-500">None</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Table View
function TableView({ data }: { data: PayerComparison[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Payer</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Policy Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Effective</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Prior Auth</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Step Therapy</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Indications</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.payer}</td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-48 truncate">{item.policyTitle}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.effectiveDate || '—'}</td>
                <td className="px-4 py-3">
                  <CoverageStatusBadge status={item.coverageStatus} />
                </td>
                <td className="px-4 py-3 text-center">
                  {item.requiresPriorAuth ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.stepTherapy.length > 0 ? (
                    <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs">
                      {item.stepTherapy.length} step{item.stepTherapy.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-sm">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-500 text-sm">
                    {item.coveredIndications.length} indication{item.coveredIndications.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {item.tierDetail || item.tier || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Export CSV function
function exportCsv(drugName: string, data: PayerComparison[]) {
  const header = 'Payer,Policy Title,Effective Date,Coverage Status,Prior Auth,Step Therapy,Indications,Tier\n'
  const body = data.map(r =>
    `"${r.payer}","${r.policyTitle}","${r.effectiveDate || ''}","${r.coverageStatus}","${r.requiresPriorAuth ? 'Yes' : 'No'}","${r.stepTherapy.join('; ')}","${r.coveredIndications.join('; ')}","${r.tierDetail || r.tier || ''}"`
  ).join('\n')

  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${drugName}-coverage-comparison.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Main component
export default function DrugComparisonReal({ drugName, data }: DrugComparisonProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const viewModes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'cards', label: 'Cards', icon: <Grid2x2 className="w-4 h-4" /> },
    { id: 'bar', label: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'pie', label: 'Pie Chart', icon: <PieChartIcon className="w-4 h-4" /> },
    { id: 'table', label: 'Table', icon: <Table2 className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Results for "{drugName}"
          </h2>
          <p className="text-sm text-slate-500">{data.length} plans found</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {viewModes.map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {mode.icon}
                {mode.label}
              </button>
            ))}
          </div>

          {/* Export button */}
          <button
            onClick={() => exportCsv(drugName, data)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Content - fixed min-height to prevent layout shifts */}
      <div className="min-h-[500px]">
        {viewMode === 'cards' && <CardsView data={data} />}
        {viewMode === 'bar' && <BarChartView data={data} />}
        {viewMode === 'pie' && <PieChartView data={data} />}
        {viewMode === 'table' && <TableView data={data} />}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          This is sample data. Actual costs and coverage may vary based on your specific plan, pharmacy, and dosage. Please verify with your insurance provider.
        </p>
      </div>
    </div>
  )
}
