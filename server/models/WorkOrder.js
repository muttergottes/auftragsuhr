const db = require('../config/database');
const logger = require('../config/logger');

class WorkOrder {
  constructor(orderData) {
    Object.assign(this, orderData);
  }

  static async findAll(options = {}) {
    const { 
      status = null,
      assignedTo = null,
      priority = null,
      limit = 100,
      offset = 0 
    } = options;
    
    // Simplified query to avoid JOIN errors - we'll expand this once basic functionality works
    let query = `
      SELECT * FROM work_orders wo
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }
    
    if (assignedTo) {
      query += ' AND wo.assigned_to = ?';
      params.push(assignedTo);
    }
    
    if (priority) {
      query += ' AND wo.priority = ?';
      params.push(priority);
    }
    
    query += ' ORDER BY wo.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const records = await db.query(query, params);
    return records.map(record => new WorkOrder(record));
  }

  static async findById(id) {
    const query = `
      SELECT wo.*, 
             c.company_name, c.first_name as customer_first_name, c.last_name as customer_last_name,
             v.make, v.model, v.year, v.license_plate,
             u.first_name as assigned_first_name, u.last_name as assigned_last_name,
             woc.name as category_name, woc.color as category_color
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
      WHERE wo.id = ?
    `;
    
    const [record] = await db.query(query, [id]);
    return record ? new WorkOrder(record) : null;
  }

  static async findByOrderNumber(orderNumber) {
    const query = `
      SELECT wo.*, 
             c.company_name, c.first_name as customer_first_name, c.last_name as customer_last_name,
             v.make, v.model, v.year, v.license_plate,
             u.first_name as assigned_first_name, u.last_name as assigned_last_name,
             woc.name as category_name, woc.color as category_color
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
      WHERE wo.order_number = ?
    `;
    
    const [record] = await db.query(query, [orderNumber]);
    return record ? new WorkOrder(record) : null;
  }

  static async getActiveOrders() {
    const query = `
      SELECT wo.*, 
             c.company_name, c.first_name as customer_first_name, c.last_name as customer_last_name,
             v.make, v.model, v.year, v.license_plate,
             u.first_name as assigned_first_name, u.last_name as assigned_last_name,
             woc.name as category_name, woc.color as category_color
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
      WHERE wo.status IN ('created', 'in_progress')
      ORDER BY wo.priority DESC, wo.created_at ASC
    `;
    
    const records = await db.query(query);
    return records.map(record => new WorkOrder(record));
  }

  static async create(orderData) {
    const { 
      order_number,
      category_id = null,
      customer_id = null,
      vehicle_id = null,
      description = null,
      mileage = null,
      priority = 'normal',
      estimated_hours = null,
      estimated_completion = null,
      estimated_cost = null,
      created_by,
      assigned_to = null
    } = orderData;

    const query = `
      INSERT INTO work_orders 
      (order_number, category_id, customer_id, vehicle_id, description, mileage, priority, 
       estimated_hours, estimated_completion, estimated_cost, created_by, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
    `;

    const result = await db.query(query, [
      order_number, category_id, customer_id, vehicle_id, description, mileage, priority,
      estimated_hours, estimated_completion, estimated_cost, created_by, assigned_to
    ]);

    logger.info('Work order created:', { 
      orderId: result.insertId,
      orderNumber: order_number,
      createdBy: created_by 
    });

    return this.findById(result.insertId);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'category_id', 'customer_id', 'vehicle_id', 'description', 'mileage', 'priority',
      'status', 'estimated_hours', 'estimated_completion', 'estimated_cost',
      'actual_cost', 'assigned_to'
    ];

    const updates = {};
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates[key] = updateData[key];
        params.push(updateData[key]);
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Set completed_at if status is completed
    let setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    if (updateData.status === 'completed') {
      setClause += ', completed_at = NOW()';
    }

    const query = `UPDATE work_orders SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    params.push(id);
    await db.query(query, params);
    
    logger.info('Work order updated:', { id, changes: Object.keys(updates) });
    
    return this.findById(id);
  }

  static async delete(id) {
    const query = 'DELETE FROM work_orders WHERE id = ?';
    await db.query(query, [id]);
    
    logger.info('Work order deleted:', { id });
    return true;
  }

  // Get summary statistics
  static async getSummary(options = {}) {
    const { startDate = null, endDate = null } = options;
    
    let query = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(estimated_hours) as avg_estimated_hours,
        SUM(estimated_cost) as total_estimated_cost,
        SUM(actual_cost) as total_actual_cost
      FROM work_orders 
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY status';
    
    const summary = await db.query(query, params);
    return summary;
  }

  toJSON() {
    // Simplified toJSON for basic functionality
    return {
      id: this.id,
      order_number: this.order_number,
      category_id: this.category_id,
      customer_id: this.customer_id,
      vehicle_id: this.vehicle_id,
      description: this.description,
      mileage: this.mileage,
      priority: this.priority,
      status: this.status,
      estimated_hours: this.estimated_hours,
      estimated_completion: this.estimated_completion,
      estimated_cost: this.estimated_cost,
      actual_cost: this.actual_cost,
      created_by: this.created_by,
      assigned_to: this.assigned_to,
      created_at: this.created_at,
      updated_at: this.updated_at,
      completed_at: this.completed_at
    };
  }
}

module.exports = WorkOrder;