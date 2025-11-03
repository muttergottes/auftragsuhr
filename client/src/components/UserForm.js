import React, { useState, useEffect } from 'react';
import { useMutation } from 'react-query';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const UserForm = ({ user, onClose, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    employee_number: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    pin: '',
    rfid_tag: '',
    qr_code: '',
    hourly_rate: '',
    is_active: true,
    work_time_model: {
      weekly_hours: 40,
      daily_hours: 8,
      flexible_hours: false,
      break_duration: 30
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fill form data when editing
  useEffect(() => {
    if (user) {
      setFormData({
        employee_number: user.employee_number || '',
        email: user.email || '',
        password: '',
        confirmPassword: '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role || 'employee',
        pin: user.pin || '',
        rfid_tag: user.rfid_tag || '',
        qr_code: user.qr_code || '',
        hourly_rate: user.hourly_rate || '',
        is_active: user.is_active !== undefined ? user.is_active : true,
        work_time_model: user.work_time_model || {
          weekly_hours: 40,
          daily_hours: 8,
          flexible_hours: false,
          break_duration: 30
        }
      });
    }
  }, [user]);

  // Create mutation
  const createMutation = useMutation(
    (userData) => usersAPI.create(userData),
    {
      onSuccess: () => {
        toast.success('Benutzer erfolgreich erstellt');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Fehler beim Erstellen des Benutzers');
      }
    }
  );

  // Update mutation
  const updateMutation = useMutation(
    ({ id, data }) => usersAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Benutzer erfolgreich aktualisiert');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Fehler beim Aktualisieren des Benutzers');
      }
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('work_time_model.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        work_time_model: {
          ...prev.work_time_model,
          [field]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.employee_number.trim()) {
      errors.push('Personalnummer ist erforderlich');
    }
    if (!formData.email.trim()) {
      errors.push('E-Mail ist erforderlich');
    }
    if (!formData.first_name.trim()) {
      errors.push('Vorname ist erforderlich');
    }
    if (!formData.last_name.trim()) {
      errors.push('Nachname ist erforderlich');
    }

    // Password validation for new users
    if (!user) {
      if (!formData.password) {
        errors.push('Passwort ist erforderlich');
      } else if (formData.password.length < 6) {
        errors.push('Passwort muss mindestens 6 Zeichen lang sein');
      }
      if (formData.password !== formData.confirmPassword) {
        errors.push('Passwörter stimmen nicht überein');
      }
    }

    // Password validation for existing users (only if password is being changed)
    if (user && formData.password) {
      if (formData.password.length < 6) {
        errors.push('Passwort muss mindestens 6 Zeichen lang sein');
      }
      if (formData.password !== formData.confirmPassword) {
        errors.push('Passwörter stimmen nicht überein');
      }
    }

    if (formData.hourly_rate && isNaN(parseFloat(formData.hourly_rate))) {
      errors.push('Stundensatz muss eine gültige Zahl sein');
    }

    if (formData.pin && (formData.pin.length < 4 || formData.pin.length > 6)) {
      errors.push('PIN muss 4-6 Zeichen lang sein');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      setIsLoading(false);
      return;
    }

    try {
      const submitData = { ...formData };
      
      // Convert hourly_rate to number
      if (submitData.hourly_rate) {
        submitData.hourly_rate = parseFloat(submitData.hourly_rate);
      } else {
        delete submitData.hourly_rate;
      }

      // Remove confirm password from submission
      delete submitData.confirmPassword;

      // Remove password if it's empty (for updates)
      if (user && !submitData.password) {
        delete submitData.password;
      }

      // Remove empty optional fields
      if (!submitData.pin) delete submitData.pin;
      if (!submitData.rfid_tag) delete submitData.rfid_tag;
      if (!submitData.qr_code) delete submitData.qr_code;

      if (user) {
        await updateMutation.mutateAsync({ id: user.id, data: submitData });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch (error) {
      // Error handling is done in the mutations
    }
    
    setIsLoading(false);
  };

  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, pin }));
  };

  const generateQRCode = () => {
    const qr = 'QR' + Date.now().toString().slice(-8);
    setFormData(prev => ({ ...prev, qr_code: qr }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {user ? `Benutzer bearbeiten: ${user.first_name} ${user.last_name}` : 'Neuer Benutzer'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Personalnummer *
              </label>
              <input
                type="text"
                name="employee_number"
                value={formData.employee_number}
                onChange={handleChange}
                className="form-input"
                required
                disabled={!!user} // Don't allow changing employee number
              />
            </div>

            <div>
              <label className="form-label">
                E-Mail *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">
                Vorname *
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">
                Nachname *
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">
                Rolle
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="form-input"
              >
                <option value="employee">Monteur</option>
                <option value="dispatcher">Disponent</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {currentUser.role === 'admin' && (
              <div>
                <label className="form-label">
                  Stundensatz (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="hourly_rate"
                  value={formData.hourly_rate}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="25.00"
                />
              </div>
            )}
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                {user ? 'Neues Passwort (leer lassen für keine Änderung)' : 'Passwort *'}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                required={!user}
                minLength="6"
              />
            </div>

            <div>
              <label className="form-label">
                {user ? 'Neues Passwort bestätigen' : 'Passwort bestätigen *'}
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input"
                required={!user || formData.password}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="mr-2"
              />
              Benutzer aktiv
            </label>
          </div>

          {/* Advanced Settings Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAdvanced ? '▼' : '▶'} Erweiterte Einstellungen
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              {/* Kiosk Access */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">
                    PIN (Kiosk-Anmeldung)
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      name="pin"
                      value={formData.pin}
                      onChange={handleChange}
                      className="form-input rounded-r-none"
                      placeholder="4-6 Zeichen"
                      maxLength="6"
                    />
                    <button
                      type="button"
                      onClick={generatePin}
                      className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-300"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    RFID-Tag
                  </label>
                  <input
                    type="text"
                    name="rfid_tag"
                    value={formData.rfid_tag}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="RFID-Nummer"
                  />
                </div>

                <div>
                  <label className="form-label">
                    QR-Code
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      name="qr_code"
                      value={formData.qr_code}
                      onChange={handleChange}
                      className="form-input rounded-r-none"
                      placeholder="QR-Code"
                    />
                    <button
                      type="button"
                      onClick={generateQRCode}
                      className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-300"
                    >
                      Gen
                    </button>
                  </div>
                </div>
              </div>

              {/* Work Time Model */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Arbeitszeitmodell</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">
                      Wochenstunden
                    </label>
                    <input
                      type="number"
                      name="work_time_model.weekly_hours"
                      value={formData.work_time_model.weekly_hours}
                      onChange={handleChange}
                      className="form-input"
                      min="1"
                      max="80"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      Tagesstunden
                    </label>
                    <input
                      type="number"
                      name="work_time_model.daily_hours"
                      value={formData.work_time_model.daily_hours}
                      onChange={handleChange}
                      className="form-input"
                      min="1"
                      max="16"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      Pausendauer (Min)
                    </label>
                    <input
                      type="number"
                      name="work_time_model.break_duration"
                      value={formData.work_time_model.break_duration}
                      onChange={handleChange}
                      className="form-input"
                      min="0"
                      max="120"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center h-10">
                      <input
                        type="checkbox"
                        name="work_time_model.flexible_hours"
                        checked={formData.work_time_model.flexible_hours}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      Flexible Arbeitszeit
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Speichern...' : user ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;