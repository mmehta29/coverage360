'use client'
import { useState, useEffect } from 'react'
import { Search, ArrowRight } from 'lucide-react'

const FULL_TEXT = 'What drug do you want to search?'

export default function WelcomePage({ onGetStarted }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(FULL_TEXT.slice(0, i))
      if (i === FULL_TEXT.length) clearInterval(interval)
    }, 45)
    return () => clearInterval(interval)
  }, [])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onGetStarted(searchQuery.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 pt-16 relative overflow-hidden" style={{background:'#faf8f5'}}>
      {/* Watercolor washes */}
      <div className="absolute" style={{top:'-80px',left:'-60px',width:'600px',height:'600px',borderRadius:'60% 40% 55% 45% / 50% 60% 40% 55%',background:'radial-gradient(ellipse, rgba(255,160,60,0.38) 0%, rgba(255,120,30,0.18) 50%, transparent 75%)',filter:'blur(40px)',mixBlendMode:'multiply'}} />
      <div className="absolute" style={{top:'10%',right:'-80px',width:'550px',height:'650px',borderRadius:'45% 55% 40% 60% / 60% 40% 55% 45%',background:'radial-gradient(ellipse, rgba(100,180,230,0.35) 0%, rgba(60,140,210,0.18) 50%, transparent 75%)',filter:'blur(50px)',mixBlendMode:'multiply'}} />
      <div className="absolute" style={{bottom:'-60px',left:'30%',width:'580px',height:'500px',borderRadius:'55% 45% 60% 40% / 45% 55% 40% 60%',background:'radial-gradient(ellipse, rgba(220,60,140,0.28) 0%, rgba(200,40,120,0.14) 50%, transparent 75%)',filter:'blur(45px)',mixBlendMode:'multiply'}} />
      <div className="absolute" style={{top:'40%',left:'20%',width:'400px',height:'400px',borderRadius:'50%',background:'radial-gradient(ellipse, rgba(255,200,80,0.2) 0%, transparent 70%)',filter:'blur(60px)',mixBlendMode:'multiply'}} />
      <div className="absolute" style={{bottom:'10%',right:'15%',width:'350px',height:'350px',borderRadius:'50%',background:'radial-gradient(ellipse, rgba(80,160,220,0.22) 0%, transparent 70%)',filter:'blur(55px)',mixBlendMode:'multiply'}} />

{/* Main Content Grid */}
      <div className="max-w-7xl ml-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10 animate-fade-in">
        
        {/* Left Side - Content */}
        <div className="space-y-8">
          {/* Headline */}
          <div>
            <h1 className="text-6xl font-bold text-[#15173f] leading-tight mb-4">
              {displayed.slice(0, Math.min(displayed.length, 17))}
              {displayed.length > 17 && (
                <>
                  <br />
                  <span className="text-[#3e5161]">{displayed.slice(17)}</span>
                </>
              )}
              {displayed.length < FULL_TEXT.length && <span className="animate-pulse">|</span>}
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
                    className="px-6 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 group" style={{background:'rgba(255,255,255,0.35)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'1.5px solid rgba(255,255,255,0.6)',color:'#15173f',boxShadow:'0 4px 16px rgba(100,120,160,0.1),inset 0 1px 0 rgba(255,255,255,0.7)'}}
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
              <div className="text-3xl font-bold text-[#3e5161]">AI</div>
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
            className="relative z-10 animate-fade-in-slow"
            style={{
              width: '140%',
              height: 'auto',
              filter: 'drop-shadow(0 20px 40px rgba(62, 81, 97, 0.15))'
            }}
          />
        </div>
      </div>

      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between z-10" style={{height:'64px',padding:'0 28px'}}>
        <img src="/logo.png" alt="Coverage360" style={{height:'120px',width:'auto'}} />
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-full bg-white border border-[#e2e8f0] text-[#3e5161] text-xs font-medium hover:bg-[#f7f9fc] hover:border-[#91bfeb] transition-all">
            Sign In
          </button>
          <button className="px-4 py-2 rounded-full text-xs font-medium transition-all" style={{background:'rgba(255,255,255,0.35)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'1.5px solid rgba(255,255,255,0.6)',color:'#15173f',boxShadow:'0 4px 16px rgba(100,120,160,0.1),inset 0 1px 0 rgba(255,255,255,0.7)'}}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
