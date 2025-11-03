import React, { useState, useEffect } from 'react';
import { Clock, User, Play, Square, Coffee, Briefcase, Copy } from 'lucide-react';
import { workSessionsAPI, breaksAPI, attendanceAPI, workOrdersAPI, categoriesAPI } from '../services/api';
import toast from 'react-hot-toast';

const WorkOrderTerminal = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workType, setWorkType] = useState('order'); // 'order' or 'category'
  const [isLoading, setIsLoading] = useState(false);
  const [activeWork, setActiveWork] = useState([]);
  const [freeWorkCategories, setFreeWorkCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active work sessions and free work categories
  const loadData = async () => {
    try {
      const [workRes, categoriesRes, attendanceRes] = await Promise.all([
        workSessionsAPI.getActive(),
        categoriesAPI.getFreeWork(),
        attendanceAPI.getActiveAttendances()
      ]);

      const workSessions = workRes.data || [];
      const categories = categoriesRes.data || [];
      const attendance = attendanceRes.data || [];

      // Combine work sessions with attendance data
      const combinedData = workSessions.map(work => {
        const attendanceData = attendance.find(att => att.user_id === work.user_id);
        
        // Calculate total attendance time
        let attendanceTime = '--';
        if (attendanceData && attendanceData.clock_in) {
          const startTime = new Date(attendanceData.clock_in);
          const now = new Date();
          const diffMs = now - startTime;
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          attendanceTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        return {
          ...work,
          attendanceTime,
          clockInTime: attendanceData?.clock_in
        };
      });

      setActiveWork(combinedData);
      setFreeWorkCategories(categories);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
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

  // Calculate work duration
  const calculateWorkDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
      toast.error('Bitte Freie Arbeit auswählen');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        employeeNumber: employeeNumber.trim(),
        ...(workType === 'order' 
          ? { orderNumber: orderNumber.trim() }
          : { categoryId: parseInt(selectedCategory) }
        )
      };

      await workSessionsAPI.kioskStart(payload);
      toast.success('Arbeit gestartet!');
      
      setEmployeeNumber('');
      setOrderNumber('');
      setSelectedCategory('');
      setTimeout(loadData, 500);
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
      await workSessionsAPI.kioskStop({
        employeeNumber: employeeNumber.trim()
      });
      toast.success('Arbeit beendet!');
      
      setEmployeeNumber('');
      setTimeout(loadData, 500);
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
      if (action === 'start') {
        await breaksAPI.kioskStart({
          employeeNumber: employeeNumber.trim(),
          categoryId: 8 // Default Standard Pause category
        });
        toast.success('Pause gestartet!');
      } else {
        await breaksAPI.kioskStop({
          employeeNumber: employeeNumber.trim()
        });
        toast.success('Pause beendet!');
      }
      
      setEmployeeNumber('');
      setTimeout(loadData, 500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Fehler beim ${action === 'start' ? 'Starten' : 'Beenden'} der Pause`;
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyOrderNumber = (orderNum) => {
    setOrderNumber(orderNum);
    setWorkType('order');
    toast.success(`Auftragsnummer ${orderNum} übernommen`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Auftrags-Terminal</h1>
          <div className="text-sm text-gray-500">
            Live-Update alle 10 Sekunden
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Side - Active Work List (2/3) */}
        <div className="flex-1 bg-white m-6 rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-800">
              Aktive Arbeiten ({activeWork.length})
            </h2>
          </div>
          
          <div className="overflow-auto h-full">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : activeWork.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Briefcase className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg">Derzeit arbeitet niemand an Aufträgen</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personal-Nr</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bemerkung</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zeit (Anwesenheit)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job v.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeWork.map((work) => (
                    <tr key={work.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{work.employee_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {work.first_name} {work.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Briefcase className="w-3 h-3 mr-1" />
                            {work.order_number || work.category_name}
                          </span>
                          {work.order_number && (
                            <button
                              onClick={() => copyOrderNumber(work.order_number)}
                              className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Auftragsnummer übernehmen"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{work.attendanceTime}</span>
                          {work.clockInTime && (
                            <span className="text-xs text-gray-500">seit {formatTimeShort(work.clockInTime)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{formatTimeShort(work.start_time)}</span>
                          <span className="text-xs text-gray-500">({calculateWorkDuration(work.start_time)})</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side - Controls (1/3) */}
        <div className="w-96 bg-white m-6 rounded-lg shadow p-6">
          <div className="space-y-6">
            
            {/* Current Time */}
            <div className="text-center bg-blue-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {formatTime(currentTime)}
              </div>
            </div>

            {/* Employee Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal-Nr
              </label>
              <input
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. 001"
                disabled={isLoading}
              />
            </div>

            {/* Work Type Selection */}
            <div className="space-y-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setWorkType('order')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    workType === 'order' 
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent'
                  }`}
                >
                  Auftragsnummer
                </button>
                <button
                  onClick={() => setWorkType('category')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${
                    workType === 'category' 
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent'
                  }`}
                >
                  Freie Arbeit
                </button>
              </div>

              {workType === 'order' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auftragsnummer
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. WO-1234"
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Freie Arbeit
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">Auswählen...</option>
                    {freeWorkCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStartWork}
                  disabled={isLoading || !employeeNumber.trim() || (workType === 'order' && !orderNumber.trim()) || (workType === 'category' && !selectedCategory)}
                  className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Starten
                    </>
                  )}
                </button>
                <button
                  onClick={handleStopWork}
                  disabled={isLoading || !employeeNumber.trim()}
                  className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Square className="w-4 h-4 mr-1" />
                      Beenden
                    </>
                  )}
                </button>
              </div>
              
              <button
                onClick={() => handleBreakAction('start')}
                disabled={isLoading || !employeeNumber.trim()}
                className="w-full flex items-center justify-center px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Coffee className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleBreakAction('stop')}
                disabled={isLoading || !employeeNumber.trim()}
                className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Coffee className="w-4 h-4 mr-2" />
                    Pause Beenden
                  </>
                )}
              </button>
            </div>

            {/* Summary Stats */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Übersicht</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Aktive Arbeiten:</span>
                  <span className="font-semibold">{activeWork.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Aufträge:</span>
                  <span className="font-semibold">
                    {activeWork.filter(w => w.order_number).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Freie Arbeiten:</span>
                  <span className="font-semibold">
                    {activeWork.filter(w => !w.order_number).length}
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

export default WorkOrderTerminal;