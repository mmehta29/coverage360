'use client'

import { useState } from 'react'
import Link from 'next/link'
import { askCoverageQuestion } from '@/lib/api'

interface QueryResult {
  answer: string
  sources: string[]
}

const EXAMPLE_QUESTIONS = [
  'Does UHC cover Botox for chronic migraine?',
  'What step therapy does UHC require for Myobloc?',
  'Which payers require prior auth for Botox?',
  'What are the PA criteria for botulinum toxin coverage?',
]

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (q?: string) => {
    const queryQuestion = q || question
    if (!queryQuestion.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await askCoverageQuestion(queryQuestion)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion)
    handleSubmit(exampleQuestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
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
            className="text-slate-600 font-medium hover:text-blue-600"
          >
            Compare Coverage
          </Link>
          <Link
            href="/ask"
            className="text-blue-600 font-medium hover:text-blue-800"
          >
            Ask Questions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">
          Ask Questions About Drug Coverage
        </h2>

        {/* Question Input */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <textarea
            placeholder="Ask a question about drug coverage policies..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleSubmit()}
              disabled={!question.trim() || isLoading}
              className={`px-6 py-2.5 rounded-lg font-medium text-white transition-colors ${
                !question.trim() || isLoading
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Ask Question'
              )}
            </button>
          </div>
        </div>

        {/* Example Questions */}
        <div className="mb-8">
          <p className="text-sm text-slate-600 mb-3">Try an example question:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((eq, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(eq)}
                disabled={isLoading}
                className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {eq}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Answer Card */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <h3 className="font-semibold text-purple-800">AI Answer</h3>
              </div>
            </div>

            <div className="p-6">
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {result.answer}
                </p>
              </div>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-600 mb-2">
                    Sources:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.map((source, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !error && !isLoading && (
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
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              Ask anything about drug coverage
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Get instant answers about coverage status, prior authorization requirements,
              step therapy, and more based on uploaded policy documents.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
