import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, MessageSquare } from 'lucide-react'
import geminiService from '../services/geminiService'

function AIInsights() {
  const [insights, setInsights] = useState('')
  const [loading, setLoading] = useState(true)
  const [chatMode, setChatMode] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    setLoading(true)
    try {
      const stats = {
        revenue: '$45,231',
        users: 2845,
        performance: '94.3%',
        growth: '8.2%',
      }
      const summary = await geminiService.getDashboardSummary(stats)
      setInsights(summary)
    } catch (error) {
      setInsights('AI insights temporarily unavailable. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatHistory([...chatHistory, { role: 'user', text: userMessage }])

    try {
      const response = await geminiService.sendMessage(userMessage)
      setChatHistory((prev) => [...prev, { role: 'ai', text: response }])
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' },
      ])
    }
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h3 className="text-xl font-bold text-gray-800">AI Insights</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChatMode(!chatMode)}
            className={`p-2 rounded-lg transition-colors ${
              chatMode ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Toggle chat mode"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          {!chatMode && (
            <button
              onClick={loadInsights}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={loading}
              title="Refresh insights"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {!chatMode ? (
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                <p className="text-gray-700 leading-relaxed">{insights}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-700">Quick Actions</h4>
                <button className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all">
                  <span className="text-sm font-medium text-gray-800">Analyze user behavior</span>
                </button>
                <button className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all">
                  <span className="text-sm font-medium text-gray-800">Predict next month trends</span>
                </button>
                <button className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all">
                  <span className="text-sm font-medium text-gray-800">Generate recommendations</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-400 mt-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Start a conversation with AI</p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-100 ml-8'
                      : 'bg-purple-50 mr-8'
                  }`}
                >
                  <p className="text-sm text-gray-800">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default AIInsights
