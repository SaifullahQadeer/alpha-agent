import { Clock, CheckCircle, AlertCircle, Info, TrendingUp } from 'lucide-react'

function RecentActivity() {
  const activities = [
    {
      id: 1,
      type: 'success',
      icon: CheckCircle,
      title: 'New user registration',
      description: '5 new users signed up in the last hour',
      time: '5 min ago',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      id: 2,
      type: 'info',
      icon: TrendingUp,
      title: 'Revenue milestone achieved',
      description: 'Monthly revenue exceeded $45,000',
      time: '1 hour ago',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 3,
      type: 'warning',
      icon: AlertCircle,
      title: 'High server load detected',
      description: 'Server CPU usage reached 85%',
      time: '2 hours ago',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      id: 4,
      type: 'info',
      icon: Info,
      title: 'System update available',
      description: 'New version 2.5.0 is ready to install',
      time: '3 hours ago',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      id: 5,
      type: 'success',
      icon: CheckCircle,
      title: 'Backup completed',
      description: 'Daily database backup finished successfully',
      time: '5 hours ago',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-6 h-6 text-gray-600" />
          <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon
          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className={`${activity.bgColor} p-3 rounded-lg`}>
                <Icon className={`w-5 h-5 ${activity.color}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">{activity.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentActivity
