import React, { useState, useEffect } from 'react';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { workSessionsAPI, breaksAPI, attendanceAPI } from '../services/api';

// Helper function to convert UTC time to local time display
const formatLocalTime = (utcTimeString) => {
  // Remove the 'Z' to prevent UTC interpretation, then create date
  const localTimeString = utcTimeString.replace('Z', '');
  return new Date(localTimeString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

// Helper function to convert UTC time to datetime-local input format
const formatLocalDateTime = (utcTimeString) => {
  // For datetime-local inputs, we want the same approach as formatLocalTime
  // Remove the 'Z' and format as local datetime-local string
  const localTimeString = utcTimeString.replace('Z', '');
  const date = new Date(localTimeString);
  
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const Statistics = () => {
  const [statistics, setStatistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
  
  // Edit/Delete states
  const [showEditWorkSessionModal, setShowEditWorkSessionModal] = useState(false);
  const [showEditBreakSessionModal, setShowEditBreakSessionModal] = useState(false);
  const [showEditAttendanceModal, setShowEditAttendanceModal] = useState(false);
  const [editingWorkSession, setEditingWorkSession] = useState(null);
  const [editingBreakSession, setEditingBreakSession] = useState(null);
  const [editingAttendance, setEditingAttendance] = useState(null);


  // Tooltip definitions for KPIs
  const tooltips = {
    anwesenheit: {
      title: "Anwesenheit",
      description: "Gesamte Zeit zwischen Ein- und Ausstempeln. Alle Zeiträume vom ersten Einstempeln bis zum letzten Ausstempeln werden zusammengezählt."
    },
    pause: {
      title: "Pause", 
      description: "Gesamte Pausenzeit aller Pausensitzungen. Umfasst Kaffeepausen, Mittagspausen und alle anderen Unterbrechungen."
    },
    auftraege: {
      title: "Aufträge",
      description: "Zeit, die an konkreten Kundenaufträgen gearbeitet wurde. Nur Arbeitssitzungen mit hinterlegter Auftragsnummer."
    },
    interne_arbeit: {
      title: "Interne Arbeit", 
      description: "Zeit für interne Tätigkeiten ohne direkten Auftragsbezug. Beispiele: Diagnose, Werkstattarbeiten, Schulungen, Aufräumen."
    },
    leerlauf: {
      title: "Leerlauf",
      description: "Zeit ohne produktive Tätigkeit. Errechnet sich aus: Anwesenheit minus Pausen minus Aufträge minus interne Arbeit."
    },
    auftragsproduktivitaet: {
      title: "Auftragsproduktivität",
      description: "Anteil der Auftragsarbeit an der tatsächlichen Arbeitszeit (Anwesenheit minus Pausen). Zeigt wie viel Prozent der produktiven Zeit für Kundenaufträge verwendet wurde."
    },
    produktivitaet: {
      title: "Produktivität",
      description: "Anteil produktiver Arbeitszeit an der Gesamtanwesenheit. Kombination aus Auftragsarbeit und interner Arbeit."
    }
  };

  // Tooltip component
  const Tooltip = ({ id, tooltip, isLastColumn = false }) => {
    const isActive = activeTooltip === id;
    
    return (
      <div className="relative inline-block ml-1">
        <button
          type="button"
          onMouseEnter={() => setActiveTooltip(id)}
          onMouseLeave={() => setActiveTooltip(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        
        {isActive && (
          <div className={`absolute z-[9999] top-full mt-2 w-64 bg-gray-800 text-white text-sm rounded-lg p-3 shadow-lg ${
            isLastColumn ? 'right-0' : 'left-1/2 transform -translate-x-1/2'
          }`}>
            <div className="font-semibold mb-1">{tooltip.title}</div>
            <div className="text-gray-200">{tooltip.description}</div>
            <div className={`absolute bottom-full border-4 border-transparent border-b-gray-800 ${
              isLastColumn ? 'right-4' : 'left-1/2 transform -translate-x-1/2'
            }`}></div>
          </div>
        )}
      </div>
    );
  };

  // Handler functions for editing and deleting
  const handleEditWorkSession = (session) => {
    setEditingWorkSession(session);
    setShowEditWorkSessionModal(true);
  };

  const handleDeleteWorkSession = async (session) => {
    if (!window.confirm(`Sind Sie sicher, dass Sie diese Arbeitssitzung löschen möchten?\n\nTyp: ${session.type === 'order' ? 'Auftrag' : 'Intern'}\nDatum: ${format(new Date(session.start_time), 'dd.MM.yyyy', { locale: de })}`)) {
      return;
    }
    
    try {
      await workSessionsAPI.delete(session.id);
      toast.success('Arbeitssitzung erfolgreich gelöscht!');
      // Reload user details
      if (selectedUser) {
        fetchUserDetail(selectedUser.id);
      }
    } catch (error) {
      toast.error('Fehler beim Löschen der Arbeitssitzung');
      console.error('Error deleting work session:', error);
    }
  };

  const handleEditBreakSession = (breakSession) => {
    console.log('handleEditBreakSession called with:', breakSession);
    setEditingBreakSession(breakSession);
    setShowEditBreakSessionModal(true);
  };

  const handleDeleteBreakSession = async (breakSession) => {
    console.log('handleDeleteBreakSession called with:', breakSession);
    console.log('breakSession.id:', breakSession.id);
    console.log('typeof breakSession.id:', typeof breakSession.id);
    console.log('All breakSession keys:', Object.keys(breakSession));
    if (!window.confirm(`Sind Sie sicher, dass Sie diese Pause löschen möchten?\n\nKategorie: ${breakSession.category_name}\nDatum: ${format(new Date(breakSession.start_time), 'dd.MM.yyyy', { locale: de })}`)) {
      return;
    }
    
    try {
      await breaksAPI.delete(breakSession.id);
      toast.success('Pause erfolgreich gelöscht!');
      // Reload user details
      if (selectedUser) {
        fetchUserDetail(selectedUser.id);
      }
    } catch (error) {
      toast.error('Fehler beim Löschen der Pause');
      console.error('Error deleting break session:', error);
    }
  };

  const handleEditAttendance = (attendance) => {
    setEditingAttendance(attendance);
    setShowEditAttendanceModal(true);
  };

  const handleDeleteAttendance = async (attendance) => {
    if (!window.confirm(`Sind Sie sicher, dass Sie diesen Anwesenheitsstempel löschen möchten?\n\nDatum: ${format(new Date(attendance.date), 'dd.MM.yyyy', { locale: de })}`)) {
      return;
    }
    
    try {
      await attendanceAPI.deleteAttendance(attendance.id);
      toast.success('Anwesenheitsstempel erfolgreich gelöscht!');
      // Reload user details
      if (selectedUser) {
        fetchUserDetail(selectedUser.id);
      }
    } catch (error) {
      toast.error('Fehler beim Löschen des Anwesenheitsstempels');
      console.error('Error deleting attendance:', error);
    }
  };

  // Date range options
  const getDateRange = () => {
    const today = new Date();
    
    switch (dateRange) {
      case 'today':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return {
          start: format(yesterday, 'yyyy-MM-dd'),
          end: format(yesterday, 'yyyy-MM-dd')
        };
      case 'lastWeek':
        const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        return {
          start: format(lastWeekStart, 'yyyy-MM-dd'),
          end: format(lastWeekEnd, 'yyyy-MM-dd')
        };
      case 'week':
        return {
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return {
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        };
      case 'month':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'custom':
        return {
          start: customStartDate,
          end: customEndDate
        };
      default:
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd')
        };
    }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { start, end } = getDateRange();
      if (!start || !end) return;
      
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/statistics/admin-overview?startDate=${start}&endDate=${end}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Statistiken');
      }

      const data = await response.json();
      if (data.success) {
        setStatistics(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId) => {
    try {
      const { start, end } = getDateRange();
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/statistics/user-detail/${userId}?startDate=${start}&endDate=${end}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Benutzerdetails');
      }

      const data = await response.json();
      if (data.success) {
        setUserDetail(data.data);
      }
    } catch (err) {
      console.error('Error fetching user detail:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [dateRange, customStartDate, customEndDate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatistics();
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange, customStartDate, customEndDate]);

  const handleUserClick = (user) => {
    setSelectedUser(user);
    fetchUserDetail(user.id);
  };

  // Function to get display text for current date range
  const getDateRangeText = () => {
    const dateRanges = getDateRange();
    const start = dateRanges.start;
    const end = dateRanges.end;
    
    if (!start || !end) return 'Kein Zeitraum ausgewählt';
    
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };
    
    const startFormatted = formatDate(start);
    const endFormatted = formatDate(end);
    
    if (start === end) {
      return `Zeitraum: ${startFormatted}`;
    } else {
      return `Zeitraum: ${startFormatted} - ${endFormatted}`;
    }
  };

  const exportToCSV = () => {
    const { start, end } = getDateRange();
    const csvData = [
      ['Mitarbeiter', 'Anwesenheit', 'Pause', 'Aufträge', 'Interne Arbeit', 'Leerlauf', '%Produktiv'],
      ...statistics.map(stat => [
        stat.user.full_name,
        stat.formatted.attendance,
        stat.formatted.break,
        stat.formatted.order_work,
        stat.formatted.internal_work,
        stat.formatted.idle,
        `${stat.percentages.total_work}%`
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `statistik_${start}_${end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Statistiken...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Fehler</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
                <div className="mt-4">
                  <button
                    onClick={fetchStatistics}
                    className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm"
                  >
                    Erneut versuchen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Statistiken</h1>
          <p className="mt-2 text-gray-600">
            Übersicht über Anwesenheit, Pausen und Arbeitszeiten
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Zeitraum wählen</h3>
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
              {getDateRangeText()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'today' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Heute
            </button>
            <button
              onClick={() => setDateRange('yesterday')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'yesterday' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Gestern
            </button>
            <button
              onClick={() => setDateRange('lastWeek')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'lastWeek' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Letzte Woche
            </button>
            <button
              onClick={() => setDateRange('week')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Diese Woche
            </button>
            <button
              onClick={() => setDateRange('lastMonth')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'lastMonth' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Letzter Monat
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'month' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Dieser Monat
            </button>
            <button
              onClick={() => setDateRange('custom')}
              className={`px-3 py-2 rounded text-sm ${
                dateRange === 'custom' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Benutzerdefiniert
            </button>
          </div>

          {dateRange === 'custom' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Von</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bis</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="mb-6">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Als CSV exportieren
          </button>
        </div>

        {/* Statistics Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Mitarbeiter-Übersicht ({statistics.length} Mitarbeiter)
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-xs table-fixed">
              <colgroup>
                <col className="w-32" />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-16" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    Mitarbeiter
                  </th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Anwesenheit
                      <Tooltip id="anwesenheit" tooltip={tooltips.anwesenheit} />
                    </div>
                  </th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Pause
                      <Tooltip id="pause" tooltip={tooltips.pause} />
                    </div>
                  </th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Aufträge
                      <Tooltip id="auftraege" tooltip={tooltips.auftraege} />
                    </div>
                  </th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Interne Arbeit
                      <Tooltip id="interne_arbeit" tooltip={tooltips.interne_arbeit} />
                    </div>
                  </th>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Leerlauf
                      <Tooltip id="leerlauf" tooltip={tooltips.leerlauf} />
                    </div>
                  </th>
                  <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase">
                    <div className="flex flex-col items-center">
                      <div>Aufträge</div>
                      <div className="flex items-center">
                        %<Tooltip id="auftragsproduktivitaet" tooltip={tooltips.auftragsproduktivitaet} />
                      </div>
                    </div>
                  </th>
                  <th className="px-1 py-1 text-center text-xs font-medium text-gray-500 uppercase">
                    <div className="flex flex-col items-center">
                      <div>Produktivität</div>
                      <div className="flex items-center">
                        %<Tooltip id="produktivitaet" tooltip={tooltips.produktivitaet} isLastColumn={true} />
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.map((stat) => (
                  <tr 
                    key={stat.user.id}
                    onClick={() => handleUserClick(stat.user)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {stat.user.full_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        #{stat.user.employee_number}
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-900">
                      {stat.formatted.attendance}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{stat.formatted.break}</div>
                      <div className="text-xs text-gray-500">{stat.percentages.break}%</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{stat.formatted.order_work}</div>
                      <div className="text-xs text-gray-500">{stat.percentages.order_work}%</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{stat.formatted.internal_work}</div>
                      <div className="text-xs text-gray-500">{stat.percentages.internal_work}%</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="text-xs text-gray-900">{stat.formatted.idle}</div>
                      <div className="text-xs text-gray-500">{stat.percentages.idle}%</div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <div className="w-full bg-gray-200 rounded-full h-1 mb-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full" 
                            style={{ width: `${Math.min(stat.percentages.order_work_of_worktime || stat.percentages.order_work, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-900">
                          {stat.percentages.order_work_of_worktime || stat.percentages.order_work}%
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <div className="w-full bg-gray-200 rounded-full h-1 mb-1">
                          <div 
                            className="bg-green-600 h-1 rounded-full" 
                            style={{ width: `${Math.min(stat.percentages.total_work, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-900">
                          {stat.percentages.total_work}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Detail Modal */}
        {selectedUser && userDetail && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Detailansicht: {userDetail.user.full_name}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setUserDetail(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Schließen</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Tagesübersicht</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Anwesenheit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetail.daily_breakdown.map((day) => (
                          <tr key={day.date}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {format(new Date(day.date), 'dd.MM.yyyy', { locale: de })}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{day.formatted.attendance}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{day.formatted.break}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-medium text-gray-900 mt-6">Anwesenheitszeiten</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Einstempeln</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ausstempeln</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetail.attendance_records && userDetail.attendance_records.map((record) => (
                          <tr key={record.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {format(new Date(record.date), 'dd.MM.yyyy', { locale: de })}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatLocalTime(record.clock_in)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatLocalTime(record.clock_out)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{record.formatted_duration}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              <div className="flex space-x-2">
                                {record.id ? (
                                  <>
                                    <button
                                      onClick={() => handleEditAttendance(record)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Bearbeiten"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAttendance(record)}
                                      className="text-red-600 hover:text-red-800"
                                      title="Löschen"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-xs">Keine ID</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-medium text-gray-900 mt-6">Pausenzeiten</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pausentyp</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Startzeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Endzeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetail.break_sessions && userDetail.break_sessions.length > 0 ? (
                          userDetail.break_sessions.map((breakSession, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {format(new Date(breakSession.date), 'dd.MM.yyyy', { locale: de })}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                                  {breakSession.category_name || 'Unbekannt'}
                                </span>
                                {breakSession.notes && (
                                  <div className="text-xs text-gray-500 mt-1">{breakSession.notes}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatLocalTime(breakSession.start_time)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatLocalTime(breakSession.end_time)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{breakSession.formatted_duration}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <div className="flex space-x-2">
                                  {breakSession.id ? (
                                    <>
                                      <button
                                        onClick={() => handleEditBreakSession(breakSession)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                        title="Bearbeiten"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBreakSession(breakSession)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                        title="Löschen"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-gray-400 text-xs">ID: {String(breakSession.id)} - Bearbeitung nicht möglich</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="px-4 py-2 text-sm text-gray-500 text-center">
                              Keine Pausen im ausgewählten Zeitraum
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-medium text-gray-900 mt-6">Arbeitssitzungen</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Startzeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Endzeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userDetail.work_sessions && userDetail.work_sessions.length > 0 ? (
                          userDetail.work_sessions.map((session, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {format(new Date(session.date), 'dd.MM.yyyy', { locale: de })}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  session.type === 'order' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {session.type === 'order' ? 'Auftrag' : 'Intern'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {session.order_number || session.category_name}
                                {session.task_description && (
                                  <div className="text-xs text-gray-500">{session.task_description}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatLocalTime(session.start_time)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {formatLocalTime(session.end_time)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{session.formatted_duration}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <div className="flex space-x-2">
                                  {session.id ? (
                                    <>
                                      <button
                                        onClick={() => handleEditWorkSession(session)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                        title="Bearbeiten"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteWorkSession(session)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                        title="Löschen"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-gray-400 text-xs">ID: {String(session.id)} - Bearbeitung nicht möglich</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="px-4 py-2 text-sm text-gray-500 text-center">
                              Keine Arbeitssitzungen im ausgewählten Zeitraum
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Work Session Modal */}
        {showEditWorkSessionModal && (
          <EditWorkSessionModal 
            session={editingWorkSession}
            onClose={() => {
              setShowEditWorkSessionModal(false);
              setEditingWorkSession(null);
            }}
            onSuccess={() => {
              setShowEditWorkSessionModal(false);
              setEditingWorkSession(null);
              if (selectedUser) {
                fetchUserDetail(selectedUser.id);
              }
            }}
          />
        )}

        {/* Edit Break Session Modal */}
        {showEditBreakSessionModal && (
          <EditBreakSessionModal 
            breakSession={editingBreakSession}
            onClose={() => {
              setShowEditBreakSessionModal(false);
              setEditingBreakSession(null);
            }}
            onSuccess={() => {
              setShowEditBreakSessionModal(false);
              setEditingBreakSession(null);
              if (selectedUser) {
                fetchUserDetail(selectedUser.id);
              }
            }}
          />
        )}

        {/* Edit Attendance Modal */}
        {showEditAttendanceModal && (
          <EditAttendanceModal 
            attendance={editingAttendance}
            onClose={() => {
              setShowEditAttendanceModal(false);
              setEditingAttendance(null);
            }}
            onSuccess={() => {
              setShowEditAttendanceModal(false);
              setEditingAttendance(null);
              if (selectedUser) {
                fetchUserDetail(selectedUser.id);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// EditWorkSessionModal Component
const EditWorkSessionModal = ({ session, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    start_time: session?.start_time ? formatLocalDateTime(session.start_time) : '',
    end_time: session?.end_time ? formatLocalDateTime(session.end_time) : '',
    notes: session?.notes || '',
    task_description: session?.task_description || ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await workSessionsAPI.update(session.id, formData);
      toast.success('Arbeitssitzung erfolgreich aktualisiert!');
      onSuccess();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Arbeitssitzung');
      console.error('Error updating work session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Arbeitssitzung bearbeiten
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Startzeit
            </label>
            <input
              type="datetime-local"
              name="start_time"
              value={formData.start_time}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endzeit
            </label>
            <input
              type="datetime-local"
              name="end_time"
              value={formData.end_time}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aufgabenbeschreibung
            </label>
            <textarea
              name="task_description"
              value={formData.task_description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notizen
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EditBreakSessionModal Component
const EditBreakSessionModal = ({ breakSession, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    start_time: breakSession?.start_time ? formatLocalDateTime(breakSession.start_time) : '',
    end_time: breakSession?.end_time ? formatLocalDateTime(breakSession.end_time) : '',
    notes: breakSession?.notes || ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await breaksAPI.update(breakSession.id, formData);
      toast.success('Pause erfolgreich aktualisiert!');
      onSuccess();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Pause');
      console.error('Error updating break session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Pause bearbeiten
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Startzeit
            </label>
            <input
              type="datetime-local"
              name="start_time"
              value={formData.start_time}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endzeit
            </label>
            <input
              type="datetime-local"
              name="end_time"
              value={formData.end_time}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notizen
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EditAttendanceModal Component
const EditAttendanceModal = ({ attendance, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    clock_in: attendance?.clock_in ? formatLocalDateTime(attendance.clock_in) : '',
    clock_out: attendance?.clock_out ? formatLocalDateTime(attendance.clock_out) : '',
    notes: attendance?.notes || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await attendanceAPI.updateAttendance(attendance.id, {
        clock_in: formData.clock_in,
        clock_out: formData.clock_out,
        notes: formData.notes
      });
      
      toast.success('Anwesenheitszeit erfolgreich aktualisiert!');
      onSuccess();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Anwesenheitszeit');
      console.error('Error updating attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Anwesenheitszeit bearbeiten</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Einstempeln
              </label>
              <input
                type="datetime-local"
                name="clock_in"
                value={formData.clock_in}
                onChange={(e) => setFormData({...formData, clock_in: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ausstempeln
              </label>
              <input
                type="datetime-local"
                name="clock_out"
                value={formData.clock_out}
                onChange={(e) => setFormData({...formData, clock_out: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Statistics;