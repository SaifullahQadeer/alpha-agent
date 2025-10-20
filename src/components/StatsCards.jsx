import { TrendingUp, Users, DollarSign, Activity, ArrowUp, ArrowDown } from 'lucide-react'

function StatsCards() {
  const stats = [
    {
      title: 'Total Revenue',
      value: '$45,231',
      change: '+12.5%',
      isPositive: true,
      icon: DollarSign,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Active Users',
      value: '2,845',
      change: '+18.2%',
      isPositive: true,
      icon: Users,
      gradient: 'from-green-500 to-green-600',
    },
    {
      title: 'Performance',
      value: '94.3%',
      change: '+5.1%',
      isPositive: true,
      icon: Activity,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Growth Rate',
      value: '8.2%',
      change: '-2.3%',
      isPositive: false,
      icon: TrendingUp,
      gradient: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <div
            key={index}
            className="stat-card animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`bg-gradient-to-br ${stat.gradient}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.isPositive ? (
                      <ArrowUp className="w-4 h-4" />
                    ) : (
                      <ArrowDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-semibold">{stat.change}</span>
                    <span className="text-sm text-white/80">vs last month</span>
                  </div>
                </div>
                <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatsCards
