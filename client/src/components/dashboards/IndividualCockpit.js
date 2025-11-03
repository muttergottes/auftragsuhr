import React, { useState, useEffect } from 'react';
import { 
  User,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Award,
  Calendar,
  BarChart3,
  Activity,
  Coffee,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { reportsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const IndividualCockpit = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [teamRanking, setTeamRanking] = useState([]);
  const [goals, setGoals] = useState({
    attendanceEfficiency: 85,
    workProductivity: 80,
    dailyBillableHours: 6
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUsers();
      setSelectedUserId(user.role === 'employee' ? user.id : '');
    }
  }, [user]);

  useEffect(() => {
    setDefaultDates();
  }, [period]);

  useEffect(() => {
    if (startDate && endDate && selectedUserId) {
      loadIndividualData();
    }
  }, [startDate, endDate, selectedUserId]);

  const loadUsers = async () => {
    if (user?.role === 'employee') return;
    
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setAllUsers(data.filter(u => u.is_active && u.role === 'employee'));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

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

  const loadIndividualData = async () => {
    setLoading(true);
    try {
      // Load individual performance data
      const performanceResponse = await fetch('/api/performance/individual?' + new URLSearchParams({
        period: 'custom',
        startDate,
        endDate,
        userId: selectedUserId
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!performanceResponse.ok) throw new Error('Failed to load performance data');
      const performanceResult = await performanceResponse.json();
      setPerformanceData(performanceResult.data);

      // Load team ranking for comparison
      const teamResponse = await fetch('/api/performance/team-ranking?' + new URLSearchParams({
        period: 'custom',
        startDate,
        endDate
      }), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (teamResponse.ok) {
        const teamResult = await teamResponse.json();
        setTeamRanking(teamResult.data || []);
      }

    } catch (error) {
      console.error('Error loading individual data:', error);
      toast.error('Fehler beim Laden der Performance-Daten');
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

  const getPerformanceColor = (value, goal) => {
    if (value >= goal) return 'text-green-600';
    if (value >= goal * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadgeColor = (value, goal) => {
    if (value >= goal) return 'bg-green-100 text-green-800';
    if (value >= goal * 0.8) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getUserRank = () => {
    if (!teamRanking.length || !selectedUserId) return null;
    const rank = teamRanking.findIndex(member => member.user_id.toString() === selectedUserId.toString()) + 1;
    return rank > 0 ? rank : null;
  };

  const getGoalProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  const selectedUserData = allUsers.find(u => u.id.toString() === selectedUserId.toString()) || user;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <User className="w-8 h-8 text-primary-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Individual Cockpit</h1>
              <p className="text-gray-600">Persönliche Performance-Analyse und Ziel-Tracking</p>
            </div>
          </div>
          <button
            onClick={loadIndividualData}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {user?.role !== 'employee' && (
            <div>
              <label className="form-label">Mitarbeiter</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="form-input"
              >
                <option value="">Mitarbeiter wählen...</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
        </div>
      </div>

      {/* User Profile Card */}
      {selectedUserData && (
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mr-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-800">
                  {selectedUserData.first_name} {selectedUserData.last_name}
                </h2>
                <p className="text-primary-600">#{selectedUserData.employee_number}</p>
                {getUserRank() && (
                  <p className="text-sm text-primary-700">
                    Team-Ranking: #{getUserRank()} von {teamRanking.length}
                  </p>
                )}
              </div>
            </div>
            {getUserRank() && getUserRank() <= 3 && (
              <div className="flex items-center">
                <Award className="w-8 h-8 text-yellow-500 mr-2" />
                <span className="text-lg font-bold text-yellow-600">
                  Top {getUserRank()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Overview */}
      {performanceData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Anwesenheits-Effizienz */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Anwesenheits-Effizienz</h3>
                <Target className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-3">
                <div className={`text-3xl font-bold ${getPerformanceColor(performanceData.attendanceEfficiency, goals.attendanceEfficiency)}`}>
                  {formatPercentage(performanceData.attendanceEfficiency)}
                </div>
                <div className="text-sm text-gray-600">
                  Ziel: {goals.attendanceEfficiency}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      performanceData.attendanceEfficiency >= goals.attendanceEfficiency 
                        ? 'bg-green-500' 
                        : performanceData.attendanceEfficiency >= goals.attendanceEfficiency * 0.8 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${getGoalProgress(performanceData.attendanceEfficiency, goals.attendanceEfficiency)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Work Time / Attendance Time
                </div>
              </div>
            </div>

            {/* Arbeits-Produktivität */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Arbeits-Produktivität</h3>
                <Zap className="w-8 h-8 text-purple-500" />
              </div>
              <div className="space-y-3">
                <div className={`text-3xl font-bold ${getPerformanceColor(performanceData.workProductivity, goals.workProductivity)}`}>
                  {formatPercentage(performanceData.workProductivity)}
                </div>
                <div className="text-sm text-gray-600">
                  Ziel: {goals.workProductivity}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      performanceData.workProductivity >= goals.workProductivity 
                        ? 'bg-green-500' 
                        : performanceData.workProductivity >= goals.workProductivity * 0.8 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${getGoalProgress(performanceData.workProductivity, goals.workProductivity)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Billable Time / Work Time
                </div>
              </div>
            </div>

            {/* Tägliche Arbeitszeit */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Ø Tägliche Arbeitszeit</h3>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-blue-600">
                  {formatTime(performanceData.avgAttendancePerDay)}
                </div>
                <div className="text-sm text-gray-600">
                  {performanceData.attendanceDays} Arbeitstage
                </div>
                <div className="text-sm text-gray-500">
                  Work: {formatTime((performanceData.calculatedWorkMinutes / performanceData.attendanceDays) || 0)}
                </div>
              </div>
            </div>

            {/* Abrechenbare Stunden */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Abrechenbare Zeit</h3>
                <Activity className="w-8 h-8 text-orange-500" />
              </div>
              <div className="space-y-3">
                <div className="text-3xl font-bold text-orange-600">
                  {formatTime(performanceData.billableMinutes)}
                </div>
                <div className="text-sm text-gray-600">
                  {formatPercentage((performanceData.billableMinutes / performanceData.totalAttendanceMinutes) * 100)} der Anwesenheit
                </div>
                <div className="text-sm text-gray-500">
                  Ø {formatTime((performanceData.billableMinutes / performanceData.attendanceDays) || 0)} pro Tag
                </div>
              </div>
            </div>
          </div>

          {/* Time Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Zeitaufschlüsselung
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Zeit-Übersicht */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Gesamtübersicht</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Gesamte Anwesenheit:</span>
                    <span className="font-medium">{formatTime(performanceData.totalAttendanceMinutes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Berechnete Arbeitszeit:</span>
                    <span className="font-medium text-green-600">{formatTime(performanceData.calculatedWorkMinutes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pausenzeit:</span>
                    <span className="font-medium text-orange-600">{formatTime(performanceData.totalBreakMinutes)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Abrechenbare Zeit:</span>
                    <span className="font-medium text-blue-600">{formatTime(performanceData.billableMinutes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Interne Zeit:</span>
                    <span className="font-medium text-gray-600">{formatTime(performanceData.internalMinutes)}</span>
                  </div>
                </div>
              </div>

              {/* Visual Time Bar */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Visuelle Darstellung</h4>
                <div className="space-y-4">
                  {/* Attendance Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Anwesenheit</span>
                      <span>100%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6 relative">
                      <div 
                        className="h-6 bg-green-500 rounded-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(performanceData.calculatedWorkMinutes / performanceData.totalAttendanceMinutes) * 100}%` }}
                      >
                        Work
                      </div>
                      <div 
                        className="absolute top-0 h-6 bg-orange-400 rounded-r-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ 
                          left: `${(performanceData.calculatedWorkMinutes / performanceData.totalAttendanceMinutes) * 100}%`,
                          width: `${(performanceData.totalBreakMinutes / performanceData.totalAttendanceMinutes) * 100}%`
                        }}
                      >
                        {performanceData.totalBreakMinutes > 0 ? 'Break' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Work Productivity Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Arbeitszeit</span>
                      <span>100%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6 relative">
                      <div 
                        className="h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(performanceData.billableMinutes / performanceData.calculatedWorkMinutes) * 100}%` }}
                      >
                        Billable
                      </div>
                      <div 
                        className="absolute top-0 h-6 bg-gray-400 rounded-r-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ 
                          left: `${(performanceData.billableMinutes / performanceData.calculatedWorkMinutes) * 100}%`,
                          width: `${(performanceData.internalMinutes / performanceData.calculatedWorkMinutes) * 100}%`
                        }}
                      >
                        {performanceData.internalMinutes > 0 ? 'Internal' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Goals and Achievements */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Ziele & Fortschritt
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Attendance Efficiency Goal */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Anwesenheits-Effizienz</span>
                  {performanceData.attendanceEfficiency >= goals.attendanceEfficiency ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <div className="text-lg font-bold mb-1">
                  {formatPercentage(performanceData.attendanceEfficiency)} / {goals.attendanceEfficiency}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      performanceData.attendanceEfficiency >= goals.attendanceEfficiency 
                        ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${getGoalProgress(performanceData.attendanceEfficiency, goals.attendanceEfficiency)}%` }}
                  ></div>
                </div>
              </div>

              {/* Work Productivity Goal */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Arbeits-Produktivität</span>
                  {performanceData.workProductivity >= goals.workProductivity ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <div className="text-lg font-bold mb-1">
                  {formatPercentage(performanceData.workProductivity)} / {goals.workProductivity}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      performanceData.workProductivity >= goals.workProductivity 
                        ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${getGoalProgress(performanceData.workProductivity, goals.workProductivity)}%` }}
                  ></div>
                </div>
              </div>

              {/* Daily Billable Hours Goal */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Ø Abrechenbar/Tag</span>
                  {(performanceData.billableMinutes / performanceData.attendanceDays / 60) >= goals.dailyBillableHours ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <div className="text-lg font-bold mb-1">
                  {formatTime((performanceData.billableMinutes / performanceData.attendanceDays) || 0)} / {goals.dailyBillableHours}h
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (performanceData.billableMinutes / performanceData.attendanceDays / 60) >= goals.dailyBillableHours 
                        ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ 
                      width: `${getGoalProgress(
                        (performanceData.billableMinutes / performanceData.attendanceDays / 60), 
                        goals.dailyBillableHours
                      )}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedUserId && user?.role !== 'employee' && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Mitarbeiter wählen
          </h3>
          <p className="text-gray-500">
            Bitte wählen Sie einen Mitarbeiter aus, um dessen Performance-Daten anzuzeigen.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      )}
    </div>
  );
};

export default IndividualCockpit;