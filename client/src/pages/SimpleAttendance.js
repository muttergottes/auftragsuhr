import React, { useState, useEffect } from 'react';
import { Clock, User, LogIn, LogOut, Coffee, Briefcase } from 'lucide-react';
import { attendanceAPI, breaksAPI, workSessionsAPI, systemAPI } from '../services/api';
import toast from 'react-hot-toast';

const SimpleAttendance = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);
  const [smartButtonText, setSmartButtonText] = useState('Einstempeln');
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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
        let statusClass = 'bg-green-100 text-green-800';
        let pauseFrom = null;
        let jobFrom = null;
        
        if (userBreak) {
          status = userBreak.category_name;
          statusClass = 'bg-yellow-100 text-yellow-800';
          pauseFrom = userBreak.start_time;
        } else if (userWork) {
          status = `${userWork.order_number || userWork.category_name}`;
          statusClass = 'bg-blue-100 text-blue-800';
          jobFrom = userWork.start_time;
        }
        
        return {
          ...att,
          status,
          statusClass,
          pauseFrom,
          jobFrom,
          currentBreak: userBreak,
          currentWork: userWork
        };
      });

      setLiveData(combinedData);
    } catch (error) {
      console.error('Error loading live data:', error);
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

  const formatTime = (date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Check user status when employee number changes
  const checkUserStatus = async (empNum) => {
    if (!empNum || empNum.length < 2) {
      setUserStatus(null);
      setSmartButtonText('Einstempeln');
      return;
    }

    try {
      const response = await systemAPI.getUserStatus(empNum);
      const status = response.data.data.status;
      setUserStatus(status);
      
      if (status.isPresent) {
        setSmartButtonText('Ausstempeln');
      } else {
        setSmartButtonText('Einstempeln');
      }
    } catch (error) {
      setUserStatus(null);
      setSmartButtonText('Einstempeln');
    }
  };

  // Smart Enter Handler
  const handleSmartEnter = async () => {
    if (!employeeNumber.trim() || !pin.trim()) {
      toast.error('Bitte Personalnummer und PIN eingeben');
      return;
    }

    if (!userStatus) {
      await checkUserStatus(employeeNumber.trim());
      return;
    }

    // Double-enter confirmation
    if (!confirmationNeeded) {
      setConfirmationNeeded(true);
      if (userStatus.isPresent) {
        toast('⚡ Drücken Sie Enter erneut zum Ausstempeln', {
          duration: 3000,
          style: { backgroundColor: '#fef3c7', color: '#92400e' }
        });
      } else {
        toast('⚡ Drücken Sie Enter erneut zum Einstempeln', {
          duration: 3000,
          style: { backgroundColor: '#dcfce7', color: '#166534' }
        });
      }
      // Reset confirmation after 4 seconds
      setTimeout(() => setConfirmationNeeded(false), 4000);
      return;
    }

    // Execute action after confirmation
    setConfirmationNeeded(false);
    setIsLoading(true);
    try {
      if (userStatus.isPresent) {
        // Clock out
        await attendanceAPI.kioskClockOut({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich ausgestempelt!');
      } else {
        // Clock in
        await attendanceAPI.kioskClockIn({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich eingestempelt!');
      }
      
      setEmployeeNumber('');
      setPin('');
      setUserStatus(null);
      setSmartButtonText('Einstempeln');
      setTimeout(loadLiveData, 500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Aktion fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle employee number change
  const handleEmployeeNumberChange = (value) => {
    setEmployeeNumber(value);
    setConfirmationNeeded(false); // Reset confirmation when changing employee number
    checkUserStatus(value);
  };

  const handleAction = async (action) => {
    if (!employeeNumber.trim() || !pin.trim()) {
      toast.error('Bitte Personalnummer und PIN eingeben');
      return;
    }

    setIsLoading(true);
    try {
      if (action === 'clock-in') {
        await attendanceAPI.kioskClockIn({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich eingestempelt!');
      } else if (action === 'clock-out') {
        await attendanceAPI.kioskClockOut({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          location: 'Anwesenheits-Terminal'
        });
        toast.success('Erfolgreich ausgestempelt!');
      } else if (action === 'break-start') {
        await breaksAPI.kioskStart({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim(),
          categoryId: 8
        });
        toast.success('Pause gestartet!');
      } else if (action === 'break-end') {
        await breaksAPI.kioskStop({
          employeeNumber: employeeNumber.trim(),
          pin: pin.trim()
        });
        toast.success('Pause beendet!');
      }
      
      setEmployeeNumber('');
      setPin('');
      setTimeout(loadLiveData, 500); // Refresh live data after action
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Aktion fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Anwesenheits-Terminal</h1>
          <div className="text-sm text-gray-500">
            Live-Update alle 10 Sekunden
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Side - Liste (2/3) */}
        <div className="flex-1 bg-white m-6 rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-800">
              Anwesende Mitarbeiter ({liveData.length})
            </h2>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personal-Nr</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bemerkung</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anwesend</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pause v.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job v.</th>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.statusClass}`}>
                          {employee.currentBreak && <Coffee className="w-3 h-3 mr-1" />}
                          {employee.currentWork && <Briefcase className="w-3 h-3 mr-1" />}
                          {!employee.currentBreak && !employee.currentWork && <User className="w-3 h-3 mr-1" />}
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(employee.clock_in).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.pauseFrom ? new Date(employee.pauseFrom).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.jobFrom ? new Date(employee.jobFrom).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side - Eingabe (1/3) */}
        <div className="w-96 bg-white m-6 rounded-lg shadow p-6">
          <div className="space-y-6">
            
            {/* Uhrzeit */}
            <div className="text-center bg-blue-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {formatTime(currentTime)}
              </div>
            </div>

            {/* Eingabe */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal-Nr
                </label>
                <input
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => handleEmployeeNumberChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSmartEnter()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. 001"
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
                  onKeyPress={(e) => e.key === 'Enter' && handleSmartEnter()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                  placeholder="••••"
                />
              </div>
            </div>

            {/* Smart Button */}
            <div className="space-y-3">
              <button
                onClick={handleSmartEnter}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-4 py-3 text-white rounded-lg font-semibold disabled:opacity-50 text-lg transition-all ${
                  confirmationNeeded
                    ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse'
                    : userStatus?.isPresent 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {userStatus?.isPresent ? (
                  <LogOut className="w-5 h-5 mr-2" />
                ) : (
                  <LogIn className="w-5 h-5 mr-2" />
                )}
                {confirmationNeeded ? 'Enter = Bestätigen' : smartButtonText}
              </button>
              
              {userStatus?.isPresent && (
                <div className="text-sm text-center text-gray-600 bg-yellow-50 p-2 rounded">
                  ⚡ Drücken Sie Enter oder klicken Sie zum Ausstempeln
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={() => handleAction('clock-in')}
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  <LogIn className="w-4 h-4 mr-1" />
                  Manuell ein
                </button>
                <button
                  onClick={() => handleAction('clock-out')}
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Manuell aus
                </button>
              </div>
              
              <button
                onClick={() => handleAction('break-start')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
              >
                <Coffee className="w-4 h-4 mr-2" />
                Pause
              </button>
              
              <button
                onClick={() => handleAction('break-end')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50"
              >
                <Coffee className="w-4 h-4 mr-2" />
                Pause Beenden
              </button>
            </div>

            {isLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleAttendance;