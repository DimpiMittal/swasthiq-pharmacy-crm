import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, SlidersHorizontal,
  Package, CheckCircle, AlertCircle, DollarSign, RefreshCw
} from 'lucide-react';
import { api } from '../api';
import MedicineModal from '../components/MedicineModal';

function StatusChip({ status }) {
  const map = {
    Active:'active', 'Low Stock':'low', Expired:'expired', 'Out of Stock':'out',
  };
  return <span className={'chip chip-'+(map[status]||'out')}>{status}</span>;
}

const PER = 10;

export default function Inventory({ toast }) {
  const nav = useNavigate();

  const [ov,       setOv]      = useState(null);
  const [meds,     setMeds]    = useState([]);
  const [total,    setTotal]   = useState(0);
  const [page,     setPage]    = useState(1);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [stF,      setStF]     = useState('');
  const [catF,     setCatF]    = useState('');
  const [cats,     setCats]    = useState([]);
  const [modal,    setModal]   = useState(false);
  const [editing,  setEditing] = useState(null);
  const [delId,    setDelId]   = useState(null);

  const load = useCallback(async (pg, s, st, cat) => {
    setLoading(true);
    try {
      const p = { page: pg, per_page: PER };
      if (s)   p.search   = s;
      if (st)  p.status   = st;
      if (cat) p.category = cat;

      const [ovR, mR, cR] = await Promise.all([
        api.getOverview(),
        api.getMedicines(p),
        api.getCategories(),
      ]);
      setOv(ovR.data.data);
      setMeds(mR.data.data);
      setTotal(mR.data.pagination.total);
      setCats(cR.data.data.categories);
    } catch {
      toast?.error('Failed to load inventory — is the backend running?');
    } finally { setLoading(false); }
  }, [toast]);

  // initial
  useEffect(() => { load(1,'','',''); }, [load]);

  // filters
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search, stF, catF); }, 300);
    return () => clearTimeout(t);
  }, [search, stF, catF, load]);

  // page change
  useEffect(() => {
    load(page, search, stF, catF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const save = async (data) => {
    try {
      if (editing) { await api.updateMedicine(editing.id, data); toast?.success('Medicine updated!'); }
      else         { await api.createMedicine(data);              toast?.success('Medicine added!');   }
      setModal(false); setEditing(null);
      load(page, search, stF, catF);
    } catch (e) { toast?.error(e.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this medicine? This cannot be undone.')) return;
    setDelId(id);
    try {
      await api.deleteMedicine(id);
      toast?.success('Deleted successfully');
      load(page, search, stF, catF);
    } catch (e) { toast?.error(e.message); }
    finally { setDelId(null); }
  };

  const markStatus = async (id, s) => {
    try {
      await api.markStatus(id, s);
      toast?.success('Status updated to ' + s);
      load(page, search, stF, catF);
    } catch (e) { toast?.error(e.message); }
  };

  const pages = Math.ceil(total / PER);
  const today = new Date().toISOString().slice(0, 10);
  const fmtV = n => n >= 100000 ? '₹'+(n/100000).toFixed(2)+'L' : '₹'+Number(n).toLocaleString('en-IN');

  return (
    <div>
      <div className="ph">
        <div>
          <h1 className="ph-title">Pharmacy CRM</h1>
          <p className="ph-sub">Manage inventory, sales, and purchase orders</p>
        </div>
        <div className="ph-acts">
          <button className="btn btn-outline" onClick={() => load(page,search,stF,catF)}>
            <RefreshCw size={13}/>
          </button>
          <button className="btn btn-outline">↑ Export</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
            <Plus size={14}/> Add Medicine
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="stats">
        {[
          { icon:<DollarSign size={20}/>, bg:'#DCFCE7', col:'#16A34A', badge:'+12.5%', bc:'bg-success',
            v: loading?'…':fmtV(ov?.total_value||0), l:'Inventory Value' },
          { icon:<Package size={20}/>,    bg:'#EFF6FF', col:'#2563EB', badge:(ov?.total_items||0)+' Items', bc:'bg-info',
            v: loading?'…':(ov?.active_stock||0), l:'Active Stock' },
          { icon:<AlertCircle size={20}/>,bg:'#FFF7ED', col:'#EA580C', badge:'Action Needed', bc:'bg-orange',
            v: loading?'…':(ov?.low_stock||0), l:'Low Stock Items' },
          { icon:<Package size={20}/>,    bg:'#F5F3FF', col:'#7C3AED', badge:'', bc:'',
            v: loading?'…':(ov?.total_items||0), l:'Total Medicines' },
        ].map((s,i) => (
          <div key={i} className="stat-card">
            <div className="stat-top">
              <div className="stat-icon" style={{background:s.bg,color:s.col}}>{s.icon}</div>
              {s.badge && <span className={'stat-badge '+s.bc}>{s.badge}</span>}
            </div>
            <div className="stat-val">{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className="tab-btn" onClick={() => nav('/')}>📊 Sales</button>
        <button className="tab-btn" onClick={() => nav('/')}>🛒 Purchase</button>
        <button className="tab-btn active">📦 Inventory</button>
        <div className="tab-acts">
          <button className="btn btn-primary btn-sm" onClick={() => nav('/')}>
            <Plus size={12}/> New Sale
          </button>
          <button className="btn btn-outline btn-sm">
            <Plus size={12}/> New Purchase
          </button>
        </div>
      </div>

      <div className="card">
        {/* Inventory Overview strip */}
        <div style={{ padding:'18px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 className="card-title">Inventory Overview</h3>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-outline btn-sm"><SlidersHorizontal size={12}/> Filter</button>
              <button className="btn btn-outline btn-sm">↑ Export</button>
            </div>
          </div>
        </div>

        <div className="ov-grid">
          {[
            { l:'Total Items',   v: ov?.total_items??0,                               icon:<Package size={14}/>,      col:'var(--primary)' },
            { l:'Active Stock',  v: ov?.active_stock??0,                              icon:<CheckCircle size={14}/>,  col:'var(--success)' },
            { l:'Low Stock',     v: ov?.low_stock??0,                                 icon:<AlertCircle size={14}/>,  col:'var(--warning)' },
            { l:'Total Value',   v:'₹'+Number(ov?.total_value||0).toLocaleString('en-IN'), icon:<DollarSign size={14}/>,col:'var(--success)' },
          ].map((o,i) => (
            <div key={i} className="ov-item">
              <div className="ov-row">
                <span className="ov-lbl">{o.l}</span>
                <span style={{ color:o.col }}>{o.icon}</span>
              </div>
              <div className="ov-val" style={i===3?{fontSize:19}:{}}>{loading?'…':o.v}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:'18px 20px 0' }}>
          <h3 className="card-title" style={{ marginBottom:14 }}>Complete Inventory</h3>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="search-wrap">
            <span className="si"><Search size={14}/></span>
            <input className="search-inp" placeholder="Search name, batch, generic…"
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="flt-sel" value={stF}
            onChange={e => { setStF(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {['Active','Low Stock','Expired','Out of Stock'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="flt-sel" value={catF}
            onChange={e => { setCatF(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          {(search||stF||catF) && (
            <button className="btn btn-sm btn-outline"
              onClick={() => { setSearch(''); setStF(''); setCatF(''); setPage(1); }}>
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>MEDICINE NAME</th><th>GENERIC NAME</th><th>CATEGORY</th>
                <th>BATCH NO</th><th>EXPIRY DATE</th><th>QUANTITY</th>
                <th>COST PRICE</th><th>MRP</th><th>SUPPLIER</th>
                <th>STATUS</th><th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11}>
                  <div className="loading"><div className="spin"/> Loading inventory…</div>
                </td></tr>
              ) : meds.length === 0 ? (
                <tr><td colSpan={11}>
                  <div className="empty">
                    <Package size={28} style={{ opacity:.3 }}/>
                    <span>No medicines found. Try clearing filters or add a new medicine.</span>
                  </div>
                </td></tr>
              ) : meds.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight:600 }}>{m.medicine_name}</td>
                  <td style={{ color:'var(--text-2)' }}>{m.generic_name||'—'}</td>
                  <td>{m.category||'—'}</td>
                  <td><span className="mono">{m.batch_no}</span></td>
                  <td style={{
                    color: m.expiry_date < today ? 'var(--danger)' : 'inherit',
                    fontWeight: m.expiry_date < today ? 600 : 400,
                  }}>{m.expiry_date}</td>
                  <td style={{
                    fontWeight:600,
                    color: m.quantity===0 ? 'var(--danger)'
                         : m.quantity<=50  ? 'var(--warning)' : 'inherit',
                  }}>{m.quantity}</td>
                  <td>₹{Number(m.cost_price).toFixed(2)}</td>
                  <td style={{ fontWeight:600 }}>₹{Number(m.mrp).toFixed(2)}</td>
                  <td style={{ color:'var(--text-2)' }}>{m.supplier||'—'}</td>
                  <td><StatusChip status={m.status}/></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-icon btn-outline btn-sm" title="Edit"
                        onClick={() => { setEditing(m); setModal(true); }}>
                        <Edit2 size={12}/>
                      </button>
                      <button className="btn btn-icon btn-outline btn-sm"
                        title="Mark as Expired"
                        onClick={() => markStatus(m.id, 'Expired')}
                        style={{ color:'var(--warning)', fontSize:11 }}>E</button>
                      <button className="btn btn-icon btn-outline btn-sm" title="Delete"
                        disabled={delId===m.id}
                        onClick={() => del(m.id)}
                        style={{ color:'var(--danger)' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="pag">
            <span className="pag-info">
              Showing {Math.min((page-1)*PER+1, total)}–{Math.min(page*PER, total)} of {total} medicines
            </span>
            <div className="pag-btns">
              <button className="pg-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
              {Array.from({ length: Math.min(pages, 7) }, (_,i) => i+1).map(p => (
                <button key={p} className={'pg-btn'+(page===p?' active':'')}
                  onClick={() => setPage(p)}>{p}</button>
              ))}
              {pages > 7 && <span style={{ padding:'0 4px', color:'var(--text-3)' }}>…</span>}
              <button className="pg-btn" disabled={page>=pages} onClick={() => setPage(p=>p+1)}>›</button>
            </div>
          </div>
        )}
      </div>

      <MedicineModal open={modal}
        onClose={() => { setModal(false); setEditing(null); }}
        onSave={save} initial={editing}/>
    </div>
  );
}
