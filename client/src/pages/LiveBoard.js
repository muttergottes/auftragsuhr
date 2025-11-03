import React, { useState, useEffect } from 'react';
import { Clock, User, Users, Briefcase, Coffee, Activity } from 'lucide-react';
import { attendanceAPI, workSessionsAPI, liveBoardAPI, breaksAPI } from '../services/api';
import toast from 'react-hot-toast';

const LiveBoard = () => {
  const [currentAttendance, setCurrentAttendance] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [summary, setSummary] = useState({
    totalPresent: 0,
    totalWorking: 0,
    totalOnBreak: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Fetch live data
  const fetchLiveData = async () => {
    try {
      const [attendanceRes, sessionsRes, breaksRes] = await Promise.all([
        attendanceAPI.getActiveAttendances(),
        workSessionsAPI.getActive(),
        breaksAPI.getActive()
      ]);

      const attendance = attendanceRes.data || [];
      const sessions = sessionsRes.data || [];
      const breaks = breaksRes.data || [];

      // Enhance attendance data with break information
      const enhancedAttendance = attendance.map(att => {
        const userBreak = breaks.find(br => br.employee_number === att.employee_number);
        return {
          ...att,
          currentBreak: userBreak
        };
      });

      setCurrentAttendance(enhancedAttendance);
      setActiveSessions(sessions);

      // Calculate summary with actual break data
      // Count only breaks for currently present employees
      const activePresentBreaks = enhancedAttendance.filter(att => att.currentBreak).length;
      
      setSummary({
        totalPresent: attendance.length,
        totalWorking: sessions.length,
        totalOnBreak: activePresentBreaks,
        totalUsers: attendance.length
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching live data:', error);
      toast.error('Fehler beim Laden der Live-Daten');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000 / 60); // minutes
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  const formatDurationMinutes = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const totalMinutes = Math.floor((now - start) / 1000 / 60);
    
    // Unter 60 Minuten: nur Minuten anzeigen
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }
    
    // Ab 60 Minuten: Stunden und Minuten anzeigen
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatMinutesToDuration = (totalMinutes) => {
    const roundedMinutes = Math.round(totalMinutes || 0);
    
    // Unter 60 Minuten: nur Minuten anzeigen
    if (roundedMinutes < 60) {
      return `${roundedMinutes} min`;
    }
    
    // Ab 60 Minuten: Stunden und Minuten anzeigen
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (time) => {
    return new Date(time).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionForUser = (userId) => {
    return activeSessions.find(session => session.user_id === userId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Activity className="w-8 h-8 mr-3 text-primary-600" />
          Live-Board
        </h1>
        <div className="text-sm text-gray-500">
          Letztes Update: {formatTime(lastUpdate)}
          <button
            onClick={fetchLiveData}
            className="ml-3 btn btn-sm btn-secondary"
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center">
            <Users className="w-8 h-8 mr-3" />
            <div>
              <h3 className="text-lg font-semibold">Anwesend</h3>
              <p className="text-3xl font-bold">{summary.totalPresent}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center">
            <Briefcase className="w-8 h-8 mr-3" />
            <div>
              <h3 className="text-lg font-semibold">Arbeiten</h3>
              <p className="text-3xl font-bold">{summary.totalWorking}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center">
            <Coffee className="w-8 h-8 mr-3" />
            <div>
              <h3 className="text-lg font-semibold">Pause</h3>
              <p className="text-3xl font-bold">{summary.totalOnBreak}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center">
            <Clock className="w-8 h-8 mr-3" />
            <div>
              <h3 className="text-lg font-semibold">Gesamt</h3>
              <p className="text-3xl font-bold">{summary.totalUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Attendance Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Aktuelle Anwesenheit</h2>
        </div>
        
        {currentAttendance.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Derzeit ist niemand anwesend</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eingestempelt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Anwesenheit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktuelle Tätigkeit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentAttendance.map((attendance) => {
                  const session = getSessionForUser(attendance.user_id);
                  return (
                    <tr key={attendance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <User className="w-6 h-6 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {attendance.first_name} {attendance.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              #{attendance.employee_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(attendance.clock_in)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(attendance.clock_in)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Briefcase className="w-3 h-3 mr-1" />
                            Arbeitet ({formatDurationMinutes(session.start_time)})
                          </span>
                        ) : attendance.currentBreak ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <Coffee className="w-3 h-3 mr-1" />
                            {attendance.currentBreak.category_name} ({formatMinutesToDuration(attendance.currentBreak.duration_minutes)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Anwesend
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session ? (
                          <div>
                            <div className="font-medium">
                              {session.order_number || session.category_name || 'Unbekannte Aktivität'}
                            </div>
                            <div className="text-xs text-gray-500">
                              seit {formatTime(session.start_time)}
                            </div>
                          </div>
                        ) : attendance.currentBreak ? (
                          <div>
                            <div className="font-medium text-orange-600">
                              {attendance.currentBreak.category_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              seit {formatTime(attendance.currentBreak.start_time)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Work Sessions */}
      {activeSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Aktive Arbeitszeiten</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auftrag/Tätigkeit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kunde
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gestartet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dauer
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {session.first_name} {session.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        #{session.employee_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {session.order_number || session.category_name || 'Unbekannte Aktivität'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.order_description || (session.category_name ? 'Allgemeine Tätigkeit' : '')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.customer_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(session.start_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(session.start_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBoard;