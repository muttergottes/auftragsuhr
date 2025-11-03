import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Clock, Users, FileText, Activity } from 'lucide-react';
import { attendanceAPI, workOrdersAPI, workSessionsAPI } from '../services/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState({
    presentEmployees: 0,
    activeOrders: 0,
    todayOrders: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Fetch active attendances
        const attendanceResponse = await attendanceAPI.getActiveAttendances();
        const presentEmployees = attendanceResponse.data?.length || 0;
        
        // Fetch active work sessions
        const sessionsResponse = await workSessionsAPI.getActive();
        const activeOrders = sessionsResponse.data?.length || 0;
        
        // Fetch work orders
        const ordersResponse = await workOrdersAPI.getAll();
        const orders = ordersResponse.data?.data || ordersResponse.data || [];
        const todayOrders = orders.length;
        
        // Get recent orders (first 5)
        setRecentOrders(orders.slice(0, 5));
        
        setStats({
          presentEmployees,
          activeOrders,
          todayOrders
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        toast.error('Live-Daten abrufen fehlgeschlagen');
        setRecentOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Lade Live-Daten...</p>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="card">
                <div className="card-body">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Willkommen bei Auftragsuhr</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Anwesende</h3>
                <p className="text-3xl font-bold text-primary-600">{stats.presentEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Aktive Sessions</h3>
                <p className="text-3xl font-bold text-green-600">{stats.activeOrders}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Gesamt Aufträge</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.todayOrders}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Aktuelle Aufträge
              </h3>
              <Link
                to="/work-orders"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Alle anzeigen →
              </Link>
            </div>
          </div>
          <div className="card-body">
            {recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Keine Aufträge vorhanden</p>
                <Link
                  to="/work-orders"
                  className="btn btn-primary mt-4 inline-flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ersten Auftrag erstellen
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {order.order_number}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {order.description || 'Keine Beschreibung'}
                      </p>
                      {order.estimated_hours && (
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {order.estimated_hours}h geplant
                        </div>
                      )}
                    </div>
                    <Link
                      to="/work-orders"
                      className="ml-4 text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Schnellaktionen</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/work-orders"
                className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-6 w-6 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-900">Neuer Auftrag</span>
              </Link>
              
              <Link
                to="/live-board"
                className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Activity className="h-6 w-6 text-green-600 mb-2" />
                <span className="text-sm font-medium text-gray-900">Live-Board</span>
              </Link>
              
              
              <Link
                to="/settings"
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Users className="h-6 w-6 text-gray-600 mb-2" />
                <span className="text-sm font-medium text-gray-900">Kategorien</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'created': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'on_hold': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'created': return 'Neu';
    case 'in_progress': return 'In Arbeit';
    case 'completed': return 'Fertig';
    case 'cancelled': return 'Storniert';
    case 'on_hold': return 'Wartend';
    default: return status;
  }
};

export default Dashboard;