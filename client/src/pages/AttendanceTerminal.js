import React, { useState, useEffect } from 'react';
import { Clock, User, LogIn, LogOut, Coffee, Briefcase } from 'lucide-react';
import { attendanceAPI, breaksAPI, workSessionsAPI, authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AttendanceTerminal = () => {
  console.log('AttendanceTerminal component loaded!');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveData, setLiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Input fields
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  
  // Auto-refresh timer
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load live attendance data
  const loadLiveData = async () => {
    try {
      const [attendanceRes, breaksRes, workSessionsRes] = await Promise.all([
        attendanceAPI.getActiveAttendances(),
        breaksAPI.getActive(),
        workSessionsAPI.getActive()
      ]);

      const attendance = attendanceRes.data || [];
      const breaks = breaksRes.data || [];
      const workSessions = workSessionsRes.data || [];

      // Combine data for each present employee
      const combinedData = attendance.map(att => {
        const userBreak = breaks.find(br => br.user_id === att.user_id);
        const userWork = workSessions.find(ws => ws.user_id === att.user_id);
        
        let status = 'Anwesend';
        let pauseFrom = null;
        let jobFrom = null;
        
        if (userBreak) {
          status = userBreak.category_name;
          pauseFrom = userBreak.start_time;
        } else if (userWork) {
          status = `${userWork.order_number || userWork.category_name}`;
          jobFrom = userWork.start_time;
        }
        
        return {
          ...att,
          status,
          pauseFrom,
          jobFrom,
          currentBreak: userBreak,
          currentWork: userWork
        };
      });

      setLiveData(combinedData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading live data:', error);
      toast.error('Fehler beim Laden der Live-Daten');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle clock in/out
  const handleClockAction = async (action) => {
    if (!employeeNumber.trim() || !pin.trim()) {
      toast.error('Bitte Personalnummer und PIN eingeben');
      return;
    }

    setActionLoading(true);
    try {
      
      if (action === 'clock-in') {
        await attendanceAPI.kioskClockIn({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich eingestempelt!');
      } else {
        await attendanceAPI.kioskClockOut({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich ausgestempelt!');
      }
      
      // Clear inputs and refresh data
      setEmployeeNumber('');
      setPin('');
      setTimeout(loadLiveData, 500);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Fehler beim ${action === 'clock-in' ? 'Ein' : 'Aus'}stempeln`;
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle break toggle
  const handleBreakAction = async (action) => {
    if (!employeeNumber.trim() || !pin.trim()) {
      toast.error('Bitte Personalnummer und PIN eingeben');
      return;
    }

    setActionLoading(true);
    try {
      if (action === 'start') {
        // Use default break category (Standard Pause)
        await breaksAPI.kioskStart({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          categoryId: 8 // Default Standard Pause category
        });
        toast.success('Pause gestartet!');
      } else {
        await breaksAPI.kioskStop({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim()
        });
        toast.success('Pause beendet!');
      }
      
      // Clear inputs and refresh data
      setEmployeeNumber('');
      setPin('');
      setTimeout(loadLiveData, 500);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Fehler beim ${action === 'start' ? 'Starten' : 'Beenden'} der Pause`;
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (time) => {
    return new Date(time).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Anwesenheits-Terminal</h1>
                <p className="text-sm text-gray-500">Live-Übersicht aller Mitarbeiter</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {formatTime(currentTime)}
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto p-6">
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          
          {/* Left Side - Live List (2/3) */}
          <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Anwesende Mitarbeiter</h2>
              <div className="text-sm text-gray-500">
                Letztes Update: {formatTime(lastUpdate)}
                <button
                  onClick={loadLiveData}
                  className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                >
                  Aktualisieren
                </button>
              </div>
            </div>
            
            <div className="overflow-auto h-full">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : liveData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <User className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-lg">Derzeit ist niemand anwesend</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Personal-Nr
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bemerkung
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Anwesend
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pause v.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job v.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {liveData.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{employee.employee_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.first_name} {employee.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.currentBreak 
                              ? 'bg-yellow-100 text-yellow-800'
                              : employee.currentWork
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {employee.currentBreak && <Coffee className="w-3 h-3 mr-1" />}
                            {employee.currentWork && <Briefcase className="w-3 h-3 mr-1" />}
                            {!employee.currentBreak && !employee.currentWork && <User className="w-3 h-3 mr-1" />}
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(employee.clock_in)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.pauseFrom ? formatTime(employee.pauseFrom) : '--'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.jobFrom ? formatTime(employee.jobFrom) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Side - Controls (1/3) */}
          <div className="w-96 space-y-6">
            
            {/* Current Time Card */}
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {formatTime(currentTime)}
              </div>
              <div className="text-sm text-gray-500">
                Aktuelle Zeit
              </div>
            </div>

            {/* Input Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ein/Ausstempeln</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personal-Nr
                  </label>
                  <input
                    type="text"
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-center"
                    placeholder="z.B. 001"
                    autoComplete="off"
                    disabled={actionLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PIN
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-center"
                    placeholder="••••"
                    maxLength={10}
                    autoComplete="off"
                    disabled={actionLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleClockAction('clock-in')}
                    disabled={actionLoading || !employeeNumber.trim() || !pin.trim()}
                    className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Einstempeln
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleClockAction('clock-out')}
                    disabled={actionLoading || !employeeNumber.trim() || !pin.trim()}
                    className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <LogOut className="w-5 h-5 mr-2" />
                        Ausstempeln
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Break Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pausenverwaltung</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleBreakAction('start')}
                  disabled={actionLoading || !employeeNumber.trim() || !pin.trim()}
                  className="flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Coffee className="w-5 h-5 mr-2" />
                      Pause
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleBreakAction('stop')}
                  disabled={actionLoading || !employeeNumber.trim() || !pin.trim()}
                  className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Coffee className="w-5 h-5 mr-2" />
                      Beenden
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500 text-center">
                Verwendet Standard-Pause
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Übersicht</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Anwesend:</span>
                  <span className="text-sm font-semibold text-gray-900">{liveData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">In Pause:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {liveData.filter(emp => emp.currentBreak).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Arbeiten:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {liveData.filter(emp => emp.currentWork).length}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTerminal;