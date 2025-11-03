import React, { useState, useEffect } from 'react';
import { 
  Monitor,
  Users, 
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  Zap,
  Target,
  Gauge,
  TrendingUp,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { reportsAPI, usersAPI } from '../../services/api';
import toast from 'react-hot-toast';

const OperationsControl = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (user?.role !== 'employee') {
      loadData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Load multiple data sources in parallel
      const [dashboardResponse, kpiResponse, performanceResponse] = await Promise.all([
        reportsAPI.getOverviewDashboard({ 
          period: 'today',
          startDate: today,
          endDate: today 
        }),
        reportsAPI.getKpiSummary({ 
          period: 'today',
          startDate: today,
          endDate: today 
        }),
        fetch('/api/performance/team-ranking?period=today', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).then(res => res.json())
      ]);

      setData(dashboardResponse.data);
      setLiveData(kpiResponse.data);
      setTeamPerformance(performanceResponse.data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading operations data:', error);
      toast.error('Fehler beim Laden der Operations-Daten');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatPercentage = (value) => {
    return `${Math.round(value || 0)}%`;
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 85) return 'text-green-600 bg-green-100';
    if (efficiency >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusIcon = (efficiency) => {
    if (efficiency >= 85) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (efficiency >= 70) return <Zap className="w-5 h-5 text-yellow-500" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Monitor className="w-8 h-8 text-primary-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Operations Control Center</h1>
              <p className="text-gray-600">Live-Überwachung der Werkstatt-Performance</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Letztes Update: {lastUpdate.toLocaleTimeString('de-DE')}
            </div>
            <button
              onClick={loadData}
              className="btn btn-secondary flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </button>
          </div>
        </div>
      </div>

      {/* Live KPIs */}
      {liveData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Anwesenheit */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Live Anwesenheit</h3>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-blue-600">
                {teamPerformance.filter(t => t.total_attendance_minutes > 0).length}
              </div>
              <div className="text-sm text-gray-600">Aktive Mitarbeiter heute</div>
              <div className="text-sm font-medium">
                Ø Anwesenheit: {formatTime(liveData.time.avgHoursPerDay * 60)}
              </div>
            </div>
          </div>

          {/* Attendance Efficiency */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Anwesenheits-Effizienz</h3>
              <Gauge className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600">
                {formatPercentage(
                  teamPerformance.length > 0 
                    ? teamPerformance.reduce((sum, t) => sum + t.attendance_efficiency, 0) / teamPerformance.length
                    : 0
                )}
              </div>
              <div className="text-sm text-gray-600">Team-Durchschnitt</div>
              <div className="text-sm font-medium">
                Work Time / Attendance Time
              </div>
            </div>
          </div>

          {/* Work Productivity */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Arbeits-Produktivität</h3>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-600">
                {formatPercentage(
                  teamPerformance.length > 0 
                    ? teamPerformance.reduce((sum, t) => sum + t.work_productivity, 0) / teamPerformance.length
                    : 0
                )}
              </div>
              <div className="text-sm text-gray-600">Team-Durchschnitt</div>
              <div className="text-sm font-medium">
                Billable Time / Work Time
              </div>
            </div>
          </div>

          {/* Aktive Aufträge */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Aktive Aufträge</h3>
              <Activity className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-orange-600">
                {liveData?.activity?.uniqueOrders || 0}
              </div>
              <div className="text-sm text-gray-600">Aufträge heute</div>
              <div className="text-sm font-medium">
                {liveData?.activity?.workSessions || 0} Work Sessions
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Team Performance (Heute)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mitarbeiter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anwesenheit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arbeitszeit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance Efficiency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Work Productivity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Abrechenbar
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamPerformance.map((member) => (
                <tr key={member.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
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
                      {getStatusIcon(member.attendance_efficiency)}
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEfficiencyColor(member.attendance_efficiency)}`}>
                        {member.total_attendance_minutes > 0 ? 'Aktiv' : 'Abwesend'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(member.total_attendance_minutes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(member.calculated_work_minutes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          member.attendance_efficiency >= 85 ? 'text-green-600' :
                          member.attendance_efficiency >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
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
                        <div className={`text-sm font-medium ${
                          member.work_productivity >= 85 ? 'text-green-600' :
                          member.work_productivity >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(member.work_productivity)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              member.work_productivity >= 85 ? 'bg-green-500' :
                              member.work_productivity >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(member.work_productivity, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(member.billable_minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {teamPerformance.length === 0 && (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Keine Team-Daten für heute verfügbar</p>
          </div>
        )}
      </div>

      {/* Performance Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Performance Alerts
        </h3>
        
        <div className="space-y-3">
          {teamPerformance.filter(member => 
            member.total_attendance_minutes > 0 && member.attendance_efficiency < 70
          ).map(member => (
            <div key={member.user_id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
                <div>
                  <div className="font-medium text-red-800">
                    {member.first_name} {member.last_name}
                  </div>
                  <div className="text-sm text-red-600">
                    Niedrige Anwesenheits-Effizienz: {formatPercentage(member.attendance_efficiency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {teamPerformance.filter(member => 
            member.calculated_work_minutes > 0 && member.work_productivity < 70
          ).map(member => (
            <div key={`productivity-${member.user_id}`} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <Zap className="w-5 h-5 text-yellow-500 mr-3" />
                <div>
                  <div className="font-medium text-yellow-800">
                    {member.first_name} {member.last_name}
                  </div>
                  <div className="text-sm text-yellow-600">
                    Niedrige Arbeits-Produktivität: {formatPercentage(member.work_productivity)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {teamPerformance.filter(member => 
            member.total_attendance_minutes > 0 && 
            member.attendance_efficiency < 70
          ).length === 0 && 
          teamPerformance.filter(member => 
            member.calculated_work_minutes > 0 && 
            member.work_productivity < 70
          ).length === 0 && (
            <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
              <div className="text-green-800">
                Alle Mitarbeiter arbeiten im optimalen Bereich
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationsControl;