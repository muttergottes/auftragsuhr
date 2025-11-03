import React, { useState, useEffect, useRef } from 'react';
import { Clock, User, Play, Square, Coffee, Briefcase, Copy } from 'lucide-react';
import { workSessionsAPI, breaksAPI, attendanceAPI, workOrdersAPI, categoriesAPI, systemAPI } from '../services/api';
import toast from 'react-hot-toast';

const SimpleWorkOrders = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workType, setWorkType] = useState('order'); // 'order' or 'category'
  const [isLoading, setIsLoading] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [freeWorkCategories, setFreeWorkCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);
  const [smartButtonText, setSmartButtonText] = useState('Job starten');
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);
  const employeeNumberInputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load live work data
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

      // Load categories separately to handle errors
      try {
        const categoriesRes = await categoriesAPI.getFreeWork();
        const categories = categoriesRes.data?.data || categoriesRes.data || [];
        console.log('Categories loaded:', categories);
        setFreeWorkCategories(categories);
      } catch (categoryError) {
        console.error('Error loading categories:', categoryError);
        // Use fallback categories
        setFreeWorkCategories([
          { id: 1, name: 'Wartung', color: '#blue' },
          { id: 2, name: 'Schulung', color: '#green' },
          { id: 3, name: 'Reinigung', color: '#yellow' }
        ]);
      }

      // Combine data for each present employee
      const combinedData = attendance.map(att => {
        const userBreak = breaks.find(br => br.user_id === att.user_id);
        const userWork = workSessions.find(ws => ws.user_id === att.user_id);
        
        let status = 'Anwesend';
        let statusClass = 'bg-green-100 text-green-800';
        let jobFrom = null;
        let bemerkung = '--';
        
        if (userBreak) {
          status = userBreak.category_name;
          statusClass = 'bg-yellow-100 text-yellow-800';
          bemerkung = `Pause: ${userBreak.category_name}`;
        } else if (userWork) {
          status = `${userWork.order_number || userWork.category_name}`;
          statusClass = 'bg-blue-100 text-blue-800';
          jobFrom = userWork.start_time;
          bemerkung = userWork.order_number || userWork.category_name;
        }
        
        return {
          ...att,
          status,
          statusClass,
          jobFrom,
          bemerkung,
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

  const formatTimeShort = (dateString) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle clicking on work item to auto-fill terminal for ending
  const handleWorkItemClick = async (employee) => {
    if (employee.currentWork) {
      setEmployeeNumber(employee.employee_number);
      if (employee.currentWork.order_number) {
        setWorkType('order');
        setOrderNumber(employee.currentWork.order_number);
        setSelectedCategory('');
      } else if (employee.currentWork.category_name) {
        setWorkType('category');
        setOrderNumber('');
        setSelectedCategory(employee.currentWork.category_id?.toString() || '');
      }
      // Check user status for smart enter functionality
      await checkUserStatus(employee.employee_number);
      toast.success(`Terminal vorbereitet für ${employee.first_name} ${employee.last_name}`);
      
      // Focus back to employee number input for Enter functionality
      setTimeout(() => {
        if (employeeNumberInputRef.current) {
          employeeNumberInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleStartWork = async () => {
    if (!employeeNumber.trim()) {
      toast.error('Bitte Personalnummer eingeben');
      return;
    }

    if (workType === 'order' && !orderNumber.trim()) {
      toast.error('Bitte Auftragsnummer eingeben');
      return;
    }

    if (workType === 'category' && !selectedCategory) {
      toast.error('Bitte eine freie Aktivität auswählen');
      return;
    }

    setIsLoading(true);
    try {
      if (workType === 'order') {
        const response = await workSessionsAPI.kioskStartWithOrder({
          employeeNumber: employeeNumber.trim(),
          orderNumber: orderNumber.trim()
        });
        toast.success(response.data.message || `Arbeit an Auftrag ${orderNumber} gestartet!`);
      } else {
        const response = await workSessionsAPI.kioskStartWithCategory({
          employeeNumber: employeeNumber.trim(),
          categoryId: parseInt(selectedCategory)
        });
        toast.success(response.data.message || 'Aktivität gestartet!');
      }
      
      setEmployeeNumber('');
      setOrderNumber('');
      setSelectedCategory('');
      setTimeout(loadLiveData, 500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Starten der Arbeit';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopWork = async () => {
    if (!employeeNumber.trim()) {
      toast.error('Bitte Personalnummer eingeben');
      return;
    }

    setIsLoading(true);
    try {
      const response = await workSessionsAPI.kioskStopSimple({
        employeeNumber: employeeNumber.trim()
      });
      toast.success(response.data.message || 'Arbeit beendet!');
      
      setEmployeeNumber('');
      setOrderNumber('');
      setSelectedCategory('');
      setTimeout(loadLiveData, 500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Beenden der Arbeit';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakAction = async (action) => {
    if (!employeeNumber.trim()) {
      toast.error('Bitte Personalnummer eingeben');
      return;
    }

    setIsLoading(true);
    try {
      if (action === 'break-start') {
        const response = await breaksAPI.kioskStartSimple({
          employeeNumber: employeeNumber.trim(),
          categoryId: 8 // Standard pause category
        });
        toast.success(response.data.message || 'Pause gestartet!');
      } else if (action === 'break-end') {
        const response = await breaksAPI.kioskStopSimple({
          employeeNumber: employeeNumber.trim()
        });
        toast.success(response.data.message || 'Pause beendet!');
      }
      
      setEmployeeNumber('');
      setTimeout(loadLiveData, 500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Aktion fehlgeschlagen';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check user status when employee number changes
  const checkUserStatus = async (empNum) => {
    if (!empNum || empNum.length < 2) {
      setUserStatus(null);
      setSmartButtonText('Job starten');
      return;
    }

    try {
      const response = await systemAPI.getUserStatus(empNum);
      const status = response.data.data.status;
      setUserStatus(status);
      
      if (status.hasActiveJob) {
        setSmartButtonText(`Job beenden (${status.activeJob.orderNumber || status.activeJob.categoryName})`);
      } else {
        setSmartButtonText('Job starten');
      }
    } catch (error) {
      setUserStatus(null);
      setSmartButtonText('Job starten');
    }
  };

  // Smart Enter Handler
  const handleSmartEnter = async () => {
    if (!employeeNumber.trim()) {
      toast.error('Bitte Personalnummer eingeben');
      return;
    }

    if (!userStatus) {
      await checkUserStatus(employeeNumber.trim());
      return;
    }

    // Validation for starting new jobs
    if (!userStatus.hasActiveJob) {
      if (workType === 'order' && !orderNumber.trim()) {
        toast.error('Bitte Auftragsnummer eingeben');
        return;
      }

      if (workType === 'category' && !selectedCategory) {
        toast.error('Bitte eine freie Aktivität auswählen');
        return;
      }
    }

    // Double-enter confirmation
    if (!confirmationNeeded) {
      setConfirmationNeeded(true);
      if (userStatus.hasActiveJob) {
        toast('⚡ Drücken Sie Enter erneut zum Beenden', {
          duration: 3000,
          style: { backgroundColor: '#fef3c7', color: '#92400e' }
        });
      } else {
        toast('⚡ Drücken Sie Enter erneut zum Starten', {
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
      if (userStatus.hasActiveJob) {
        // Stop current job
        const response = await workSessionsAPI.kioskStopSimple({
          employeeNumber: employeeNumber.trim()
        });
        toast.success(response.data.message || 'Job beendet!');
      } else {
        // Start new job
        if (workType === 'order') {
          const response = await workSessionsAPI.kioskStartWithOrder({
            employeeNumber: employeeNumber.trim(),
            orderNumber: orderNumber.trim()
          });
          toast.success(response.data.message || `Arbeit an Auftrag ${orderNumber} gestartet!`);
        } else {
          const response = await workSessionsAPI.kioskStartWithCategory({
            employeeNumber: employeeNumber.trim(),
            categoryId: parseInt(selectedCategory)
          });
          toast.success(response.data.message || 'Aktivität gestartet!');
        }
      }
      
      setEmployeeNumber('');
      setOrderNumber('');
      setSelectedCategory('');
      setUserStatus(null);
      setSmartButtonText('Job starten');
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Aufträge-Terminal</h1>
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
            <p className="text-sm text-gray-600 mt-1">
              Klicken Sie auf eine Bemerkung um das Terminal vorzufüllen
            </p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zeit</th>
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
                        {employee.currentWork ? (
                          <button
                            onClick={() => handleWorkItemClick(employee)}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors"
                            title="Klicken zum Vorausfüllen des Terminals"
                          >
                            <Briefcase className="w-3 h-3 mr-1" />
                            {employee.bemerkung}
                            <Copy className="w-3 h-3 ml-1" />
                          </button>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.statusClass}`}>
                            {employee.currentBreak && <Coffee className="w-3 h-3 mr-1" />}
                            {!employee.currentWork && !employee.currentBreak && <User className="w-3 h-3 mr-1" />}
                            {employee.bemerkung}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimeShort(employee.clock_in)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.jobFrom ? formatTimeShort(employee.jobFrom) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side - Terminal (1/3) */}
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
                  ref={employeeNumberInputRef}
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => handleEmployeeNumberChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSmartEnter()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. 001"
                />
              </div>

              {/* Order Number Input */}
              {workType === 'order' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auftragsnummer
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSmartEnter()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. WO2024001"
                  />
                </div>
              )}

              {/* Category Dropdown */}
              {workType === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Freie Aktivität
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSmartEnter()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aktivität wählen... ({freeWorkCategories.length} verfügbar)</option>
                    {freeWorkCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                  </div>
                </div>
              )}

              {/* Work Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arbeitstyp
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setWorkType('order');
                      setSelectedCategory('');
                    }}
                    className={`p-3 rounded-lg text-sm font-medium border ${
                      workType === 'order'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Auftrag
                  </button>
                  <button
                    onClick={() => {
                      setWorkType('category');
                      setOrderNumber('');
                    }}
                    className={`p-3 rounded-lg text-sm font-medium border ${
                      workType === 'category'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Freie Tätigkeit
                  </button>
                </div>
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
                    : userStatus?.hasActiveJob 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {userStatus?.hasActiveJob ? (
                  <Square className="w-5 h-5 mr-2" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                {confirmationNeeded ? 'Enter = Bestätigen' : smartButtonText}
              </button>
              
              {userStatus?.hasActiveJob && (
                <div className="text-sm text-center text-gray-600 bg-yellow-50 p-2 rounded">
                  ⚡ Drücken Sie Enter oder klicken Sie zum Beenden des aktuellen Jobs
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={handleStartWork}
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Manuell starten
                </button>
                <button
                  onClick={handleStopWork}
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 text-sm"
                >
                  <Square className="w-4 h-4 mr-1" />
                  Manuell beenden
                </button>
              </div>
              
              <button
                onClick={() => handleBreakAction('break-start')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
              >
                <Coffee className="w-4 h-4 mr-2" />
                Pause
              </button>
              
              <button
                onClick={() => handleBreakAction('break-end')}
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

export default SimpleWorkOrders;