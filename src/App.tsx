import React, { useState, useEffect, useCallback, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  orderBy, 
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { UserProfile, Customer, Job, Technician, JobType, JobStatus, JobHistoryItem, Notification, InventoryItem } from './types';
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  Settings as SettingsIcon, 
  LogOut, 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Edit2,
  ExternalLink,
  DollarSign,
  FileText,
  ShieldAlert,
  LayoutGrid,
  Map as MapIcon,
  Bell,
  Package,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { getDocFromServer } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const MapsSplashScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-xl w-full text-center space-y-8 border border-slate-100">
      <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
        <MapPin size={40} />
      </div>
      <div className="space-y-4">
        <h2 className="text-3xl font-bold text-slate-900">Google Maps API Key Required</h2>
        <p className="text-slate-600 leading-relaxed">
          To enable location tracking and job mapping, you need to add your Google Maps Platform API key.
        </p>
      </div>
      
      <div className="bg-slate-50 p-6 rounded-2xl text-left space-y-4 border border-slate-100">
        <p className="font-bold text-slate-900 text-sm uppercase tracking-wider">Setup Instructions:</p>
        <ol className="text-sm text-slate-600 space-y-3 list-decimal pl-4">
          <li>Get an API key: <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-indigo-600 hover:underline font-medium">Google Cloud Console</a></li>
          <li>Open <strong>Settings</strong> (⚙️ gear icon, top-right corner)</li>
          <li>Select <strong>Secrets</strong></li>
          <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name</li>
          <li>Paste your API key as the value and press <strong>Enter</strong></li>
        </ol>
      </div>
      
      <p className="text-xs text-slate-400 italic">
        The app will rebuild automatically once the secret is added.
      </p>
    </div>
  </div>
);

const JobMapView = ({ jobs, customers, onJobClick }: { jobs: Job[], customers: Customer[], onJobClick: (job: Job) => void }) => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [markerPositions, setMarkerPositions] = useState<{[key: string]: google.maps.LatLngLiteral}>({});
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    // In a real app, we would geocode addresses. 
    // For this demo, we'll assign deterministic random positions around a center for jobs that don't have them.
    const center = { lat: 37.7749, lng: -122.4194 }; // SF
    const newPositions: {[key: string]: google.maps.LatLngLiteral} = {};
    
    jobs.forEach((job, index) => {
      // Deterministic "random" offset based on job ID
      const seed = job.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const latOffset = (seed % 100) / 1000 - 0.05;
      const lngOffset = (seed % 150) / 1000 - 0.075;
      newPositions[job.id] = { 
        lat: center.lat + latOffset, 
        lng: center.lng + lngOffset 
      };
    });
    setMarkerPositions(newPositions);
  }, [jobs]);

  return (
    <div className="h-[600px] rounded-3xl overflow-hidden border border-slate-100 shadow-sm relative">
      <Map
        defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
        defaultZoom={12}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        {jobs.map(job => (
          markerPositions[job.id] && (
            <AdvancedMarker
              key={job.id}
              position={markerPositions[job.id]}
              onClick={() => setSelectedJob(job)}
            >
              <Pin 
                background={job.status === 'completed' ? '#10b981' : job.status === 'pending' ? '#f59e0b' : '#6366f1'} 
                glyphColor="#fff" 
              />
            </AdvancedMarker>
          )
        ))}

        {selectedJob && markerPositions[selectedJob.id] && (
          <InfoWindow
            position={markerPositions[selectedJob.id]}
            onCloseClick={() => setSelectedJob(null)}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-bold text-slate-900">{customers.find(c => c.id === selectedJob.customerId)?.name}</h3>
              <p className="text-xs text-slate-500 mb-2">{selectedJob.description}</p>
              <div className="flex items-center justify-between gap-4">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  selectedJob.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                  selectedJob.status === 'pending' ? "bg-amber-100 text-amber-700" :
                  "bg-indigo-100 text-indigo-700"
                )}>
                  {selectedJob.status}
                </span>
                <button 
                  onClick={() => onJobClick(selectedJob)}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  View Details
                </button>
                <span className="text-[10px] font-bold text-slate-900">${selectedJob.cost}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
};

const CalendarView = ({ jobs, customers, onJobClick }: { jobs: Job[], customers: Customer[], onJobClick: (job: Job) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getJobsForDay = (day: Date) => {
    return jobs.filter(j => isSameDay(j.scheduledDate.toDate(), day));
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-slate-50 rounded-xl transition-all"
          >
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <button 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-slate-50 rounded-xl transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day, i) => {
          const dayJobs = getJobsForDay(day);
          const isCurrentMonth = format(day, 'M') === format(currentDate, 'M');
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={i} 
              className={cn(
                "min-h-[120px] p-2 border-b border-r border-slate-50 transition-colors hover:bg-slate-50/50",
                !isCurrentMonth && "bg-slate-50/30 opacity-50"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn(
                  "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                  isToday ? "bg-indigo-600 text-white" : "text-slate-600"
                )}>
                  {format(day, 'd')}
                </span>
                {dayJobs.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400">{dayJobs.length} Jobs</span>
                )}
              </div>
              <div className="space-y-1">
                {dayJobs.slice(0, 3).map(job => (
                  <div 
                    key={job.id} 
                    onClick={() => onJobClick(job)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold truncate cursor-pointer hover:opacity-80 transition-opacity",
                      job.status === 'completed' ? "bg-emerald-50 text-emerald-700" :
                      job.status === 'pending' ? "bg-amber-50 text-amber-700" :
                      "bg-indigo-50 text-indigo-700"
                    )}
                  >
                    {customers.find(c => c.id === job.customerId)?.name}
                  </div>
                ))}
                {dayJobs.length > 3 && (
                  <div className="text-[10px] text-slate-400 font-bold pl-1">
                    + {dayJobs.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CustomerDetail = ({ customer, jobs, onClose }: { customer: Customer, jobs: Job[], onClose: () => void }) => {
  const customerJobs = jobs.filter(j => j.customerId === customer.id);
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center font-bold text-2xl">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{customer.name}</h2>
            <p className="text-slate-500">Customer since {customer.createdAt.toDate().toLocaleDateString()}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Mail size={18} className="text-indigo-600" />
            Contact Info
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-slate-600">{customer.email}</p>
            <p className="text-sm text-slate-600">{customer.phone}</p>
          </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <MapPin size={18} className="text-indigo-600" />
            Service Address
          </h3>
          <p className="text-sm text-slate-600">{customer.address}</p>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <DollarSign size={18} className="text-indigo-600" />
            Total Revenue
          </h3>
          <p className="text-2xl font-bold text-slate-900">
            ${customerJobs.reduce((acc, j) => acc + j.cost, 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Service History</h3>
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerJobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{job.scheduledDate.toDate().toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-900 capitalize">{job.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      job.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                      job.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      "bg-indigo-100 text-indigo-700"
                    )}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">${job.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-4">
        <button 
          onClick={() => window.location.href = `mailto:${customer.email}`}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <Mail size={20} />
          Send Email
        </button>
        <button 
          onClick={onClose}
          className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};
const TechnicianDetail = ({ technician, jobs, onClose }: { technician: Technician, jobs: Job[], onClose: () => void }) => {
  const techJobs = jobs.filter(j => j.technicianId === technician.id);
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-3xl flex items-center justify-center font-bold text-2xl">
            {technician.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{technician.name}</h2>
            <p className="text-indigo-600 font-medium">{technician.specialty}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Mail size={18} className="text-indigo-600" />
            Contact Info
          </h3>
          <p className="text-sm text-slate-600">{technician.email}</p>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-indigo-600" />
            Jobs Completed
          </h3>
          <p className="text-2xl font-bold text-slate-900">
            {techJobs.filter(j => j.status === 'completed').length}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" />
            Active Jobs
          </h3>
          <p className="text-2xl font-bold text-slate-900">
            {techJobs.filter(j => j.status === 'in-progress').length}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Current Schedule</h3>
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Job Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {techJobs.sort((a, b) => b.scheduledDate.toMillis() - a.scheduledDate.toMillis()).map(job => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{job.scheduledDate.toDate().toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{job.type.toUpperCase()}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{job.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      job.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                      job.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      "bg-indigo-100 text-indigo-700"
                    )}>
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-4">
        <button 
          onClick={() => window.location.href = `mailto:${technician.email}`}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <Mail size={20} />
          Send Email
        </button>
        <button 
          onClick={onClose}
          className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const Notifications = ({ notifications, onMarkAsRead }: { notifications: Notification[], onMarkAsRead: (id: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all relative shadow-sm"
      >
        <AlertCircle size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Notifications</h3>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{unreadCount} New</span>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <CheckCircle2 size={32} className="text-slate-200 mx-auto" />
                    <p className="text-sm text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 transition-colors hover:bg-slate-50 cursor-pointer",
                        !n.read && "bg-indigo-50/30"
                      )}
                      onClick={() => { onMarkAsRead(n.id); setIsOpen(false); }}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          n.type === 'job_assigned' ? "bg-indigo-500" :
                          n.type === 'job_updated' ? "bg-amber-500" :
                          "bg-slate-500"
                        )} />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900 leading-tight">{n.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {format(n.createdAt.toDate(), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-2">
    <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>
    <input
      {...props}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
    />
  </div>
);

const Select = ({ label, options, ...props }: { label: string, options: { value: string, label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-2">
    <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>
    <select
      {...props}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const TextArea = ({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <div className="space-y-2">
    <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>
    <textarea
      {...props}
      rows={3}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
    />
  </div>
);

const LoadingScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 z-50">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
    />
    <p className="text-slate-600 font-medium animate-pulse">Initializing Prowess System...</p>
  </div>
);

const Login = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-xl p-12 rounded-3xl border border-white/20 shadow-2xl w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/50">
            <Wrench className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">PROWESS</h1>
          <p className="text-indigo-200 font-medium">Technologies Management System</p>
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full bg-white text-slate-900 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
        
        <p className="mt-8 text-center text-slate-400 text-sm">
          Authorized personnel only. Access is monitored.
        </p>
      </motion.div>
    </div>
  );
};

const NotRegistered = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-12 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6"
    >
      <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600">
        <ShieldAlert size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
      <p className="text-slate-600 leading-relaxed">
        Your account is not registered in the Prowess Technologies system. Please contact an administrator to gain access.
      </p>
      <button
        onClick={onLogout}
        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </motion.div>
  </div>
);

const Sidebar = ({ user, onLogout }: { user: UserProfile, onLogout: () => void }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Wrench, label: 'Jobs', path: '/jobs' },
    { icon: Users, label: 'Customers', path: '/customers' },
    { icon: Briefcase, label: 'Technicians', path: '/technicians' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    ...(user.role === 'admin' || user.role === 'manager' ? [{ icon: TrendingUp, label: 'Reports', path: '/reports' }] : []),
    ...(user.role === 'admin' ? [{ icon: Users, label: 'Users', path: '/users' }] : []),
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className={`bg-slate-900 text-white h-screen transition-all duration-300 flex flex-col sticky top-0 ${isOpen ? 'w-64' : 'w-20'}`}>
      <div className="p-6 flex items-center justify-between">
        {isOpen && <h2 className="text-xl font-bold tracking-tighter">PROWESS</h2>}
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-slate-800 rounded-lg">
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
              location.pathname === item.path 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={22} />
            {isOpen && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className={`flex items-center gap-3 mb-4 ${!isOpen && 'justify-center'}`}>
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white shrink-0">
            {user.name.charAt(0)}
          </div>
          {isOpen && (
            <div className="overflow-hidden">
              <p className="font-bold truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-4 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all ${!isOpen && 'justify-center'}`}
        >
          <LogOut size={22} />
          {isOpen && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

// --- Pages ---

const Dashboard = ({ jobs, customers, technicians, user, notifications, inventory = [] }: { jobs: Job[], customers: Customer[], technicians: Technician[], user: UserProfile, notifications: Notification[], inventory?: InventoryItem[] }) => {
  const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity);
  const filteredJobs = user.role === 'technician' 
    ? jobs.filter(j => j.technicianId === user.id)
    : jobs;

  const stats = [
    { label: 'Total Jobs', value: filteredJobs.length, icon: Wrench, color: 'bg-indigo-500' },
    { label: 'Pending', value: filteredJobs.filter(j => j.status === 'pending').length, icon: Clock, color: 'bg-amber-500' },
    { label: 'Completed', value: filteredJobs.filter(j => j.status === 'completed').length, icon: CheckCircle2, color: 'bg-emerald-500' },
    { 
      label: 'Customers', 
      value: user.role === 'technician' 
        ? new Set(filteredJobs.map(j => j.customerId)).size 
        : customers.length, 
      icon: Users, 
      color: 'bg-blue-500' 
    },
  ];

  const recentNotifications = notifications.slice(0, 5);

  const chartData = [
    { name: 'Jan', jobs: 12 },
    { name: 'Feb', jobs: 19 },
    { name: 'Mar', jobs: 15 },
    { name: 'Apr', jobs: 22 },
    { name: 'May', jobs: 30 },
    { name: 'Jun', jobs: 25 },
  ];

  const statusData = [
    { name: 'Pending', value: filteredJobs.filter(j => j.status === 'pending').length },
    { name: 'In Progress', value: filteredJobs.filter(j => j.status === 'in-progress').length },
    { name: 'Completed', value: filteredJobs.filter(j => j.status === 'completed').length },
    { name: 'Cancelled', value: filteredJobs.filter(j => j.status === 'cancelled').length },
  ];

  const COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ef4444'];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back, {user.name}. Here's what's happening today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className={`${stat.color} p-4 rounded-2xl text-white`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {lowStockItems.length > 0 && (user.role === 'admin' || user.role === 'manager') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-2xl text-red-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-red-900">Low Stock Alert</h4>
              <p className="text-sm text-red-700">{lowStockItems.length} items are below minimum stock levels.</p>
            </div>
          </div>
          <Link to="/inventory" className="bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all">
            Manage Inventory
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Service Trends</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="jobs" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-6">Job Status Distribution</h3>
          <div className="h-80 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 mt-4 w-full">
              {statusData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Bell size={20} className="text-indigo-600" />
            Recent Notifications
          </h3>
          <div className="space-y-4">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notif) => (
                <div key={notif.id} className={`p-4 rounded-2xl border ${notif.read ? 'bg-slate-50 border-slate-100' : 'bg-indigo-50 border-indigo-100'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-slate-900 text-sm">{notif.title}</p>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-slate-400 text-sm">No recent notifications.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold">Recent Jobs</h3>
            <Link to="/jobs" className="text-indigo-600 text-sm font-bold hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-8 py-4 font-bold">Job ID</th>
                  <th className="px-8 py-4 font-bold">Type</th>
                  <th className="px-8 py-4 font-bold">Customer</th>
                  <th className="px-8 py-4 font-bold">Status</th>
                  <th className="px-8 py-4 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.slice(0, 5).map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4 font-mono text-sm text-slate-500">#{job.id.slice(0, 6)}</td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        job.type === 'repair' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {job.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-medium text-slate-900">
                      {customers.find(c => c.id === job.customerId)?.name || 'Unknown'}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          job.status === 'completed' ? 'bg-emerald-500' : 
                          job.status === 'pending' ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}></div>
                        <span className="text-sm text-slate-600 capitalize">{job.status}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm text-slate-500">
                      {job.scheduledDate.toDate().toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const Jobs = ({ jobs, customers, technicians, currentUser }: { jobs: Job[], customers: Customer[], technicians: Technician[], currentUser: UserProfile }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);

  const [formData, setFormData] = useState({
    type: 'repair' as JobType,
    status: 'pending' as JobStatus,
    customerId: '',
    technicianId: '',
    description: '',
    cost: 0,
    scheduledDate: new Date().toISOString().slice(0, 16)
  });

  const [view, setView] = useState<'list' | 'calendar' | 'map'>('list');
  const [geocodedJobs, setGeocodedJobs] = useState<(Job & { location?: google.maps.LatLngLiteral })[]>([]);

  const filteredJobs = jobs.filter(j => {
    const matchesFilter = filter === 'all' || j.status === filter;
    const customerName = customers.find(c => c.id === j.customerId)?.name || '';
    const matchesSearch = customerName.toLowerCase().includes(search.toLowerCase()) || 
                          j.description.toLowerCase().includes(search.toLowerCase());
    const matchesRole = currentUser.role === 'technician' 
      ? (j.technicianId === currentUser.id || j.technicianId === currentUser.email) 
      : true;
    return matchesFilter && matchesSearch && matchesRole;
  });

  useEffect(() => {
    // In a real app, we would use a geocoding service.
    // For this demo, we'll assign random coordinates around a center if not present.
    const center = { lat: 37.42, lng: -122.08 };
    const updated = filteredJobs.map(job => {
      if (job.location) return job as Job & { location: google.maps.LatLngLiteral };
      return {
        ...job,
        location: {
          lat: center.lat + (Math.random() - 0.5) * 0.05,
          lng: center.lng + (Math.random() - 0.5) * 0.05
        }
      } as Job & { location: google.maps.LatLngLiteral };
    });
    setGeocodedJobs(updated);
  }, [filteredJobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const history: JobHistoryItem[] = editingJob ? [...(editingJob.history || [])] : [];
      const now = Timestamp.now();

      if (!editingJob) {
        history.push({
          timestamp: now,
          type: 'creation',
          to: 'Job Created',
          updatedBy: currentUser.name
        });
      } else {
        if (editingJob.status !== formData.status) {
          history.push({
            timestamp: now,
            type: 'status_change',
            from: editingJob.status,
            to: formData.status,
            updatedBy: currentUser.name
          });
        }
        if (editingJob.technicianId !== formData.technicianId) {
          const fromTech = technicians.find(t => t.id === editingJob.technicianId)?.name || 'Unassigned';
          const toTech = technicians.find(t => t.id === formData.technicianId)?.name || 'Unassigned';
          history.push({
            timestamp: now,
            type: 'technician_assignment',
            from: fromTech,
            to: toTech,
            updatedBy: currentUser.name
          });
        }
      }

      const jobData = {
        ...formData,
        cost: Number(formData.cost),
        scheduledDate: Timestamp.fromDate(new Date(formData.scheduledDate)),
        createdAt: editingJob ? editingJob.createdAt : now,
        history
      };

      if (editingJob) {
        await updateDoc(doc(db, 'jobs', editingJob.id), jobData);
        
        // Notify technician if assigned/changed
        if (formData.technicianId && formData.technicianId !== editingJob.technicianId) {
          await addDoc(collection(db, 'notifications'), {
            userId: formData.technicianId,
            title: 'New Job Assignment',
            message: `You have been assigned to a new job: ${formData.type} for ${customers.find(c => c.id === formData.customerId)?.name}`,
            type: 'job_assigned',
            createdAt: now,
            read: false
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'jobs'), jobData);
        
        // Notify technician if assigned on creation
        if (formData.technicianId) {
          await addDoc(collection(db, 'notifications'), {
            userId: formData.technicianId,
            title: 'New Job Assignment',
            message: `You have been assigned to a new job: ${formData.type} for ${customers.find(c => c.id === formData.customerId)?.name}`,
            type: 'job_assigned',
            createdAt: now,
            read: false
          });
        }
      }
      setIsModalOpen(false);
      setEditingJob(null);
      setFormData({
        type: 'repair',
        status: 'pending',
        customerId: '',
        technicianId: '',
        description: '',
        cost: 0,
        scheduledDate: new Date().toISOString().slice(0, 16)
      });
    } catch (err) {
      handleFirestoreError(err, editingJob ? OperationType.UPDATE : OperationType.CREATE, 'jobs');
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setFormData({
      type: job.type,
      status: job.status,
      customerId: job.customerId,
      technicianId: job.technicianId || '',
      description: job.description,
      cost: job.cost,
      scheduledDate: job.scheduledDate.toDate().toISOString().slice(0, 16)
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Custom modal would be better, but for now using a simple check
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await deleteDoc(doc(db, 'jobs', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'jobs');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Jobs Management</h1>
          <p className="text-slate-500">Track and manage all repairs and installations.</p>
        </div>
        {currentUser.role !== 'technician' && (
          <button 
            onClick={() => { setEditingJob(null); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            New Job
          </button>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search jobs or customers..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['all', 'pending', 'in-progress', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-all ${
                filter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setView('list')}
            className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            title="List View"
          >
            <LayoutGrid size={20} />
          </button>
          <button 
            onClick={() => setView('calendar')}
            className={`p-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            title="Calendar View"
          >
            <Calendar size={20} />
          </button>
          <button 
            onClick={() => setView('map')}
            className={`p-2 rounded-xl transition-all ${view === 'map' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            title="Map View"
          >
            <MapIcon size={20} />
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredJobs.map((job) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={job.id}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full group"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                    job.type === 'repair' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {job.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setViewingJob(job); setIsDetailsOpen(true); }} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" title="View Details">
                      <ExternalLink size={16} />
                    </button>
                    <button onClick={() => handleEdit(job)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                      <Edit2 size={16} />
                    </button>
                    {currentUser.role === 'admin' && (
                      <button onClick={() => handleDelete(job.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <span className="text-xs text-slate-400 font-mono">#{job.id.slice(0, 6)}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {customers.find(c => c.id === job.customerId)?.name || 'Unknown Customer'}
                </h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1">{job.description}</p>
                
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar size={16} className="text-slate-400" />
                    <span>{job.scheduledDate.toDate().toLocaleDateString()} at {job.scheduledDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <UserIcon size={16} className="text-slate-400" />
                    <span>Tech: {technicians.find(t => t.id === job.technicianId)?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        job.status === 'completed' ? 'bg-emerald-500' : 
                        job.status === 'pending' ? 'bg-amber-500' : 
                        job.status === 'cancelled' ? 'bg-red-500' : 'bg-indigo-500'
                      }`}></div>
                      <span className="text-sm font-bold text-slate-700 capitalize">{job.status}</span>
                    </div>
                    <p className="text-lg font-bold text-indigo-600">${job.cost}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {view === 'calendar' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <CalendarView jobs={filteredJobs} customers={customers} onJobClick={(job) => { setViewingJob(job); setIsDetailsOpen(true); }} />
        </div>
      )}

      {view === 'map' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[600px]">
          <JobMapView jobs={geocodedJobs} customers={customers} onJobClick={(job) => { setViewingJob(job); setIsDetailsOpen(true); }} />
        </div>
      )}

      <Modal 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        title="Job Details"
      >
        {viewingJob && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
                <p className="font-bold text-slate-900">{customers.find(c => c.id === viewingJob.customerId)?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    viewingJob.status === 'completed' ? 'bg-emerald-500' : 
                    viewingJob.status === 'pending' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}></div>
                  <span className="font-bold text-slate-700 capitalize">{viewingJob.status}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize inline-block ${
                  viewingJob.type === 'repair' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {viewingJob.type}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Technician</p>
                <p className="font-medium text-slate-700">{technicians.find(t => t.id === viewingJob.technicianId)?.name || 'Unassigned'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</p>
              <p className="text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">{viewingJob.description}</p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                Job History
              </h4>
              <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {viewingJob.history?.slice().reverse().map((item, idx) => (
                  <div key={idx} className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.type === 'creation' && 'Job Created'}
                        {item.type === 'status_change' && `Status changed to ${item.to}`}
                        {item.type === 'technician_assignment' && `Assigned to ${item.to}`}
                        {item.type === 'update' && 'Job details updated'}
                      </p>
                      {item.from && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          From: <span className="font-medium">{item.from}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          {item.timestamp.toDate().toLocaleString()}
                        </p>
                        <span className="text-[10px] font-bold text-indigo-600/60 uppercase tracking-wider">
                          By {item.updatedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-slate-400 italic pl-8">No history recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingJob ? 'Edit Job' : 'Create New Job'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select 
              label="Job Type" 
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as JobType })}
              options={[
                { value: 'repair', label: 'Repair' },
                { value: 'installation', label: 'Installation' }
              ]}
              disabled={currentUser.role === 'technician'}
            />
            <Select 
              label="Status" 
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'in-progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select 
              label="Customer" 
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              options={[
                { value: '', label: 'Select Customer' },
                ...customers.map(c => ({ value: c.id, label: c.name }))
              ]}
              required
              disabled={currentUser.role === 'technician'}
            />
            <Select 
              label="Technician" 
              value={formData.technicianId}
              onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
              options={[
                { value: '', label: 'Unassigned' },
                ...technicians.map(t => ({ value: t.id, label: t.name }))
              ]}
              disabled={currentUser.role === 'technician'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Scheduled Date & Time" 
              type="datetime-local"
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              required
              disabled={currentUser.role === 'technician'}
            />
            <Input 
              label="Estimated Cost ($)" 
              type="number"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
              required
              disabled={currentUser.role === 'technician'}
            />
          </div>

          <TextArea 
            label="Job Description" 
            placeholder="Describe the work to be done..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={currentUser.role === 'technician'}
          />

          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              {editingJob ? 'Update Job' : 'Create Job'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Customers = ({ customers, jobs, currentUser, onSelectCustomer }: { customers: Customer[], jobs: Job[], currentUser: UserProfile, onSelectCustomer: (c: Customer) => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const isTechnician = currentUser.role === 'technician';

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    
    if (currentUser.role === 'technician') {
      // Only show customers that have jobs assigned to this technician
      const techJobs = jobs.filter(j => j.technicianId === currentUser.id || j.technicianId === currentUser.email);
      const customerIds = new Set(techJobs.map(j => j.customerId));
      return matchesSearch && customerIds.has(c.id);
    }
    return matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), formData);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          createdAt: Timestamp.now()
        });
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', address: '' });
    } catch (err) {
      handleFirestoreError(err, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure? This will not delete their jobs.')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'customers');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500">Manage your client database.</p>
        </div>
        {!isTechnician && (
          <button 
            onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            Add Customer
          </button>
        )}
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search customers by name, email or phone..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <motion.div
            layout
            key={customer.id}
            onClick={() => onSelectCustomer(customer)}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 group cursor-pointer hover:border-indigo-200 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl">
                {customer.name.charAt(0)}
              </div>
              {!isTechnician && (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(customer); }} 
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  {currentUser.role === 'admin' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} 
                      className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">{customer.name}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail size={16} className="text-slate-400" />
                <span className="truncate">{customer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="truncate">{customer.address}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Full Name" 
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Email Address" 
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input 
              label="Phone Number" 
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <Input 
            label="Service Address" 
            placeholder="123 Main St, City, State"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />
          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Technicians = ({ technicians, currentUser, onSelectTechnician }: { technicians: Technician[], currentUser: UserProfile, onSelectTechnician: (t: Technician) => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    specialty: '',
    status: 'active' as 'active' | 'inactive'
  });

  const isAdmin = currentUser.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTech) {
        await updateDoc(doc(db, 'technicians', editingTech.id), formData);
      } else {
        await addDoc(collection(db, 'technicians'), formData);
      }
      setIsModalOpen(false);
      setEditingTech(null);
      setFormData({ name: '', email: '', specialty: '', status: 'active' });
    } catch (err) {
      handleFirestoreError(err, editingTech ? OperationType.UPDATE : OperationType.CREATE, 'technicians');
    }
  };

  const handleEdit = (tech: Technician) => {
    setEditingTech(tech);
    setFormData({
      name: tech.name,
      email: tech.email,
      specialty: tech.specialty,
      status: tech.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure? This will remove the technician from the active roster.')) return;
    try {
      await deleteDoc(doc(db, 'technicians', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'technicians');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Technicians</h1>
          <p className="text-slate-500">Manage your service team.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingTech(null); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            Add Technician
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map((tech) => (
          <motion.div
            layout
            key={tech.id}
            onClick={() => onSelectTechnician(tech)}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col cursor-pointer hover:border-indigo-200 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-bold text-xl">
                {tech.name.charAt(0)}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(tech.id); }}
                    className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  tech.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tech.status}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{tech.name}</h3>
            <p className="text-indigo-600 text-sm font-medium mb-4">{tech.specialty}</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail size={16} className="text-slate-400" />
                <span>{tech.email}</span>
              </div>
            </div>

            {isAdmin && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleEdit(tech); }}
                className="mt-auto w-full py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-100"
              >
                Edit Profile
              </button>
            )}
          </motion.div>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTech ? 'Edit Technician' : 'Add New Technician'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Full Name" 
            placeholder="Jane Smith"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input 
            label="Email Address" 
            type="email"
            placeholder="jane@prowess.tech"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input 
            label="Specialty" 
            placeholder="Network Installation, Hardware Repair, etc."
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            required
          />
          <Select 
            label="Status" 
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' }
            ]}
          />
          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              {editingTech ? 'Update Technician' : 'Add Technician'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Inventory = ({ inventory, currentUser }: { inventory: InventoryItem[], currentUser: UserProfile }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    minQuantity: 5,
    unitPrice: 0
  });

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filteredItems = inventory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        updatedAt: Timestamp.now()
      };
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'inventory'), data);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', description: '', category: '', quantity: 0, minQuantity: 5, unitPrice: 0 });
    } catch (err) {
      handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'inventory');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unitPrice: item.unitPrice
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'inventory');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500">Manage parts and equipment.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            Add Item
          </button>
        )}
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search inventory by name or category..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Item</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                    {item.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold",
                      item.quantity <= item.minQuantity ? "text-red-600" : "text-slate-900"
                    )}>
                      {item.quantity}
                    </span>
                    {item.quantity <= item.minQuantity && (
                      <AlertCircle size={14} className="text-red-500" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">${item.unitPrice}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Item Name" 
            placeholder="e.g., Cat6 Ethernet Cable (100ft)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextArea 
            label="Description" 
            placeholder="Technical specifications or usage notes..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Category" 
              placeholder="e.g., Networking"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            />
            <Input 
              label="Unit Price ($)" 
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Current Quantity" 
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              required
            />
            <Input 
              label="Min Quantity (Alert)" 
              type="number"
              value={formData.minQuantity}
              onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
              required
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              {editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Reports = ({ jobs, technicians }: { jobs: Job[], technicians: Technician[] }) => {
  const completedJobs = jobs.filter(j => j.status === 'completed');
  
  // Revenue by Month
  const revenueByMonth = completedJobs.reduce((acc: any[], job) => {
    const month = format(job.scheduledDate.toDate(), 'MMM yyyy');
    const existing = acc.find(a => a.name === month);
    if (existing) {
      existing.revenue += job.cost;
    } else {
      acc.push({ name: month, revenue: job.cost });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

  // Jobs by Status
  const jobsByStatus = [
    { name: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: '#10b981' },
    { name: 'In Progress', value: jobs.filter(j => j.status === 'in-progress').length, color: '#6366f1' },
    { name: 'Pending', value: jobs.filter(j => j.status === 'pending').length, color: '#f59e0b' },
    { name: 'Cancelled', value: jobs.filter(j => j.status === 'cancelled').length, color: '#ef4444' },
  ];

  // Technician Performance
  const techPerformance = technicians.map(tech => ({
    name: tech.name,
    completed: jobs.filter(j => j.technicianId === tech.id && j.status === 'completed').length
  })).sort((a, b) => b.completed - a.completed);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500">Insights into business performance.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all print:hidden"
        >
          <TrendingUp size={20} />
          Print Report
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Revenue Growth</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`$${value}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Job Status Distribution */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Job Status Distribution</h3>
          <div className="h-80 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jobsByStatus}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {jobsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 pr-8">
              {jobsByStatus.map(status => (
                <div key={status.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-sm text-slate-600 font-medium">{status.name}</span>
                  <span className="text-sm text-slate-400">({status.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technician Performance */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Technician Performance (Completed Jobs)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={techPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={120} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="completed" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const UsersManagement = ({ users }: { users: UserProfile[] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    role: 'technician' as 'admin' | 'manager' | 'technician'
  });

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), formData);
      } else {
        // Use email as the document ID for pre-registration.
        // Also set the 'id' field to the email to satisfy isValidUser rule.
        const preRegData = { ...formData, id: formData.email };
        await setDoc(doc(db, 'users', formData.email), preRegData);
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      handleFirestoreError(err, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'users');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Manage system access and roles.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setFormData({ id: '', name: '', email: '', role: 'technician' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus size={20} />
          Register User
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id || user.email} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold capitalize",
                    user.role === 'admin' ? "bg-purple-100 text-purple-700" :
                    user.role === 'manager' ? "bg-blue-100 text-blue-700" :
                    "bg-emerald-100 text-emerald-700"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEdit(user)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(user.id || user.email)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? 'Edit User' : 'Register New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Full Name" 
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input 
            label="Email Address" 
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={!!editingUser}
          />
          <Select 
            label="System Role" 
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            options={[
              { value: 'admin', label: 'Administrator' },
              { value: 'manager', label: 'Manager' },
              { value: 'technician', label: 'Technician' }
            ]}
          />
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              {editingUser ? 'Update User' : 'Register User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Settings = ({ user, onUpdateProfile }: { user: UserProfile, onUpdateProfile: (data: Partial<UserProfile>) => Promise<void> }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email
  });
  const [isSaving, setIsSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(user.settings?.darkMode || false);
  const [notifications, setNotifications] = useState(user.settings?.emailNotifications !== false);

  const handleToggleDarkMode = async () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    await onUpdateProfile({
      settings: {
        ...user.settings,
        darkMode: newVal
      }
    });
  };

  const handleToggleNotifications = async () => {
    const newVal = !notifications;
    setNotifications(newVal);
    await onUpdateProfile({
      settings: {
        ...user.settings,
        emailNotifications: newVal
      }
    });
  };

  const handleDeleteAccount = async () => {
    if (user.email === 'codzlabzim53@gmail.com') {
      alert("Super Admin account cannot be deleted.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete your account? This action is permanent.")) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.id));
      await signOut(auth);
    } catch (error) {
      console.error("Failed to delete account", error);
    }
  };
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile(formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500">Manage your account and system preferences.</p>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="bg-white border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Edit2 size={20} />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-100">
        <div className="p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <UserIcon size={20} className="text-indigo-600" />
            Profile Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Full Name</p>
              {isEditing ? (
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              ) : (
                <p className="text-lg font-medium text-slate-900">{user.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Email Address</p>
              <p className="text-lg font-medium text-slate-900">{user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">System Role</p>
              <p className="text-lg font-medium text-slate-900 capitalize">{user.role}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-600" />
            System Configuration
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-bold text-slate-900">Email Notifications</p>
                <p className="text-sm text-slate-500">Receive updates about job assignments.</p>
              </div>
              <button 
                onClick={handleToggleNotifications}
                className={`w-12 h-6 rounded-full relative transition-all ${notifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-bold text-slate-900">Dark Mode</p>
                <p className="text-sm text-slate-500">Switch to a darker color theme.</p>
              </div>
              <button 
                onClick={handleToggleDarkMode}
                className={`w-12 h-6 rounded-full relative transition-all ${darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-red-50 p-8 rounded-3xl border border-red-100">
        <h3 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h3>
        <p className="text-red-700 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
        <button 
          onClick={handleDeleteAccount}
          className="px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);

  useEffect(() => {
    if (userProfile?.settings?.darkMode !== undefined) {
      setDarkMode(userProfile.settings.darkMode);
    }
  }, [userProfile]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setIsNotRegistered(false);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data() as UserProfile;
          // Ensure super admin always has admin role
          if (firebaseUser.email === 'codzlabzim53@gmail.com' && data.role !== 'admin') {
            const updatedProfile = { ...data, role: 'admin' as const };
            await updateDoc(profileRef, { role: 'admin' });
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(data);
          }
        } else {
          // Check for pre-registration by email
          const emailProfileRef = doc(db, 'users', firebaseUser.email || '');
          const emailProfileSnap = await getDoc(emailProfileRef);

          if (emailProfileSnap.exists()) {
            const data = emailProfileSnap.data() as UserProfile;
            const newProfile: UserProfile = {
              ...data,
              id: firebaseUser.uid // Claim the profile with the real UID
            };
            await setDoc(profileRef, newProfile);
            await deleteDoc(emailProfileRef);
            setUserProfile(newProfile);
          } else if (firebaseUser.email === 'codzlabzim53@gmail.com') {
            // Auto-create super admin
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Super Admin',
              email: firebaseUser.email || '',
              role: 'admin'
            };
            await setDoc(profileRef, newProfile);
            setUserProfile(newProfile);
          } else {
            setIsNotRegistered(true);
            setUserProfile(null);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || isNotRegistered) return;

    const unsubJobs = onSnapshot(collection(db, 'jobs'), (snap) => {
      setJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'jobs'));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    const unsubTechs = onSnapshot(collection(db, 'technicians'), (snap) => {
      setTechnicians(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'technicians'));

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    let unsubUsers = () => {};
    if (userProfile?.role === 'admin') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    }

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')),
      (snap) => {
        setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubJobs();
      unsubCustomers();
      unsubTechs();
      unsubInventory();
      unsubUsers();
      unsubNotifications();
    };
  }, [user, userProfile, isNotRegistered]);

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUserProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  if (loading) return <LoadingScreen />;

  if (isNotRegistered) return <NotRegistered onLogout={() => signOut(auth)} />;

  if (!user || !userProfile) return <Login />;

  return (
    <Router>
      <div className="flex bg-slate-50 min-h-screen">
        <Sidebar user={userProfile} onLogout={() => signOut(auth)} />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Prowess System</span>
            </div>
            <div className="flex items-center gap-4">
              <Notifications notifications={notifications} onMarkAsRead={handleMarkAsRead} />
              <div className="h-8 w-px bg-slate-100 mx-2" />
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900 leading-none mb-1">{userProfile.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{userProfile.role}</p>
                </div>
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/20">
                  {userProfile.name.charAt(0)}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-8 overflow-y-auto max-h-[calc(100vh-5rem)]">
            <Routes>
              <Route path="/" element={<Dashboard jobs={jobs} customers={customers} technicians={technicians} user={userProfile} notifications={notifications} inventory={inventory} />} />
              <Route path="/jobs" element={<Jobs jobs={jobs} customers={customers} technicians={technicians} currentUser={userProfile} />} />
              <Route path="/customers" element={
                selectedCustomer ? (
                  <CustomerDetail customer={selectedCustomer} jobs={jobs} onClose={() => setSelectedCustomer(null)} />
                ) : (
                  <Customers customers={customers} jobs={jobs} currentUser={userProfile} onSelectCustomer={setSelectedCustomer} />
                )
              } />
              <Route path="/technicians" element={
                selectedTechnician ? (
                  <TechnicianDetail technician={selectedTechnician} jobs={jobs} onClose={() => setSelectedTechnician(null)} />
                ) : (
                  <Technicians technicians={technicians} currentUser={userProfile} onSelectTechnician={setSelectedTechnician} />
                )
              } />
              <Route path="/inventory" element={<Inventory inventory={inventory} currentUser={userProfile} />} />
              {(userProfile.role === 'admin' || userProfile.role === 'manager') && (
                <Route path="/reports" element={<Reports jobs={jobs} technicians={technicians} />} />
              )}
              {userProfile.role === 'admin' && (
                <Route path="/users" element={<UsersManagement users={allUsers} />} />
              )}
              <Route path="/settings" element={<Settings user={userProfile} onUpdateProfile={handleUpdateProfile} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
