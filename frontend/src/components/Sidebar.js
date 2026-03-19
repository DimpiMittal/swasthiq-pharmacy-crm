import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, LayoutDashboard, Package, Activity,
  Calendar, Users, Link2, Plus, Settings
} from 'lucide-react';

const NAV = [
  { icon: Search,          path: null },
  { icon: LayoutDashboard, path: '/',          label: 'Dashboard' },
  { icon: Package,         path: '/inventory', label: 'Inventory' },
  { icon: Activity,        path: null },
  { icon: Calendar,        path: null },
  { icon: Users,           path: null },
  { icon: Link2,           path: null },
];

export default function Sidebar() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sb-logo">✚</div>
      <nav className="sb-nav">
        {NAV.map((item, i) => {
          const Icon = item.icon;
          return (
            <button key={i}
              className={'sb-btn' + (item.path && pathname === item.path ? ' active' : '')}
              title={item.label || ''}
              onClick={() => item.path && nav(item.path)}>
              <Icon size={18} />
            </button>
          );
        })}
        <button className="sb-add" title="Add new">
          <Plus size={18} />
        </button>
      </nav>
      <div className="sb-bottom">
        <button className="sb-btn" title="Settings">
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
