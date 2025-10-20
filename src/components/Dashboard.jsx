import { useState, useEffect } from 'react'
import StatsCards from './StatsCards'
import ChartsSection from './ChartsSection'
import AIInsights from './AIInsights'
import RecentActivity from './RecentActivity'

function Dashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 800)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <button className="btn-primary">
            Generate Report
          </button>
        </div>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ChartsSection />
        </div>
        <div>
          <AIInsights />
        </div>
      </div>

      <RecentActivity />
    </div>
  )
}

export default Dashboard
