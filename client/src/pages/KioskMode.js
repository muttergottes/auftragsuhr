import React, { useState, useEffect } from 'react';
// Version 3.0 - Performance Integration added
import { Clock, User, QrCode, CreditCard, LogIn, LogOut, Delete, Coffee, Briefcase, Plus, Play, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, breaksAPI, categoriesAPI, workSessionsAPI, workOrdersAPI } from '../services/api';
import QRScanner from '../components/QRScanner';
import toast from 'react-hot-toast';

const KioskMode = () => {
  const { kioskLogin, scanLogin } = useAuth();
  const [activeUser, setActiveUser] = useState(() => {
    // Restore from sessionStorage on refresh
    const saved = sessionStorage.getItem('kioskActiveUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [userPin, setUserPin] = useState(() => {
    // Restore PIN from sessionStorage on refresh
    return sessionStorage.getItem('kioskUserPin') || '';
  });
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [userAttendance, setUserAttendance] = useState(null);
  const [userBreak, setUserBreak] = useState(null);
  const [breakCategories, setBreakCategories] = useState([]);
  const [showBreakPopup, setShowBreakPopup] = useState(false);
  const [rfidListening, setRfidListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [todayHistory, setTodayHistory] = useState({
    attendance: [],
    breaks: [],
    workSessions: []
  });
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance', 'orders', or 'breaks'
  const [availableOrders, setAvailableOrders] = useState([]);
  const [currentWorkSession, setCurrentWorkSession] = useState(null);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check attendance status on component mount and when activeUser changes
  useEffect(() => {
    const checkAttendanceStatus = async () => {
      if (activeUser && userPin) {
        try {
          const attendanceResponse = await attendanceAPI.kioskGetCurrent({
            employeeNumber: activeUser.employee_number,
            pin: userPin
          });
          setUserAttendance(attendanceResponse.data.data);
        } catch (err) {
          // User might not have active attendance, that's OK
          setUserAttendance(null);
        }

        // Check current break status
        try {
          const breakResponse = await breaksAPI.kioskGetCurrent({
            employeeNumber: activeUser.employee_number,
            pin: userPin
          });
          setUserBreak(breakResponse.data.data);
        } catch (err) {
          // User might not have active break, that's OK
          setUserBreak(null);
        }

        // Load break categories
        try {
          const categoriesResponse = await categoriesAPI.kioskGetAll({
            employeeNumber: activeUser.employee_number,
            pin: userPin
          });
          const categoryData = categoriesResponse.data.data || {};
          setBreakCategories(categoryData.breakCategories || []);
        } catch (err) {
          console.error('Error loading categories:', err);
        }
      }
    };

    checkAttendanceStatus();
  }, [activeUser, userPin]);

  // Auto logout after inactivity - DISABLED for testing
  // useEffect(() => {
  //   let timeout;
  //   if (activeUser) {
  //     timeout = setTimeout(() => {
  //       setActiveUser(null);
  //       setUserPin('');
  //       setUserAttendance(null);
  //       sessionStorage.removeItem('kioskActiveUser');
  //       sessionStorage.removeItem('kioskUserPin');
  //       toast.success('Automatisch abgemeldet');
  //     }, 300000); // 5 minutes
  //   }
  //   return () => clearTimeout(timeout);
  // }, [activeUser]);

  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!employeeNumber || !pin) {
      toast.error('Mitarbeiternummer und PIN eingeben');
      return;
    }

    setIsLoading(true);
    try {
      const result = await kioskLogin({ employeeNumber, pin });
      if (result.success) {
        setActiveUser(result.user);
        setUserPin(pin); // Store PIN for kiosk actions
        
        // Store in sessionStorage for persistence across refreshes
        sessionStorage.setItem('kioskActiveUser', JSON.stringify(result.user));
        sessionStorage.setItem('kioskUserPin', pin);
        
        // Check current attendance status
        try {
          const attendanceResponse = await attendanceAPI.kioskGetCurrent({
            employeeNumber: result.user.employee_number,
            pin: pin
          });
          setUserAttendance(attendanceResponse.data.data);
        } catch (err) {
          // User might not have active attendance, that's OK
          setUserAttendance(null);
        }
        
        setEmployeeNumber('');
        setPin('');
        toast.success(`Willkommen, ${result.user.first_name}!`);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Anmeldung fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanLogin = async (identifier, type) => {
    setIsLoading(true);
    try {
      const result = await scanLogin({ identifier, type });
      if (result.success) {
        setActiveUser(result.user);
        setShowScanner(false);
        
        // Store in sessionStorage for persistence across refreshes
        sessionStorage.setItem('kioskActiveUser', JSON.stringify(result.user));
        // Note: For scan login, we don't have a PIN, so we don't store it
        
        // Note: For scan login, we don't have a PIN, so we can't check attendance status
        // This is a limitation that needs to be addressed in the scan login system
        setUserAttendance(null);
        
        toast.success(`Willkommen, ${result.user.first_name}!`);
      } else {
        toast.error(result.error);
        setShowScanner(false);
      }
    } catch (error) {
      toast.error('Scan-Anmeldung fehlgeschlagen');
      setShowScanner(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = async () => {
    const confirmed = window.confirm('Möchten Sie sich jetzt einstempeln?');
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await attendanceAPI.kioskClockIn({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        location: 'Kiosk Terminal'
      });
      toast.success(response.data.message || 'Erfolgreich eingestempelt!');
      setUserAttendance(response.data.attendance);
      // User bleibt eingeloggt - kein automatisches Ausloggen mehr
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Einstempeln fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    try {
      // Check for active work sessions first
      const sessionResponse = await workSessionsAPI.kioskGetCurrent({
        employeeNumber: activeUser.employee_number,
        pin: userPin
      });
      
      if (sessionResponse.data.data) {
        const activeSession = sessionResponse.data.data;
        window.confirm(
          `Sie arbeiten noch an Auftrag "${activeSession.order_number}". ` +
          'Sie müssen zuerst alle Aufträge beenden, bevor Sie sich ausstempeln können.'
        );
        setIsLoading(false);
        return;
      }

      // Check for active breaks
      if (userBreak) {
        window.confirm(
          `Sie sind noch in der Pause "${userBreak.category_name}". ` +
          'Sie müssen zuerst die Pause beenden, bevor Sie sich ausstempeln können.'
        );
        setIsLoading(false);
        return;
      }

      const confirmed = window.confirm('Möchten Sie sich jetzt ausstempeln?');
      if (!confirmed) {
        setIsLoading(false);
        return;
      }

      const response = await attendanceAPI.kioskClockOut({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        location: 'Kiosk Terminal'
      });
      toast.success(response.data.message || 'Erfolgreich ausgestempelt!');
      setUserAttendance(null);
      // User bleibt eingeloggt - kein automatisches Ausloggen mehr
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ausstempeln fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakStart = async (categoryId = null) => {
    setIsLoading(true);
    try {
      // Check for active work sessions first - BLOCK pause during work
      const sessionResponse = await workSessionsAPI.kioskGetCurrent({
        employeeNumber: activeUser.employee_number,
        pin: userPin
      });
      
      if (sessionResponse.data.data) {
        const activeSession = sessionResponse.data.data;
        toast.error(
          `Sie arbeiten noch an Auftrag "${activeSession.order_number}". ` +
          'Beenden Sie zuerst den Auftrag, bevor Sie eine Pause machen.'
        );
        setIsLoading(false);
        return;
      }

      // Use provided categoryId or default to Standard Pause
      const breakCategoryId = categoryId || (breakCategories.find(cat => cat.name === 'Standard Pause')?.id || 8);
      
      const response = await breaksAPI.kioskStart({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        categoryId: breakCategoryId,
        attendanceRecordId: userAttendance?.id
      });
      toast.success(response.data.message || 'Pause gestartet!');
      setUserBreak(response.data.break);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Pause starten fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakStop = async () => {
    setIsLoading(true);
    try {
      const response = await breaksAPI.kioskStop({
        employeeNumber: activeUser.employee_number,
        pin: userPin
      });
      toast.success(response.data.message || 'Pause beendet!');
      setUserBreak(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Pause beenden fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTodayHistory = async () => {
    if (!activeUser || !userPin) return;
    
    try {
      setIsLoading(true);
      
      const credentials = {
        employeeNumber: activeUser.employee_number,
        pin: userPin
      };

      // Load today's data in parallel
      const [attendanceRes, breaksRes, workSessionsRes] = await Promise.allSettled([
        attendanceAPI.kioskGetToday(credentials),
        breaksAPI.kioskGetToday(credentials),
        workSessionsAPI.kioskGetToday(credentials)
      ]);

      setTodayHistory({
        attendance: attendanceRes.status === 'fulfilled' ? attendanceRes.value.data.data : [],
        breaks: breaksRes.status === 'fulfilled' ? breaksRes.value.data.data : [],
        workSessions: workSessionsRes.status === 'fulfilled' ? workSessionsRes.value.data.data : []
      });
      
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading today history:', error);
      toast.error('Fehler beim Laden der Tageshistorie');
    } finally {
      setIsLoading(false);
    }
  };


  const handleRfidMode = () => {
    if (rfidListening) {
      setRfidListening(false);
      toast.success('RFID-Modus deaktiviert');
    } else {
      setRfidListening(true);
      toast.success('RFID-Modus aktiviert - Karte an Terminal halten');
      
      // Auto-disable after 30 seconds
      setTimeout(() => {
        setRfidListening(false);
        toast('RFID-Modus automatisch deaktiviert', { icon: '⏰' });
      }, 30000);
    }
  };

  // RFID listener effect - simulates RFID card detection
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Simple RFID simulation: Press 'R' key to simulate RFID scan
      if (rfidListening && event.key.toLowerCase() === 'r' && event.target === document.body) {
        const simulatedRfidId = 'RFID001';
        handleScanLogin(simulatedRfidId, 'rfid_tag');
        setRfidListening(false);
      }
    };

    if (rfidListening) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [rfidListening]);


  const formatTime = (date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const handleStopWorkSession = () => {
    console.log('handleStopWorkSession called', { currentWorkSession });
    
    const workType = currentWorkSession?.order_number ? 'Auftrag' : 'Aktivität';
    const workName = currentWorkSession?.order_number || currentWorkSession?.category_name;
    const confirmed = window.confirm(`Möchten Sie die Arbeit an ${workType} "${workName}" beenden?`);
    if (!confirmed) return;

    console.log('User confirmed, showing notes popup');
    // Show notes popup after confirmation
    setShowNotesPopup(true);
  };

  const handleFinalStopWorkSession = async () => {
    setIsLoading(true);
    try {
      const response = await workSessionsAPI.kioskStop({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        note: sessionNotes.trim() || undefined
      });
      toast.success(response.data.message);
      setCurrentWorkSession(null);
      setShowNotesPopup(false);
      setSessionNotes('');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Beenden der Arbeitssitzung';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (showHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Tageshistorie - {activeUser.first_name}
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Attendance History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Anwesenheit</h3>
                {todayHistory.attendance.length > 0 ? (
                  <div className="space-y-2">
                    {todayHistory.attendance.map((record, index) => (
                      <div key={index} className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex justify-between text-sm">
                          <span>
                            Einstempeln: {formatTime(new Date(record.clock_in))}
                          </span>
                          <span>
                            {record.clock_out 
                              ? `Ausstempeln: ${formatTime(new Date(record.clock_out))}`
                              : 'Aktiv'
                            }
                          </span>
                        </div>
                        {record.total_hours && (
                          <div className="text-xs text-green-700 mt-1">
                            Arbeitszeit: {formatDuration(Math.round(record.total_hours * 60))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Heute noch nicht eingestempelt</p>
                )}
              </div>

              {/* Breaks History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Pausen</h3>
                {todayHistory.breaks.length > 0 ? (
                  <div className="space-y-2">
                    {todayHistory.breaks.map((breakRecord, index) => (
                      <div key={index} className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <div className="flex justify-between text-sm">
                          <span>{breakRecord.category_name || 'Pause'}</span>
                          <span>{formatTime(new Date(breakRecord.start_time))}</span>
                        </div>
                        {breakRecord.end_time ? (
                          <div className="text-xs text-yellow-700 mt-1">
                            Dauer: {formatDuration(breakRecord.duration_minutes || 0)}
                          </div>
                        ) : (
                          <div className="text-xs text-yellow-700 mt-1">Aktiv</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Heute noch keine Pausen</p>
                )}
              </div>

              {/* Work Sessions History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Arbeitssessions</h3>
                {todayHistory.workSessions.length > 0 ? (
                  <div className="space-y-2">
                    {todayHistory.workSessions.map((session, index) => (
                      <div key={index} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex justify-between text-sm">
                          <span>{session.order_number || session.category_name || 'Auftrag'}</span>
                          <span>{formatTime(new Date(session.start_time))}</span>
                        </div>
                        {session.end_time ? (
                          <div className="text-xs text-blue-700 mt-1">
                            Dauer: {formatDuration(session.duration_minutes || 0)}
                          </div>
                        ) : (
                          <div className="text-xs text-blue-700 mt-1">Aktiv</div>
                        )}
                        {session.notes && (
                          <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border">
                            {session.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Heute noch keine Aufträge bearbeitet</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowHistory(false)}
              className="w-full mt-6 btn btn-primary btn-lg"
            >
              Zurück
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-primary-800 mb-2">
              {formatTime(currentTime)}
            </div>
            <div className="text-lg text-primary-600">
              {formatDate(currentTime)}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {activeUser.first_name} {activeUser.last_name}
              </h2>
              <p className="text-gray-600">#{activeUser.employee_number}</p>
            </div>


            {/* Current Status */}
            {userAttendance && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-center text-green-800">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">
                    Eingestempelt seit {new Date(userAttendance.clock_in).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Break Status */}
            {userBreak && (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-center text-yellow-800">
                  <Coffee className="w-5 h-5 mr-2" />
                  <div className="text-center">
                    <span className="font-medium block">
                      {userBreak.category_name} seit {new Date(userBreak.start_time).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Current Work Session Status - Global */}
            {currentWorkSession && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center text-green-800">
                      <Briefcase className="w-5 h-5 mr-2" />
                      <span className="font-medium">
                        Arbeite an: {currentWorkSession.order_number || currentWorkSession.category_name}
                      </span>
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      Seit: {new Date(currentWorkSession.start_time).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const workType = currentWorkSession?.order_number ? 'Auftrag' : 'Aktivität';
                      const workName = currentWorkSession?.order_number || currentWorkSession?.category_name;
                      const confirmed = window.confirm(`Möchten Sie die Arbeit an ${workType} "${workName}" beenden?`);
                      if (confirmed) {
                        handleFinalStopWorkSession();
                      }
                    }}
                    disabled={isLoading}
                    className="btn btn-danger"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Beenden
                  </button>
                </div>
                
                {/* Bemerkungen Textfeld */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bemerkungen (optional):
                  </label>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    rows="2"
                    placeholder="z.B. Arbeitsschritte, Probleme, nächste Schritte..."
                    maxLength="500"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {sessionNotes.length}/500 Zeichen
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation - Fixed at Top */}
            <div className="mb-6 bg-white sticky top-0 z-10 shadow-sm">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === 'attendance'
                      ? 'border-b-2 border-primary-500 text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Clock className="w-5 h-5 mx-auto mb-1" />
                  Anwesenheit
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === 'orders'
                      ? 'border-b-2 border-primary-500 text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Briefcase className="w-5 h-5 mx-auto mb-1" />
                  Aufträge
                </button>
                <button
                  onClick={() => setActiveTab('breaks')}
                  className={`flex-1 py-2 px-4 text-center font-medium ${
                    activeTab === 'breaks'
                      ? 'border-b-2 border-primary-500 text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Coffee className="w-5 h-5 mx-auto mb-1" />
                  Pausen
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
              {!userAttendance ? (
                <button
                  onClick={handleClockIn}
                  disabled={isLoading}
                  className="w-full btn btn-success btn-lg py-6 text-xl font-semibold"
                >
                  <LogIn className="w-6 h-6 mr-3" />
                  Einstempeln
                </button>
              ) : (
                <button
                  onClick={handleClockOut}
                  disabled={isLoading}
                  className="w-full btn btn-danger btn-lg py-6 text-xl font-semibold"
                >
                  <LogOut className="w-6 h-6 mr-3" />
                  Ausstempeln
                </button>
              )}

              {/* Break button when user is clocked in */}
              {userAttendance && !userBreak && (
                <button
                  onClick={() => setActiveTab('breaks')}
                  disabled={isLoading}
                  className="w-full btn btn-warning btn-lg py-4 text-lg"
                >
                  <Coffee className="w-5 h-5 mr-2" />
                  Pause starten
                </button>
              )}

              {/* Break stop button when user is on break */}
              {userBreak && (
                <button
                  onClick={handleBreakStop}
                  disabled={isLoading}
                  className="w-full btn btn-danger btn-lg py-4 text-lg"
                >
                  <Coffee className="w-5 h-5 mr-2" />
                  Pause beenden
                </button>
              )}

              {/* History button */}
              <button
                onClick={loadTodayHistory}
                disabled={isLoading}
                className="w-full btn btn-secondary btn-lg py-4 text-lg"
              >
                Tageshistorie anzeigen
              </button>

              {!userAttendance && (
                <div className="text-center text-gray-500 text-sm">
                  Sie sind momentan nicht eingestempelt
                </div>
              )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <OrdersTab 
                activeUser={activeUser}
                userPin={userPin}
                userAttendance={userAttendance}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                currentWorkSession={currentWorkSession}
                setCurrentWorkSession={setCurrentWorkSession}
                availableOrders={availableOrders}
                setAvailableOrders={setAvailableOrders}
                showManualOrder={showManualOrder}
                setShowManualOrder={setShowManualOrder}
                manualOrderNumber={manualOrderNumber}
                setManualOrderNumber={setManualOrderNumber}
                handleStopWorkSession={handleStopWorkSession}
              />
            )}

            {/* Breaks Tab */}
            {activeTab === 'breaks' && (
              <BreaksTab 
                userBreak={userBreak}
                isLoading={isLoading}
                currentWorkSession={currentWorkSession}
                breakCategories={breakCategories}
                handleBreakStart={handleBreakStart}
                handleBreakStop={handleBreakStop}
              />
            )}

            <button
              onClick={() => {
                setActiveUser(null);
                setUserPin('');
                setUserAttendance(null);
                setShowScanner(false);
                sessionStorage.removeItem('kioskActiveUser');
                sessionStorage.removeItem('kioskUserPin');
              }}
              className="mt-6 text-gray-500 hover:text-gray-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-primary-800 mb-2">
            {formatTime(currentTime)}
          </div>
          <div className="text-lg text-primary-600">
            {formatDate(currentTime)}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Zeiterfassung
            </h1>
            <p className="text-gray-600">Bitte melden Sie sich an</p>
          </div>

          <div className="space-y-6">
            {/* PIN Login Form */}
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div>
                <label className="form-label text-lg">Mitarbeiternummer</label>
                <input
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  className="form-input text-xl py-4 px-6 text-center w-full"
                  placeholder="z.B. 001"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="form-label text-lg">PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="form-input text-xl py-4 px-6 text-center w-full"
                  placeholder="••••"
                  maxLength={10}
                  autoComplete="off"
                />
              </div>


              <button
                type="submit"
                disabled={isLoading || !employeeNumber || !pin}
                className="w-full btn btn-primary btn-lg py-6 text-xl font-semibold"
              >
                <User className="w-6 h-6 mr-3" />
                Anmelden
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">oder</span>
              </div>
            </div>

            {/* Alternative Login Methods */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowScanner(true)}
                disabled={isLoading}
                className="btn btn-secondary btn-lg py-6 text-lg font-semibold"
              >
                <QrCode className="w-6 h-6 mb-2" />
                QR-Code
              </button>

              <button
                onClick={() => handleRfidMode()}
                disabled={isLoading}
                className={`btn ${rfidListening ? 'btn-warning' : 'btn-secondary'} btn-lg py-6 text-lg font-semibold`}
              >
                <CreditCard className="w-6 h-6 mb-2" />
                {rfidListening ? 'RFID aktiv...' : 'RFID'}
              </button>
            </div>

            {/* QR Scanner Modal */}
            <QRScanner
              isOpen={showScanner}
              onScan={handleScanLogin}
              onClose={() => setShowScanner(false)}
            />
          </div>

          <div className="mt-8 text-center">
            <a
              href="/login"
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Admin-Bereich
            </a>
          </div>
        </div>

        {/* Break Selection Popup */}
        {showBreakPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Pause auswählen</h3>
                <button 
                  onClick={() => setShowBreakPopup(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {breakCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      handleBreakStart(category.id);
                      setShowBreakPopup(false);
                    }}
                    disabled={isLoading}
                    className="p-3 text-center bg-yellow-50 hover:bg-yellow-100 rounded-lg border-2 border-yellow-200 transition-colors"
                    style={{ 
                      borderColor: category.color,
                      backgroundColor: category.color + '20'
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-8 h-8 rounded-full mb-2" 
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <span className="font-medium text-gray-800 block text-sm">{category.name}</span>
                        {category.max_duration_minutes && (
                          <span className="text-xs text-gray-500">
                            Max. {category.max_duration_minutes} Min.
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {breakCategories.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Coffee className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Keine Pausenkategorien verfügbar</p>
                </div>
              )}
              
              <button 
                onClick={() => setShowBreakPopup(false)}
                className="w-full mt-4 btn btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Notes Popup for ending work session */}
        {showNotesPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Arbeit beenden</h3>
                <button 
                  onClick={() => {
                    setShowNotesPopup(false);
                    setSessionNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Arbeit an: <strong>{currentWorkSession?.order_number || currentWorkSession?.category_name}</strong>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bemerkungen (optional):
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows="3"
                  placeholder="z.B. Arbeitsschritte, Probleme, nächste Schritte..."
                  maxLength="500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {sessionNotes.length}/500 Zeichen
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowNotesPopup(false);
                    setSessionNotes('');
                  }}
                  className="flex-1 btn btn-secondary"
                  disabled={isLoading}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleFinalStopWorkSession}
                  disabled={isLoading}
                  className="flex-1 btn btn-danger"
                >
                  {isLoading ? 'Beende...' : 'Arbeit beenden'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// OrdersTab Component
const OrdersTab = ({ 
  activeUser, 
  userPin,
  userAttendance,
  isLoading, 
  setIsLoading,
  currentWorkSession,
  setCurrentWorkSession,
  availableOrders,
  setAvailableOrders,
  showManualOrder,
  setShowManualOrder,
  manualOrderNumber,
  setManualOrderNumber,
  handleStopWorkSession
}) => {
  const [workCategories, setWorkCategories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Load available orders and categories
  useEffect(() => {
    if (activeUser && userPin) {
      loadOrdersAndCategories();
      loadCurrentSession();
    }
  }, [activeUser, userPin]);

  const loadOrdersAndCategories = async () => {
    try {
      const [ordersResponse, categoriesResponse] = await Promise.all([
        workOrdersAPI.kioskGetAvailable({
          employeeNumber: activeUser.employee_number,
          pin: userPin
        }),
        categoriesAPI.kioskGetAll({
          employeeNumber: activeUser.employee_number,
          pin: userPin
        })
      ]);

      setAvailableOrders(ordersResponse.data.data || []);
      
      // Handle the new category structure
      console.log('Kiosk categories response:', categoriesResponse.data);
      const categoryData = categoriesResponse.data.data || {};
      
      // Check if it's the new structure or old structure
      if (categoryData.workCategories) {
        // New structure with separated categories
        setWorkCategories(categoryData.workCategories || []);
        console.log('Setting workCategories to:', categoryData.workCategories);
      } else if (Array.isArray(categoryData)) {
        // Old structure - fallback
        setWorkCategories(categoryData.filter(cat => cat.is_productive));
      }
    } catch (error) {
      console.error('Error loading orders and categories:', error);
    }
  };

  const loadCurrentSession = async () => {
    try {
      const response = await workSessionsAPI.kioskGetCurrent({
        employeeNumber: activeUser.employee_number,
        pin: userPin
      });
      setCurrentWorkSession(response.data.data);
    } catch (error) {
      console.error('Error loading current session:', error);
    }
  };

  const handleStartWorkSession = async (workOrderId, taskDescription = '') => {
    // Check if user is clocked in first
    if (!userAttendance) {
      toast.error('Sie müssen zuerst einstempeln, bevor Sie an einem Auftrag arbeiten können.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await workSessionsAPI.kioskStart({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        workOrderId,
        taskDescription
      });
      toast.success(response.data.message);
      setCurrentWorkSession(response.data.session);
      setShowManualOrder(false);
      setManualOrderNumber('');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Starten der Arbeitssitzung';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartActivity = async (categoryId, taskDescription = '') => {
    // Check if user is clocked in first
    if (!userAttendance) {
      toast.error('Sie müssen zuerst einstempeln, bevor Sie eine Aktivität starten können.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await workSessionsAPI.kioskStart({
        employeeNumber: activeUser.employee_number,
        pin: userPin,
        categoryId,
        taskDescription
      });
      toast.success(response.data.message);
      setCurrentWorkSession(response.data.session);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Starten der Aktivität';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Search for work orders based on input - simplified version
  const searchWorkOrders = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      // For now, we'll use available orders and filter them client-side
      const filteredOrders = availableOrders.filter(order => 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      setSearchResults(filteredOrders);
      setShowDropdown(filteredOrders.length > 0);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  // Handle input change with debouncing
  const handleOrderNumberChange = (e) => {
    const value = e.target.value;
    setManualOrderNumber(value);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for search
    const newTimeout = setTimeout(() => {
      searchWorkOrders(value);
    }, 300); // 300ms debounce
    
    setSearchTimeout(newTimeout);
  };

  // Handle manual order submit - only allow existing orders
  const handleManualOrderSubmit = async (orderNumber = null) => {
    const orderNum = orderNumber || manualOrderNumber.trim();
    
    if (!orderNum) {
      toast.error('Bitte geben Sie eine Auftragsnummer ein');
      return;
    }

    // Check if user is clocked in first
    if (!userAttendance) {
      toast.error('Sie müssen zuerst einstempeln, bevor Sie an einem Auftrag arbeiten können.');
      return;
    }

    // Find the order in available orders
    const existingOrder = availableOrders.find(order => 
      order.order_number === orderNum
    );

    if (!existingOrder) {
      toast.error(`Auftrag "${orderNum}" existiert nicht oder ist nicht verfügbar.`);
      return;
    }

    // Use the existing order
    handleStartWorkSession(existingOrder.id, `Auftrag: ${existingOrder.order_number}`);
  };

  // Handle dropdown selection
  const handleSelectOrder = (order) => {
    setManualOrderNumber(order.order_number);
    setShowDropdown(false);
    setSearchResults([]);
    // Use the existing handleStartWorkSession for real work orders
    handleStartWorkSession(order.id, `Auftrag: ${order.order_number}`);
  };

  return (
    <div className="space-y-4">

      {!currentWorkSession && (
        <>
          {/* Available Work Orders */}
          {availableOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Verfügbare Aufträge</h3>
              <div className="space-y-2">
                {availableOrders.slice(0, 5).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleStartWorkSession(order.id)}
                    disabled={isLoading}
                    className="w-full p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{order.order_number}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {order.description?.substring(0, 50)}
                          {order.description?.length > 50 ? '...' : ''}
                        </div>
                        {order.customer_name && (
                          <div className="text-xs text-gray-500 mt-1">
                            {order.customer_name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.priority === 'high' && '🔴'}
                        {order.priority === 'urgent' && '🚨'}
                        {order.priority === 'normal' && '🟡'}
                        {order.priority === 'low' && '🟢'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Work Categories (Werkstattpflege, etc.) */}
          {workCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Allgemeine Arbeiten</h3>
              <div className="grid grid-cols-2 gap-2">
                {workCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleStartActivity(category.id, category.name)}
                    disabled={isLoading}
                    className="p-3 text-center bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-green-800 block">
                        {category.name}
                      </span>
                      <span className="text-xs text-green-600">
                        {category.is_productive ? '(produktiv)' : '(nicht produktiv)'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Order Entry */}
          <div>
            <button
              onClick={() => setShowManualOrder(!showManualOrder)}
              className="w-full btn btn-secondary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Andere Auftragsnummer eingeben
            </button>

            {showManualOrder && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auftragsnummer:
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={manualOrderNumber}
                      onChange={handleOrderNumberChange}
                      onFocus={() => {
                        if (searchResults.length > 0) {
                          setShowDropdown(true);
                        }
                      }}
                      className="form-input w-full"
                      placeholder="z.B. 04711 oder WO2024005"
                    />
                    
                    {/* Dropdown with search results */}
                    {showDropdown && searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((order) => (
                          <button
                            key={order.id}
                            onClick={() => handleSelectOrder(order)}
                            className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            disabled={isLoading}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{order.order_number}</div>
                                {order.description && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    {order.description.substring(0, 50)}
                                    {order.description.length > 50 ? '...' : ''}
                                  </div>
                                )}
                                {order.customer_name && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {order.customer_name}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {order.status === 'pending' && '🟡'}
                                {order.status === 'in_progress' && '🟠'}
                                {order.priority === 'high' && '🔴'}
                                {order.priority === 'urgent' && '🚨'}
                              </div>
                            </div>
                          </button>
                        ))}
                        
                        {/* Show message if no matches found */}
                        {manualOrderNumber.trim() && searchResults.length === 0 && (
                          <div className="px-4 py-3 text-center text-gray-500 text-sm">
                            Keine bestehenden Aufträge gefunden für "{manualOrderNumber.trim()}"
                            <br />
                            <span className="text-xs text-red-600">Nur bestehende Aufträge können gestartet werden</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleManualOrderSubmit()}
                    disabled={isLoading || !manualOrderNumber.trim() || !availableOrders.find(o => o.order_number === manualOrderNumber.trim())}
                    className="btn btn-primary"
                  >
                    Start
                  </button>
                </div>
                
                {/* Click outside to close dropdown */}
                {showDropdown && (
                  <div 
                    className="fixed inset-0 z-5"
                    onClick={() => setShowDropdown(false)}
                  />
                )}
              </div>
            )}
          </div>

          {availableOrders.length === 0 && workCategories.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Keine Aufträge verfügbar</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Breaks Tab Component
const BreaksTab = ({ 
  userBreak,
  isLoading, 
  currentWorkSession,
  breakCategories,
  handleBreakStart,
  handleBreakStop 
}) => {

  return (
    <div>
      {/* Current Break Status */}
      {userBreak && (
        <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-yellow-800">Aktuelle Pause</h3>
              <p className="text-yellow-700">
                {userBreak.category_name}
              </p>
              <p className="text-sm text-yellow-600">
                Gestartet: {new Date(userBreak.start_time).toLocaleTimeString('de-DE')}
              </p>
            </div>
            <button
              onClick={handleBreakStop}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              <Square className="w-4 h-4 mr-2 inline" />
              Beenden
            </button>
          </div>
        </div>
      )}

      {/* Current Work Session Warning */}
      {currentWorkSession && !userBreak && (
        <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
          <div className="text-center">
            <h3 className="font-semibold text-orange-800 mb-2">Sie arbeiten gerade</h3>
            <p className="text-orange-700 mb-3">
              Auftrag: {currentWorkSession.order_number || currentWorkSession.category_name}
            </p>
            <p className="text-sm text-orange-600 mb-4">
              Sie müssen zuerst den Auftrag beenden, bevor Sie eine Pause machen können.
            </p>
          </div>
        </div>
      )}

      {/* Break Categories */}
      {!userBreak && !currentWorkSession && breakCategories && breakCategories.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Pausenarten</h3>
          <div className="grid grid-cols-2 gap-3">
            {breakCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleBreakStart(category.id)}
                disabled={isLoading}
                className="p-4 text-center bg-yellow-50 hover:bg-yellow-100 rounded-lg border-2 border-yellow-200 transition-colors"
                style={{ 
                  borderColor: category.color,
                  backgroundColor: category.color + '20'
                }}
              >
                <div className="flex flex-col items-center">
                  <div 
                    className="w-8 h-8 rounded-full mb-2" 
                    style={{ backgroundColor: category.color }}
                  />
                  <div>
                    <span className="font-medium text-gray-800 block">{category.name}</span>
                  </div>
                  {category.max_duration_minutes && (
                    <span className="text-xs text-gray-500 mt-1">
                      Max. {category.max_duration_minutes} Min.
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Categories Available */}
      {!userBreak && !currentWorkSession && breakCategories && breakCategories.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <Coffee className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Keine Pausenkategorien verfügbar</p>
        </div>
      )}
    </div>
  );
};

export default KioskMode;