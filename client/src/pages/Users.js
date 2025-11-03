import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import UserForm from '../components/UserForm';
import toast from 'react-hot-toast';

const Users = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  // Fetch users
  const { data: users, isLoading, error } = useQuery(
    ['users', { includeArchived, role: roleFilter }],
    () => usersAPI.getAll({ includeArchived, role: roleFilter }),
    {
      select: (response) => response.data,
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Fehler beim Laden der Benutzer');
      }
    }
  );

  // Delete/Archive user mutation
  const archiveMutation = useMutation(
    (userId) => usersAPI.archive(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['users']);
        toast.success('Benutzer archiviert');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Fehler beim Archivieren');
      }
    }
  );

  // Restore user mutation
  const restoreMutation = useMutation(
    (userId) => usersAPI.restore(userId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['users']);
        toast.success('Benutzer wiederhergestellt');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Fehler beim Wiederherstellen');
      }
    }
  );

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDelete = (user) => {
    if (window.confirm(`Benutzer "${user.first_name} ${user.last_name}" wirklich archivieren?`)) {
      archiveMutation.mutate(user.id);
    }
  };

  const handleRestore = (user) => {
    if (window.confirm(`Benutzer "${user.first_name} ${user.last_name}" wiederherstellen?`)) {
      restoreMutation.mutate(user.id);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'dispatcher': return 'bg-blue-100 text-blue-800';
      case 'employee': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'dispatcher': return 'Disponent';
      case 'employee': return 'Monteur';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Benutzer</h1>
        <div className="card">
          <div className="card-body">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Benutzer</h1>
        <div className="card">
          <div className="card-body">
            <p className="text-red-600">Fehler beim Laden der Benutzer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Benutzer</h1>
        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <span className="mr-2">+</span>
            Neuer Benutzer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="form-label">Rolle filtern</label>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-input"
              >
                <option value="">Alle Rollen</option>
                <option value="admin">Admin</option>
                <option value="dispatcher">Disponent</option>
                <option value="employee">Monteur</option>
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="mr-2"
                />
                Archivierte anzeigen
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="card-body">
          {users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mitarbeiter
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Personal-Nr.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-Mail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rolle
                    </th>
                    {currentUser.role === 'admin' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stundensatz
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className={user.archived_at ? 'bg-gray-50 opacity-75' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          {user.pin && (
                            <div className="text-sm text-gray-500">PIN: ****</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.employee_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      {currentUser.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.hourly_rate ? `${user.hourly_rate}€/h` : '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.archived_at 
                            ? 'bg-red-100 text-red-800' 
                            : user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.archived_at ? 'Archiviert' : user.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {currentUser.role === 'admin' && (
                            <>
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Bearbeiten
                              </button>
                              {user.archived_at ? (
                                <button
                                  onClick={() => handleRestore(user)}
                                  className="text-green-600 hover:text-green-900"
                                  disabled={restoreMutation.isLoading}
                                >
                                  Wiederherstellen
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDelete(user)}
                                  className="text-red-600 hover:text-red-900"
                                  disabled={archiveMutation.isLoading}
                                >
                                  Archivieren
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Keine Benutzer gefunden</p>
            </div>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <UserForm 
          user={editingUser} 
          onClose={closeForm}
          onSuccess={() => {
            queryClient.invalidateQueries(['users']);
            closeForm();
          }}
        />
      )}
    </div>
  );
};


export default Users;