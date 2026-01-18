import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Clock, Target, Zap, Award, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/contexts/GameContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const performanceData = [
  { day: 'Mon', score: 1200, matches: 5 },
  { day: 'Tue', score: 1350, matches: 7 },
  { day: 'Wed', score: 1100, matches: 4 },
  { day: 'Thu', score: 1500, matches: 8 },
  { day: 'Fri', score: 1650, matches: 6 },
  { day: 'Sat', score: 1800, matches: 9 },
  { day: 'Sun', score: 2100, matches: 10 },
];

const categoryData = [
  { name: 'Arrays', value: 35, color: '#68c3a3' },
  { name: 'Strings', value: 25, color: '#4a9d7f' },
  { name: 'Trees', value: 20, color: '#ff4655' },
  { name: 'Graphs', value: 12, color: '#fbbf24' },
  { name: 'DP', value: 8, color: '#3b82f6' },
];

const weeklyProgress = [
  { week: 'W1', problems: 12, time: 180 },
  { week: 'W2', problems: 18, time: 220 },
  { week: 'W3', problems: 15, time: 190 },
  { week: 'W4', problems: 24, time: 280 },
];

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { gameData } = useGame();

  const winRate = gameData.stats.winRate;
  const isPositiveTrend = winRate > 40;

  return (
    <div className="min-h-screen">
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

      <main className="pt-[90px] pb-10 px-4 max-w-6xl mx-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Activity className="text-primary" size={24} />
              {isPositiveTrend ? (
                <TrendingUp className="text-green-400" size={20} />
              ) : (
                <TrendingDown className="text-red-400" size={20} />
              )}
            </div>
            <p className="text-3xl font-bold">{gameData.stats.winRate}%</p>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Target className="text-primary" size={24} />
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">+12%</span>
            </div>
            <p className="text-3xl font-bold">{gameData.stats.matches}</p>
            <p className="text-sm text-muted-foreground">Total Matches</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Clock className="text-primary" size={24} />
            </div>
            <p className="text-3xl font-bold">24h</p>
            <p className="text-sm text-muted-foreground">Avg Solve Time</p>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <Zap className="text-gold" size={24} />
              <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">🔥 Hot</span>
            </div>
            <p className="text-3xl font-bold">7</p>
            <p className="text-sm text-muted-foreground">Current Streak</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Performance Over Time */}
          <div className="glass-panel p-5">
            <h3 className="font-orbitron font-bold text-primary mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Performance Trend
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#68c3a3" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#68c3a3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4f" />
                  <XAxis dataKey="day" stroke="#757893" fontSize={12} />
                  <YAxis stroke="#757893" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151932',
                      border: '1px solid #2a2f4f',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#68c3a3"
                    strokeWidth={2}
                    fill="url(#colorScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Problem Categories */}
          <div className="glass-panel p-5">
            <h3 className="font-orbitron font-bold text-primary mb-4 flex items-center gap-2">
              <Award size={20} />
              Problem Categories
            </h3>
            <div className="h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
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
            </div>
          </div>
        </div>

        {/* Weekly Progress */}
        <div className="glass-panel p-5 mb-8">
          <h3 className="font-orbitron font-bold text-primary mb-4">Weekly Progress</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4f" />
                <XAxis dataKey="week" stroke="#757893" fontSize={12} />
                <YAxis yAxisId="left" stroke="#757893" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#757893" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#151932',
                    border: '1px solid #2a2f4f',
                    borderRadius: '8px',
                  }}
                />
                <Bar yAxisId="left" dataKey="problems" fill="#68c3a3" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="time" fill="#ff4655" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-primary rounded" />
              Problems Solved
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-accent rounded" />
              Time Spent (min)
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel p-5">
          <h3 className="font-orbitron font-bold text-primary mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: 'Solved "Two Sum"', time: '2 hours ago', points: '+50', type: 'success' },
              { action: 'Lost match vs CodePhantom', time: '4 hours ago', points: '-15', type: 'error' },
              { action: 'Won match vs ByteStorm', time: '6 hours ago', points: '+100', type: 'success' },
              { action: 'Completed Daily Challenge', time: '8 hours ago', points: '+75', type: 'success' },
              { action: 'Ranked up to Grandmaster', time: '1 day ago', points: '+200', type: 'gold' },
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
              >
                <div>
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                <span
                  className={`font-bold ${
                    activity.type === 'success'
                      ? 'text-primary'
                      : activity.type === 'error'
                      ? 'text-accent'
                      : 'text-gold'
                  }`}
                >
                  {activity.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
