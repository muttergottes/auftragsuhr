import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Settings as SettingsIcon, Tag, Briefcase } from 'lucide-react';
import { categoriesAPI, workOrderCategoriesAPI } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const [activeTab, setActiveTab] = useState(localStorage.getItem('settingsActiveTab') || 'categories');
  const [categories, setCategories] = useState([]);
  const [workOrderCategories, setWorkOrderCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCreateWorkOrderModal, setShowCreateWorkOrderModal] = useState(false);
  const [editingWorkOrderCategory, setEditingWorkOrderCategory] = useState(null);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('settingsActiveTab', tab);
  };

  useEffect(() => {
    loadCategories();
    loadWorkOrderCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoriesAPI.getAll();
      setCategories(response.data?.data || response.data || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Kategorien');
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrderCategories = async () => {
    try {
      console.log('Loading work order categories...');
      const response = await workOrderCategoriesAPI.getAll();
      console.log('Work order categories response:', response);
      console.log('Work order categories data:', response.data);
      
      // Handle both array and single object responses
      let categories = response.data?.data || response.data || [];
      if (!Array.isArray(categories)) {
        categories = [categories]; // Convert single object to array
      }
      console.log('Final categories array:', categories);
      setWorkOrderCategories(categories);
    } catch (error) {
      toast.error('Fehler beim Laden der Auftragskategorien');
      console.error('Error loading work order categories:', error);
      setWorkOrderCategories([]);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Sind Sie sicher, dass Sie diese Kategorie löschen möchten?')) {
      return;
    }

    try {
      await categoriesAPI.delete(id);
      toast.success('Kategorie gelöscht');
      loadCategories();
    } catch (error) {
      toast.error('Fehler beim Löschen der Kategorie');
    }
  };

  const handleDeleteWorkOrderCategory = async (id) => {
    if (!window.confirm('Sind Sie sicher, dass Sie diese Auftragskategorie löschen möchten?')) {
      return;
    }

    try {
      await workOrderCategoriesAPI.delete(id);
      toast.success('Auftragskategorie gelöscht');
      loadWorkOrderCategories();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Fehler beim Löschen der Auftragskategorie');
    }
  };

  const getCategoryTypeLabel = (type) => {
    switch (type) {
      case 'work': return 'Arbeit';
      case 'break': return 'Pause';
      default: return type;
    }
  };

  const getCategoryTypeColor = (type) => {
    switch (type) {
      case 'work': return 'bg-blue-100 text-blue-800';
      case 'break': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3 text-primary-600" />
          Einstellungen
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => handleTabChange('categories')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'categories'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="w-4 h-4 inline mr-2" />
              Aktivitäts-Kategorien
            </button>
            <button
              onClick={() => handleTabChange('workOrderCategories')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'workOrderCategories'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Briefcase className="w-4 h-4 inline mr-2" />
              Auftragskategorien
            </button>
            <button
              onClick={() => handleTabChange('system')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'system'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SettingsIcon className="w-4 h-4 inline mr-2" />
              System
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Categories Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Aktivitäts-Kategorien verwalten</h2>
                  <p className="text-gray-600 mt-1">
                    Kategorien für Arbeiten, Pausen und andere Aktivitäten im Kiosk-Modus
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Kategorie
                </button>
              </div>

              {/* Categories List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Lade Kategorien...</p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Typ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Farbe
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Max. Dauer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(categories) && categories.map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {category.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryTypeColor(category.type)}`}>
                              {getCategoryTypeLabel(category.type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded mr-2"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <span className="text-sm text-gray-600">{category.color}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              category.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {category.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {category.max_duration_minutes ? `${category.max_duration_minutes} min` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => setEditingCategory(category)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workOrderCategories' && (
            <div className="space-y-6">
              {/* Work Order Categories Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Auftragskategorien verwalten</h2>
                  <p className="text-gray-600 mt-1">
                    Kategorien zur Klassifizierung von Aufträgen (Wartung, Reparatur, etc.)
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateWorkOrderModal(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Kategorie
                </button>
              </div>

              {/* Work Order Categories List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Lade Auftragskategorien...</p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Beschreibung
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Farbe
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(workOrderCategories) && workOrderCategories.map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {category.name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {category.description || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded mr-2"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <span className="text-sm text-gray-600">{category.color}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              category.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {category.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => setEditingWorkOrderCategory(category)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWorkOrderCategory(category.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Systemeinstellungen</h2>
              <p className="text-gray-600">Systemeinstellungen werden in einer späteren Version implementiert.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Category Modal */}
      {(showCreateModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
            loadCategories();
          }}
        />
      )}

      {/* Create/Edit Work Order Category Modal */}
      {(showCreateWorkOrderModal || editingWorkOrderCategory) && (
        <WorkOrderCategoryModal
          category={editingWorkOrderCategory}
          onClose={() => {
            setShowCreateWorkOrderModal(false);
            setEditingWorkOrderCategory(null);
          }}
          onSuccess={() => {
            setShowCreateWorkOrderModal(false);
            setEditingWorkOrderCategory(null);
            loadWorkOrderCategories();
          }}
        />
      )}
    </div>
  );
};

// CategoryModal Component
const CategoryModal = ({ category, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'work',
    color: category?.color || '#007bff',
    is_active: category?.is_active !== undefined ? Boolean(category.is_active) : true,
    is_billable: category?.is_billable !== undefined ? Boolean(category.is_billable) : true,
    auto_break: category?.auto_break !== undefined ? Boolean(category.auto_break) : false,
    max_duration_minutes: category?.max_duration_minutes || ''
  });
  const [loading, setLoading] = useState(false);

  // Update formData when category changes (for edit mode)
  React.useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        type: category.type || 'work',
        color: category.color || '#007bff',
        is_active: Boolean(category.is_active),
        is_billable: Boolean(category.is_billable),
        auto_break: Boolean(category.auto_break),
        max_duration_minutes: category.max_duration_minutes || ''
      });
    }
  }, [category]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const categoryData = {
        ...formData,
        is_active: formData.is_active ? 1 : 0,
        is_productive: formData.type === 'break' ? 0 : 1,
        auto_break: formData.auto_break ? 1 : 0,
        max_duration_minutes: formData.max_duration_minutes ? parseInt(formData.max_duration_minutes) : null
      };

      if (category) {
        await categoriesAPI.update(category.id, categoryData);
        toast.success('Kategorie aktualisiert!');
      } else {
        await categoriesAPI.create(categoryData);
        toast.success('Kategorie erstellt!');
      }
      
      onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Speichern der Kategorie';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {category ? 'Kategorie bearbeiten' : 'Neue Kategorie erstellen'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="z.B. Werkstattpflege"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Typ *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="form-select"
                required
              >
                <option value="work">Arbeit</option>
                <option value="break">Pause</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Farbe
              </label>
              <input
                type="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                className="form-input h-10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximale Dauer (Minuten)
              </label>
              <input
                type="number"
                name="max_duration_minutes"
                value={formData.max_duration_minutes}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Optional"
                min="1"
              />
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Aktiv</span>
              </label>

              {formData.type !== 'break' && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_billable"
                    checked={formData.is_billable}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Abrechenbar</span>
                </label>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Speichere...' : (category ? 'Aktualisieren' : 'Erstellen')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// WorkOrderCategoryModal Component
const WorkOrderCategoryModal = ({ category, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || '#007bff',
    is_active: category?.is_active !== undefined ? Boolean(category.is_active) : true
  });
  const [loading, setLoading] = useState(false);

  // Update formData when category changes (for edit mode)
  React.useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#007bff',
        is_active: Boolean(category.is_active)
      });
    }
  }, [category]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const categoryData = {
        ...formData,
        is_active: formData.is_active ? 1 : 0
      };

      if (category) {
        await workOrderCategoriesAPI.update(category.id, categoryData);
        toast.success('Auftragskategorie aktualisiert!');
      } else {
        await workOrderCategoriesAPI.create(categoryData);
        toast.success('Auftragskategorie erstellt!');
      }
      
      onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Fehler beim Speichern der Auftragskategorie';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {category ? 'Auftragskategorie bearbeiten' : 'Neue Auftragskategorie erstellen'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="z.B. Wartung"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-input"
                rows={3}
                placeholder="Optionale Beschreibung der Kategorie..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Farbe
              </label>
              <input
                type="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                className="form-input h-10"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Aktiv</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Speichere...' : (category ? 'Aktualisieren' : 'Erstellen')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;