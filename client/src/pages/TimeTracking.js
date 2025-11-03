import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, breaksAPI, categoriesAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Clock, LogIn, LogOut, MapPin, StickyNote, Coffee, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TimeTracking = () => {
  const { user } = useAuth();
  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [currentBreak, setCurrentBreak] = useState(null);
  const [breakCategories, setBreakCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [showLocationNote, setShowLocationNote] = useState(false);
  const [showBreakOptions, setShowBreakOptions] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load current attendance status and break categories
  useEffect(() => {
    loadCurrentData();
  }, []);

  const loadCurrentData = async () => {
    try {
      setLoading(true);
      const [attendanceRes, breakRes, categoriesRes] = await Promise.all([
        attendanceAPI.getCurrentAttendance(),
        breaksAPI.getCurrent(),
        categoriesAPI.getAll({ type: 'break', active: true })
      ]);
      
      setCurrentAttendance(attendanceRes.data);
      setCurrentBreak(breakRes.data);
      setBreakCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const data = {};
      if (location.trim()) data.location = location.trim();
      if (note.trim()) data.note = note.trim();

      const response = await attendanceAPI.clockIn(data);
      setCurrentAttendance(response.data);
      setLocation('');
      setNote('');
      setShowLocationNote(false);
      setShowBreakOptions(false);
      toast.success(`Willkommen, ${user.first_name}! Erfolgreich eingestempelt.`);
    } catch (error) {
      console.error('Clock in error:', error);
      if (error.response?.status === 409) {
        toast.error(error.response.data.error || 'Bereits eingestempelt');
      } else {
        toast.error('Fehler beim Einstempeln');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      const data = {};
      if (location.trim()) data.location = location.trim();
      if (note.trim()) data.note = note.trim();

      const response = await attendanceAPI.clockOut(data);
      setCurrentAttendance(null);
      setCurrentBreak(null); // End any active break when clocking out
      setLocation('');
      setNote('');
      setShowLocationNote(false);
      setShowBreakOptions(false);
      
      const duration = Math.round(response.data.total_hours * 60);
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      toast.success(`Auf Wiedersehen, ${user.first_name}! Arbeitszeit: ${hours}h ${minutes}min`);
    } catch (error) {
      console.error('Clock out error:', error);
      if (error.response?.status === 409) {
        toast.error(error.response.data.error || 'Nicht eingestempelt');
      } else {
        toast.error('Fehler beim Ausstempeln');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async (categoryId) => {
    try {
      setActionLoading(true);
      const data = { categoryId };
      if (currentAttendance?.id) {
        data.attendanceRecordId = currentAttendance.id;
      }
      if (note.trim()) data.note = note.trim();

      const response = await breaksAPI.start(data);
      setCurrentBreak(response.data);
      setNote('');
      setShowBreakOptions(false);
      
      const category = breakCategories.find(c => c.id === categoryId);
      toast.success(`Pause gestartet: ${category?.name || 'Unbekannt'}`);
    } catch (error) {
      console.error('Start break error:', error);
      if (error.response?.status === 409) {
        toast.error(error.response.data.error || 'Bereits eine aktive Pause');
      } else {
        toast.error('Fehler beim Starten der Pause');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopBreak = async () => {
    try {
      setActionLoading(true);
      const data = {};
      if (note.trim()) data.note = note.trim();

      const response = await breaksAPI.stop(data);
      setCurrentBreak(null);
      setNote('');
      setShowBreakOptions(false);
      
      const duration = response.data.duration_minutes;
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      toast.success(`Pause beendet: ${response.data.category_name} (${hours}h ${minutes}min)`);
    } catch (error) {
      console.error('Stop break error:', error);
      if (error.response?.status === 409) {
        toast.error(error.response.data.error || 'Keine aktive Pause');
      } else {
        toast.error('Fehler beim Beenden der Pause');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getCurrentDuration = () => {
    if (!currentAttendance?.clock_in) return 0;
    const startTime = new Date(currentAttendance.clock_in);
    const diffMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
    return Math.max(0, diffMinutes);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Zeiterfassung</h1>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Lade Anwesenheitsstatus...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isActive = currentAttendance && !currentAttendance.clock_out;
  const currentDuration = getCurrentDuration();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Zeiterfassung</h1>
      
      {/* Current Time */}
      <div className="card mb-6">
        <div className="card-body text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-6 h-6 text-blue-600 mr-2" />
            <span className="text-lg font-semibold text-gray-700">Aktuelle Zeit</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {format(currentTime, 'HH:mm:ss', { locale: de })}
          </div>
          <div className="text-sm text-gray-500">
            {format(currentTime, 'EEEE, dd. MMMM yyyy', { locale: de })}
          </div>
        </div>
      </div>

      {/* Attendance Status */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Anwesenheitsstatus</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive 
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isActive ? 'Anwesend' : 'Nicht anwesend'}
            </div>
          </div>

          {isActive ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-700 font-medium">Eingestempelt seit:</span>
                  <span className="text-green-900 font-semibold">
                    {format(new Date(currentAttendance.clock_in), 'HH:mm', { locale: de })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-700 font-medium">Aktuelle Arbeitszeit:</span>
                  <span className="text-green-900 font-bold text-lg">
                    {formatDuration(currentDuration)}
                  </span>
                </div>
                {currentAttendance.clock_in_location && (
                  <div className="flex items-center mt-2 text-sm text-green-600">
                    <MapPin className="w-4 h-4 mr-1" />
                    {currentAttendance.clock_in_location}
                  </div>
                )}
                {currentAttendance.clock_in_note && (
                  <div className="flex items-center mt-2 text-sm text-green-600">
                    <StickyNote className="w-4 h-4 mr-1" />
                    {currentAttendance.clock_in_note}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-center">
                Sie sind derzeit nicht eingestempelt.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Break Status */}
      {isActive && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Pausenstatus</h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentBreak 
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {currentBreak ? 'In Pause' : 'Aktiv'}
              </div>
            </div>

            {currentBreak ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-700 font-medium">Pausentyp:</span>
                    <span className="text-yellow-900 font-semibold">
                      {currentBreak.category_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-700 font-medium">Gestartet:</span>
                    <span className="text-yellow-900 font-semibold">
                      {format(new Date(currentBreak.start_time), 'HH:mm', { locale: de })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-700 font-medium">Pausendauer:</span>
                    <span className="text-yellow-900 font-bold text-lg">
                      {formatDuration(currentBreak.status?.duration || 0)}
                    </span>
                  </div>
                  {currentBreak.notes && (
                    <div className="flex items-center mt-2 text-sm text-yellow-600">
                      <StickyNote className="w-4 h-4 mr-1" />
                      {currentBreak.notes}
                    </div>
                  )}
                </div>
                
                {/* Stop Break Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleStopBreak}
                    disabled={actionLoading}
                    className="btn btn-warning btn-lg flex items-center justify-center min-w-[200px]"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Pause beenden
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-700 text-center mb-4">
                    Sie befinden sich derzeit nicht in einer Pause.
                  </p>
                  
                  {/* Break Options Toggle */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowBreakOptions(!showBreakOptions)}
                      className="btn btn-secondary flex items-center"
                    >
                      <Coffee className="w-5 h-5 mr-2" />
                      Pause starten
                    </button>
                  </div>
                </div>

                {/* Break Category Selection */}
                {showBreakOptions && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Pausentyp auswählen:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {breakCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleStartBreak(category.id)}
                          disabled={actionLoading}
                          className="btn btn-secondary text-left p-3 h-auto"
                        >
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-3" 
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <div>
                              <div className="font-medium">{category.name}</div>
                              {category.max_duration_minutes && (
                                <div className="text-xs text-gray-500">
                                  Max. {Math.floor(category.max_duration_minutes / 60)}h {category.max_duration_minutes % 60}min
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Optional note for break */}
                    <div className="mt-4">
                      <label htmlFor="breakNote" className="block text-sm font-medium text-gray-700 mb-1">
                        Notiz (optional)
                      </label>
                      <input
                        type="text"
                        id="breakNote"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="z.B. Arzttermin, Sonderfall"
                        className="input"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="card">
        <div className="card-body">
          <div className="space-y-4">
            {/* Location/Note Toggle */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {isActive ? 'Ausstempeln' : 'Einstempeln'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLocationNote(!showLocationNote)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showLocationNote ? 'Weniger' : 'Ort/Notiz hinzufügen'}
              </button>
            </div>

            {/* Location and Note Fields */}
            {showLocationNote && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Ort (optional)
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="z.B. Werkstatt, Büro, Außentermin"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                    Notiz (optional)
                  </label>
                  <input
                    type="text"
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="z.B. Überstunden, Sondertermin"
                    className="input"
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="flex justify-center">
              {isActive ? (
                <button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="btn btn-danger btn-lg flex items-center justify-center min-w-[200px]"
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
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={actionLoading}
                  className="btn btn-primary btn-lg flex items-center justify-center min-w-[200px]"
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeTracking;