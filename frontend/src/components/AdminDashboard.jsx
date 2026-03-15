import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Image as ImageIcon, MessageSquare, Activity, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboard = ({ onBack }) => {
  const [stats, setStats] = useState({
    users: 0,
    imagesProcessed: 0,
    chatsTotal: 0,
    activeNow: 1
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          axios.get('http://localhost:5000/api/admin/stats'),
          axios.get('http://localhost:5000/api/admin/users')
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
      } catch (err) {
        console.error("Failed to fetch admin data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-400' },
    { label: 'Images Analyzed', value: stats.imagesProcessed, icon: ImageIcon, color: 'text-purple-400' },
    { label: 'AI Conversations', value: stats.chatsTotal, icon: MessageSquare, color: 'text-green-400' },
    { label: 'Active Sessions', value: stats.activeNow, icon: Activity, color: 'text-red-400' },
  ];

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 glass-card hover:bg-white/10 rounded-full transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">Admin Insights</h1>
        </div>
        <div className="text-xs font-mono text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
          System Live // Neural Monitoring Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statCards.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-4 border-white/5 shadow-xl"
          >
            <div className={`p-4 rounded-2xl bg-white/5 ${stat.color}`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{stat.label}</p>
              <h2 className="text-4xl font-bold mt-1 tracking-tight">{stat.value}</h2>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card p-8 border-white/5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-8">
            <Users className="w-5 h-5 text-primary-400" />
            <h3 className="text-xl font-bold">Registered Neural Interfaces (Users)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-widest">
                <th className="pb-4 font-bold">User Identity (ID)</th>
                <th className="pb-4 font-bold">Total Syncs</th>
                <th className="pb-4 font-bold">Last Uplink</th>
                <th className="pb-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-slate-500 italic">No users mapped in current sector</td>
                </tr>
              ) : users.map((user, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-4 font-mono text-primary-300 text-xs">{user.id}</td>
                  <td className="py-4 font-bold">{user.totalChats}</td>
                  <td className="py-4 text-slate-400">
                    {new Date(user.lastActive).toLocaleString()}
                  </td>
                  <td className="py-4 text-right">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20">CONNECTED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
