'use client'
import { useState } from 'react'
import { Search, FileText, TrendingUp, ArrowRight } from 'lucide-react'

export default function WelcomePage({ onGetStarted }) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onGetStarted()
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8 relative overflow-hidden">
      {/* Gradient glow effects - subtle */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#91bfeb] rounded-full mix-blend-multiply filter blur-[150px] opacity-20" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#3e5161] rounded-full mix-blend-multiply filter blur-[150px] opacity-10" />

      {/* Sidebar Icons */}
      <div className="fixed left-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10">
        <button className="w-12 h-12 rounded-2xl bg-[#f7f9fc] border border-[#e2e8f0] flex items-center justify-center hover:bg-[#91bfeb]/10 hover:border-[#91bfeb] transition-all shadow-sm">
          <Search size={20} className="text-[#3e5161]" />
        </button>
        <button className="w-12 h-12 rounded-2xl bg-[#f7f9fc] border border-[#e2e8f0] flex items-center justify-center hover:bg-[#91bfeb]/10 hover:border-[#91bfeb] transition-all shadow-sm">
          <FileText size={20} className="text-[#3e5161]" />
        </button>
        <button className="w-12 h-12 rounded-2xl bg-[#f7f9fc] border border-[#e2e8f0] flex items-center justify-center hover:bg-[#91bfeb]/10 hover:border-[#91bfeb] transition-all shadow-sm">
          <TrendingUp size={20} className="text-[#3e5161]" />
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        
        {/* Left Side - Content */}
        <div className="space-y-8">
          {/* Logo */}
          <div className="mb-4">
            <div className="inline-flex items-baseline gap-0">
              <span className="font-serif text-2xl font-medium text-[#15173f]">Coverage</span>
              <span className="font-serif text-2xl font-normal text-[#91bfeb]">360</span>
            </div>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-6xl font-bold text-[#15173f] leading-tight mb-4">
              What drug do you
              <br />
              <span className="text-[#91bfeb]">
                want to search?
              </span>
            </h1>
            <p className="text-lg text-[#3e5161] font-light">
              Search across 847 policies from 3 major payers.
              <br />
              Get instant coverage insights powered by AI.
            </p>
          </div>

          {/* Search Input */}
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-[#91bfeb] rounded-2xl opacity-0 group-hover:opacity-20 blur transition duration-300" />
              <div className="relative bg-white rounded-2xl border-2 border-[#e2e8f0] group-hover:border-[#91bfeb] transition-all p-1.5 shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Search size={20} className="text-[#3e5161]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Drug name, generic name, or J-code..."
                    className="flex-1 bg-transparent text-[#15173f] placeholder:text-[#3e5161]/40 text-lg outline-none"
                  />
                  <button 
                    onClick={handleSearch}
                    className="px-6 py-2.5 rounded-xl bg-[#3e5161] text-white font-medium hover:shadow-lg hover:shadow-[#3e5161]/30 transition-all flex items-center gap-2 group"
                  >
                    Search
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Search Suggestions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#3e5161]">Try:</span>
              {['Rituximab', 'Adalimumab', 'Bevacizumab'].map((drug) => (
                <button
                  key={drug}
                  onClick={() => setSearchQuery(drug)}
                  className="px-3 py-1.5 rounded-lg bg-[#f7f9fc] border border-[#e2e8f0] text-[#3e5161] text-xs hover:bg-[#91bfeb] hover:text-white hover:border-[#91bfeb] transition-all"
                >
                  {drug}
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-6 pt-4">
            <div className="space-y-1">
              <div className="text-3xl font-bold text-[#15173f]">847</div>
              <div className="text-xs text-[#3e5161]">Policies Indexed</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-[#15173f]">3</div>
              <div className="text-xs text-[#3e5161]">Major Payers</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-[#91bfeb]">AI</div>
              <div className="text-xs text-[#3e5161]">Powered Search</div>
            </div>
          </div>
        </div>

        {/* Right Side - Nurse Character */}
        <div className="relative flex items-center justify-center lg:justify-end overflow-visible">
          <div className="absolute w-[500px] h-[500px] bg-[#91bfeb]/10 rounded-full filter blur-[100px]" />
          <img
            src="/nurse.png"
            alt="Medical Professional"
            className="relative z-10"
            style={{
              width: '140%',
              height: 'auto',
              filter: 'drop-shadow(0 20px 40px rgba(62, 81, 97, 0.15))'
            }}
          />
        </div>
      </div>

      {/* Top Right Actions */}
      <div className="fixed top-8 right-8 flex items-center gap-3 z-10">
        <button className="px-4 py-2 rounded-full bg-white border border-[#e2e8f0] text-[#3e5161] text-xs font-medium hover:bg-[#f7f9fc] hover:border-[#91bfeb] transition-all">
          Sign In
        </button>
        <button className="px-4 py-2 rounded-full bg-[#3e5161] text-white text-xs font-medium hover:shadow-lg hover:shadow-[#3e5161]/30 transition-all">
          Get Started
        </button>
      </div>

      {/* Bottom Info */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-xs text-[#3e5161]/60 font-light z-10">
        Powered by Claude AI · HIPAA-aligned · Updated Apr 2026
      </div>
    </div>
  )
}
