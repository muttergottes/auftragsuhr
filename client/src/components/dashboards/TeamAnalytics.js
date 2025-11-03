import React, { useState, useEffect } from 'react';
import { 
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { reportsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TeamAnalytics = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamData, setTeamData] = useState([]);
  const [teamSummary, setTeamSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('attendance_efficiency');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (user?.role !== 'employee') {
      setDefaultDates();
    }
  }, [user, period]);

  useEffect(() => {
    if (startDate && endDate) {
      loadTeamAnalytics();
    }
  }, [startDate, endDate, sortBy, sortOrder]);

  const setDefaultDates = () => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        setStartDate(formatDate(today));
        setEndDate(formatDate(today));
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        setStartDate(formatDate(weekStart));
        setEndDate(formatDate(today));
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(formatDate(monthStart));
        setEndDate(formatDate(today));
        break;
      case 'quarter':
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        setStartDate(formatDate(quarterStart));
        setEndDate(formatDate(today));
        break;
    }
  };

  const loadTeamAnalytics = async () => {
    setLoading(true);
    try {
      // Load team performance data
      const teamResponse = await fetch('/api/performance/team-ranking?' + new URLSearchParams({
        period: 'custom',
        startDate,
        endDate
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!teamResponse.ok) throw new Error('Failed to load team data');
      const teamResult = await teamResponse.json();
      
      // Sort team data
      const sortedData = [...(teamResult.data || [])].sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
      
      setTeamData(sortedData);
      
      // Calculate team summary
      if (sortedData.length > 0) {
        const summary = {
          totalMembers: sortedData.length,
          activeMembers: sortedData.filter(m => m.total_attendance_minutes > 0).length,
          avgAttendanceEfficiency: sortedData.reduce((sum, m) => sum + m.attendance_efficiency, 0) / sortedData.length,
          avgWorkProductivity: sortedData.reduce((sum, m) => sum + m.work_productivity, 0) / sortedData.length,
          totalAttendanceHours: sortedData.reduce((sum, m) => sum + (m.total_attendance_minutes / 60), 0),
          totalBillableHours: sortedData.reduce((sum, m) => sum + (m.billable_minutes / 60), 0),
          topPerformer: sortedData[0],
          needsAttention: sortedData.filter(m => m.attendance_efficiency < 70 || m.work_productivity < 60)
        };
        setTeamSummary(summary);
      }
      
    } catch (error) {
      console.error('Error loading team analytics:', error);
      toast.error('Fehler beim Laden der Team-Analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return '0h';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatPercentage = (value) => {
    return `${Math.round(value || 0)}%`;
  };

  const getPerformanceColor = (value, thresholds = { high: 85, medium: 70 }) => {
    if (value >= thresholds.high) return 'text-green-600';
    if (value >= thresholds.medium) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (value, thresholds = { high: 85, medium: 70 }) => {
    if (value >= thresholds.high) return 'bg-green-100 text-green-800';
    if (value >= thresholds.medium) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStars = (efficiency) => {
    if (efficiency >= 95) return 5;
    if (efficiency >= 85) return 4;
    if (efficiency >= 75) return 3;
    if (efficiency >= 65) return 2;
    return 1;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortButton = ({ field, children }) => (
    <button 
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
    >
      <span>{children}</span>
      {sortBy === field && (
        sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
      )}
    </button>
  );

  if (user?.role === 'employee') {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
        <p className="text-gray-600">Zugriff nur für Dispatcher und Administratoren</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-primary-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Analytics</h1>
              <p className="text-gray-600">Detaillierte Team-Performance-Analyse</p>
            </div>
          </div>
          <button
            onClick={loadTeamAnalytics}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Zeitraum</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="form-input"
            >
              <option value="today">Heute</option>
              <option value="week">Diese Woche</option>
              <option value="month">Dieser Monat</option>
              <option value="quarter">Dieses Quartal</option>
              <option value="custom">Benutzerdefiniert</option>
            </select>
          </div>
          <div>
            <label className="form-label">Von</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Bis</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Sortierung</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-input"
            >
              <option value="attendance_efficiency">Anwesenheits-Effizienz</option>
              <option value="work_productivity">Arbeits-Produktivität</option>
              <option value="total_attendance_minutes">Anwesenheitszeit</option>
              <option value="billable_minutes">Abrechenbare Zeit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team Summary Cards */}
      {teamSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Team-Größe</h3>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{teamSummary.totalMembers}</div>
            <div className="text-sm text-gray-600">
              {teamSummary.activeMembers} aktiv heute
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Ø Anwesenheits-Effizienz</h3>
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div className={`text-2xl font-bold ${getPerformanceColor(teamSummary.avgAttendanceEfficiency)}`}>
              {formatPercentage(teamSummary.avgAttendanceEfficiency)}
            </div>
            <div className="text-sm text-gray-600">Team-Durchschnitt</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Ø Arbeits-Produktivität</h3>
              <Activity className="w-5 h-5 text-purple-500" />
            </div>
            <div className={`text-2xl font-bold ${getPerformanceColor(teamSummary.avgWorkProductivity, { high: 80, medium: 60 })}`}>
              {formatPercentage(teamSummary.avgWorkProductivity)}
            </div>
            <div className="text-sm text-gray-600">Team-Durchschnitt</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Aufmerksamkeit erforderlich</h3>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{teamSummary.needsAttention.length}</div>
            <div className="text-sm text-gray-600">Mitarbeiter unter Ziel</div>
          </div>
        </div>
      )}

      {/* Top Performer Highlight */}
      {teamSummary?.topPerformer && (
        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Award className="w-8 h-8 text-yellow-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">
                  🏆 Top Performer: {teamSummary.topPerformer.first_name} {teamSummary.topPerformer.last_name}
                </h3>
                <p className="text-yellow-700">
                  Anwesenheits-Effizienz: {formatPercentage(teamSummary.topPerformer.attendance_efficiency)} • 
                  Arbeits-Produktivität: {formatPercentage(teamSummary.topPerformer.work_productivity)}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {[...Array(getStars(teamSummary.topPerformer.attendance_efficiency))].map((_, i) => (
                <span key={i} className="text-yellow-500 text-xl">⭐</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Detaillierte Team-Performance
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <SortButton field="first_name">Mitarbeiter</SortButton>
                </th>
                <th className="px-6 py-3 text-left">
                  Performance Rating
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton field="total_attendance_minutes">Anwesenheit</SortButton>
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton field="attendance_efficiency">Anwesenheits-Effizienz</SortButton>
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton field="work_productivity">Arbeits-Produktivität</SortButton>
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton field="billable_minutes">Abrechenbar</SortButton>
                </th>
                <th className="px-6 py-3 text-left">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamData.map((member, index) => (
                <tr key={member.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-400 text-gray-900' :
                        index === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          #{member.employee_number}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {[...Array(getStars(member.attendance_efficiency))].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-sm">⭐</span>
                      ))}
                      <span className="ml-2 text-xs text-gray-500">
                        ({getStars(member.attendance_efficiency)}/5)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{formatTime(member.total_attendance_minutes)}</div>
                      <div className="text-xs text-gray-500">
                        Work: {formatTime(member.calculated_work_minutes)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${getPerformanceColor(member.attendance_efficiency)}`}>
                          {formatPercentage(member.attendance_efficiency)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              member.attendance_efficiency >= 85 ? 'bg-green-500' :
                              member.attendance_efficiency >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(member.attendance_efficiency, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${getPerformanceColor(member.work_productivity, { high: 80, medium: 60 })}`}>
                          {formatPercentage(member.work_productivity)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              member.work_productivity >= 80 ? 'bg-green-500' :
                              member.work_productivity >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(member.work_productivity, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-medium">{formatTime(member.billable_minutes)}</div>
                    <div className="text-xs text-gray-500">
                      Break: {formatTime(member.total_break_minutes)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.total_attendance_minutes === 0 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Abwesend
                      </span>
                    ) : member.attendance_efficiency >= 85 && member.work_productivity >= 80 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Excellent
                      </span>
                    ) : member.attendance_efficiency >= 70 && member.work_productivity >= 60 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" />
                        Good
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Needs Attention
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {teamData.length === 0 && !loading && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Keine Team-Daten für den ausgewählten Zeitraum verfügbar</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      )}
    </div>
  );
};

export default TeamAnalytics;