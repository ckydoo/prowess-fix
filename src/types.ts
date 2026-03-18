import { Timestamp } from 'firebase/firestore';

export type JobType = 'repair' | 'installation';
export type JobStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type UserRole = 'admin' | 'manager' | 'technician';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Timestamp;
}

export interface JobHistoryItem {
  timestamp: Timestamp;
  type: 'status_change' | 'technician_assignment' | 'creation' | 'update';
  from?: string;
  to: string;
  updatedBy: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  customerId: string;
  technicianId?: string;
  description: string;
  cost: number;
  scheduledDate: Timestamp;
  createdAt: Timestamp;
  history?: JobHistoryItem[];
  address?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  specialty: string;
  status: 'active' | 'inactive';
}

export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  settings?: {
    darkMode?: boolean;
    emailNotifications?: boolean;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'job_assigned' | 'job_updated' | 'system';
  read: boolean;
  createdAt: Timestamp;
  link?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  updatedAt: Timestamp;
}
