import axios, { AxiosInstance } from 'axios';

export class BackendClient {
  private gatewayApi: AxiosInstance;

  constructor() {
    this.gatewayApi = axios.create({
      baseURL: process.env.GATEWAY_URL || 'http://localhost:3000/api',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async searchEquipment(query: string) {
    try {
      const response = await this.gatewayApi.get(`/equipments/search?q=${encodeURIComponent(query)}`);
      
      // La respuesta viene en formato { success: true, data: [...] }
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      // Si es 404, retornar array vacío en lugar de error
      if (error.response?.status === 404) {
        return [];
      }
      console.error('Error searching equipment:', error.message);
      throw new Error(`No se pudo buscar equipos: ${error.message}`);
    }
  }

  async getEquipmentById(id: string) {
    try {
      const response = await this.gatewayApi.get(`/equipments/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      // Si es 404, retornar null en lugar de lanzar error
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error getting equipment:', error.message);
      throw new Error(`No se pudo obtener el equipo: ${error.message}`);
    }
  }

  async updateEquipmentStatus(id: string, status: string) {
    try {
      const response = await this.gatewayApi.patch(`/equipments/${id}/status`, {
        status,
      });
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Error updating equipment status:', error.message);
      throw new Error(`No se pudo actualizar el estado: ${error.message}`);
    }
  }

  async createRepairOrder(data: {
    equipmentId: string;
    technicianId: string;
    problemDescription: string;
  }) {
    try {
      const response = await this.gatewayApi.post('/repair-orders', {
        equipmentId: data.equipmentId,
        problemDescription: data.problemDescription,
        technicianId: data.technicianId,
      });
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Error creating repair order:', error.message);
      throw new Error(`No se pudo crear la orden: ${error.message}`);
    }
  }

  async getAllRepairOrders() {
    try {
      const response = await this.gatewayApi.get('/repair-orders');
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Error getting all repair orders:', error.message);
      return [];
    }
  }

  async getRepairOrdersByEquipment(equipmentId: string) {
    try {
      const orders = await this.getAllRepairOrders();
      return orders.filter((order: any) => order.equipmentId === equipmentId);
    } catch (error: any) {
      console.error('Error getting repair orders:', error.message);
      return [];
    }
  }
}