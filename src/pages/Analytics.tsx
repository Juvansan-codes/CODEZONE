import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Clock, Target, Zap, Award, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAnalytics } from '@/hooks/useUserAnalytics';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { stats, performanceData, gameModeData, recentActivity, loading } = useUserAnalytics();

  const isPositiveTrend = stats.winRate > 50;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  // Slice performance data for the last 7 days for the "Weekly Progress" or similar view if needed
  // or just use the whole 30 days for the main trend
  const last7Days = performanceData.slice(-7);

  return (
    <div className="min-h-screen pb-10">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[70px] bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-50">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-2" size={16} />
          Back to Lobby
        </Button>
        <h1 className="font-orbitron text-xl font-bold text-primary flex items-center gap-2">
          <BarChart3 size={24} />
          ANALYTICS
        </h1>
        <div className="w-32" />
      </header>

      <main className="pt-[90px] px-4 max-w-6xl mx-auto space-y-8">

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Activity className="text-primary" size={24} />
              {isPositiveTrend ? (
                <TrendingUp className="text-green-400" size={20} />
              ) : (
                <TrendingDown className="text-red-400" size={20} />
              )}
            </div>
            <p className="text-3xl font-bold">{stats.winRate}%</p>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Target className="text-primary" size={24} />
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                Rank: {stats.rank}
              </span>
            </div>
            <p className="text-3xl font-bold">{stats.totalMatches}</p>
            <p className="text-sm text-muted-foreground">Total Matches</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Clock className="text-primary" size={24} />
            </div>
            <p className="text-3xl font-bold">{stats.avgSolveTime}s</p>
            <p className="text-sm text-muted-foreground">Avg Duration</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Zap className="text-gold" size={24} />
              <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">Total XP</span>
            </div>
            <p className="text-3xl font-bold">{stats.xp}</p>
            <p className="text-sm text-muted-foreground">Experience Points</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Over Time (XP Trend) */}
          <div className="glass-panel p-5">
            <h3 className="font-orbitron font-bold text-primary mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              XP Trend (Last 30 Days)
            </h3>
            <div className="h-[250px]">
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#68c3a3" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#68c3a3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4f" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#757893"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#757893"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151932',
                        border: '1px solid #2a2f4f',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#68c3a3' }}
                      labelStyle={{ color: '#fff', marginBottom: '0.5rem' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="xp"
                      stroke="#68c3a3"
                      strokeWidth={2}
                      fill="url(#colorXp)"
                      name="XP Earned"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              )}
            </div>
          </div>

          {/* Game Mode Distribution */}
          <div className="glass-panel p-5">
            <h3 className="font-orbitron font-bold text-primary mb-4 flex items-center gap-2">
              <Award size={20} />
              Game Modes Played
            </h3>
            <div className="h-[250px] flex items-center justify-center">
              {gameModeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gameModeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {gameModeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151932',
                        border: '1px solid #2a2f4f',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No matches played yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Weekly Activity (Matches Played) */}
        <div className="glass-panel p-5">
          <h3 className="font-orbitron font-bold text-primary mb-4">Daily Activity (Last 7 Days)</h3>
          <div className="h-[250px]">
            {last7Days.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4f" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="#757893"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#757893"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#2a2f4f', opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: '#151932',
                      border: '1px solid #2a2f4f',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="matches"
                    fill="#68c3a3"
                    radius={[4, 4, 0, 0]}
                    name="Matches Played"
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No activity in the last 7 days
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel p-5">
          <h3 className="font-orbitron font-bold text-primary mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg transition-colors hover:bg-black/30"
                >
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <span
                    className={`font-bold ${activity.type === 'success'
                        ? 'text-primary'
                        : activity.type === 'error'
                          ? 'text-red-400'
                          : 'text-gold'
                      }`}
                  >
                    {activity.points}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No recent activity found
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
