import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, AlertTriangle, Package,
  TrendingUp, ShoppingBag, Plus, Search, X, RefreshCw, WifiOff
} from 'lucide-react';
import { api } from '../api';

/* ── helpers ── */
const INR = n => n == null ? '—'
  : n >= 100000 ? '₹' + (n / 100000).toFixed(2) + 'L'
  : '₹' + Number(n).toLocaleString('en-IN');

function StatusChip({ s }) {
  const map = { Completed: 'completed', Pending: 'pending' };
  return <span className={'chip chip-' + (map[s] || 'pending')}>{s}</span>;
}

function StatCard({ icon, bg, col, badge, badgeCls, val, lbl, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon" style={{ background: bg, color: col }}>{icon}</div>
        {badge && <span className={'stat-badge ' + badgeCls}>{badge}</span>}
      </div>
      <div className="stat-val">{loading ? <span className="skel" /> : val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}

export default function Dashboard({ toast }) {
  const nav = useNavigate();
  const [tab, setTab]         = useState('sales');
  const [kpi, setKpi]         = useState(null);
  const [sales, setSales]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Sale form
  const [patient,  setPatient]  = useState('');
  const [mq,       setMq]       = useState('');
  const [results,  setResults]  = useState([]);
  const [items,    setItems]    = useState([]);
  const [billing,  setBilling]  = useState(false);
  const [showDrop, setShowDrop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setOffline(false);
    try {
      const [k, r] = await Promise.all([api.getDashboard(), api.getRecentSales()]);
      setKpi(k.data.data);
      setSales(r.data.data.sales);
    } catch {
      setOffline(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* medicine search with debounce */
  useEffect(() => {
    if (!mq.trim()) { setResults([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.getMedicines({ search: mq, per_page: 8 });
        setResults(r.data.data.filter(m => m.status !== 'Expired' && m.quantity > 0));
        setShowDrop(true);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [mq]);

  const addItem = m => {
    setItems(p => {
      const ex = p.find(i => i.id === m.id);
      if (ex) return p.map(i => i.id === m.id
        ? { ...i, qty: Math.min(i.qty + 1, i.quantity) } : i);
      return [...p, { ...m, qty: 1 }];
    });
    setMq(''); setResults([]); setShowDrop(false);
  };

  const updQty = (id, d) => setItems(p =>
    p.map(i => i.id === id
      ? { ...i, qty: Math.max(1, Math.min(i.quantity, i.qty + d)) } : i));

  const totalBill = items.reduce((s, i) => s + i.mrp * i.qty, 0);

  const bill = async () => {
    if (!patient.trim()) { toast.error('Enter patient name'); return; }
    if (!items.length)   { toast.error('Add at least one medicine'); return; }
    setBilling(true);
    try {
      const r = await api.createSale({
        patient_name: patient, payment_mode: 'Cash',
        items: items.map(i => ({ medicine_id: i.id, quantity: i.qty })),
      });
      toast.success(r.data.data.invoice_no + ' — ₹' + r.data.data.total_amount);
      setPatient(''); setItems([]); load();
    } catch (e) { toast.error(e.message); }
    finally { setBilling(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className="ph">
        <div>
          <h1 className="ph-title">Pharmacy CRM</h1>
          <p className="ph-sub">Manage inventory, sales, and purchase orders</p>
        </div>
        <div className="ph-acts">
          <button className="btn btn-outline" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-outline">↑ Export</button>
          <button className="btn btn-primary" onClick={() => nav('/inventory')}>
            <Plus size={14} /> Add Medicine
          </button>
        </div>
      </div>

      {offline && (
        <div className="err-banner">
          <WifiOff size={15} />
          <span>
            Backend offline. Run: <code>uvicorn main:app --reload --port 8000</code>
            &nbsp;then set <code>REACT_APP_API_URL</code> for production.
          </span>
          <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats">
        <StatCard loading={loading}
          icon={<DollarSign size={20} />} bg="#DCFCE7" col="#16A34A"
          badge={'+' + (kpi?.today_sales?.growth || 0) + '%'} badgeCls="bg-success"
          val={INR(kpi?.today_sales?.amount)} lbl="Today's Sales" />
        <StatCard loading={loading}
          icon={<ShoppingCart size={20} />} bg="#EFF6FF" col="#2563EB"
          badge={(kpi?.today_sales?.orders_count || 0) + ' Orders'} badgeCls="bg-info"
          val={kpi?.items_sold_today ?? 0} lbl="Items Sold Today" />
        <StatCard loading={loading}
          icon={<AlertTriangle size={20} />} bg="#FFF7ED" col="#EA580C"
          badge="Action Needed" badgeCls="bg-orange"
          val={kpi?.low_stock_items ?? 0} lbl="Low Stock Items" />
        <StatCard loading={loading}
          icon={<Package size={20} />} bg="#F5F3FF" col="#7C3AED"
          badge={(kpi?.purchase_orders?.pending_count || 0) + ' Pending'} badgeCls="bg-purple"
          val={INR(kpi?.purchase_orders?.total_amount)} lbl="Purchase Orders" />
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { k:'sales',     icon:<TrendingUp size={14}/>,  l:'Sales'     },
          { k:'purchase',  icon:<ShoppingBag size={14}/>, l:'Purchase'  },
          { k:'inventory', icon:<Package size={14}/>,     l:'Inventory' },
        ].map(t => (
          <button key={t.k} className={'tab-btn'+(tab===t.k?' active':'')}
            onClick={() => setTab(t.k)}>{t.icon} {t.l}</button>
        ))}
        <div className="tab-acts">
          <button className="btn btn-primary btn-sm" onClick={() => setTab('sales')}>
            <Plus size={12}/> New Sale
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => nav('/inventory')}>
            <Plus size={12}/> New Purchase
          </button>
        </div>
      </div>

      {/* ── Sales Tab ── */}
      {tab === 'sales' && (
        <>
          {/* Make a Sale */}
          <div className="sale-card">
            <div className="sale-hd">Make a Sale</div>
            <div className="sale-sub">Select medicines from inventory</div>

            <div className="sale-row">
              <input className="inp" placeholder="Patient Name / ID"
                value={patient} onChange={e => setPatient(e.target.value)}
                style={{ width: 200 }} />

              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{
                  position:'absolute', left:10, top:'50%',
                  transform:'translateY(-50%)', color:'var(--text-3)',
                  zIndex:1, pointerEvents:'none'
                }} />
                <input className="inp" style={{ paddingLeft:34, width:'100%' }}
                  placeholder="Search medicines..."
                  value={mq}
                  onChange={e => setMq(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDrop(false), 180)} />
                {showDrop && results.length > 0 && (
                  <div className="sdrop">
                    {results.map(m => (
                      <div key={m.id} className="sdrop-item" onMouseDown={() => addItem(m)}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{m.medicine_name}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>
                            {m.batch_no} · Stock: {m.quantity}
                          </div>
                        </div>
                        <span style={{ fontWeight:600 }}>₹{m.mrp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="btn btn-primary btn-sm"
                onClick={() => mq.trim() && setShowDrop(true)}>Enter</button>
              <button className="btn btn-danger btn-sm"
                onClick={bill} disabled={billing || !items.length}>
                {billing ? 'Processing…' : 'Bill'}
              </button>
            </div>

            {/* Cart table */}
            {items.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>MEDICINE NAME</th><th>GENERIC NAME</th><th>BATCH NO</th>
                        <th>EXPIRY DATE</th><th>QUANTITY</th><th>MRP / PRICE</th>
                        <th>SUPPLIER</th><th>STATUS</th><th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it.id}>
                          <td style={{ fontWeight:600 }}>{it.medicine_name}</td>
                          <td style={{ color:'var(--text-2)' }}>{it.generic_name||'—'}</td>
                          <td><span className="mono">{it.batch_no}</span></td>
                          <td>{it.expiry_date}</td>
                          <td>
                            <div className="qty-row">
                              <button className="qty-btn" onClick={() => updQty(it.id,-1)}>−</button>
                              <span style={{ minWidth:24, textAlign:'center', fontWeight:600 }}>{it.qty}</span>
                              <button className="qty-btn" onClick={() => updQty(it.id, 1)}>+</button>
                            </div>
                          </td>
                          <td style={{ fontWeight:600 }}>₹{(it.mrp*it.qty).toFixed(2)}</td>
                          <td style={{ color:'var(--text-2)' }}>{it.supplier||'—'}</td>
                          <td><span className="chip chip-active">Active</span></td>
                          <td>
                            <button className="btn btn-icon btn-outline btn-sm"
                              onClick={() => setItems(p => p.filter(i => i.id !== it.id))}
                              style={{ color:'var(--danger)' }}>
                              <X size={12}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bill-total">
                  <span style={{ color:'var(--text-2)', fontSize:13 }}>Total Amount:</span>
                  <span style={{ fontSize:20, fontWeight:700, color:'var(--primary)' }}>
                    ₹{totalBill.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="card">
            <div className="card-hd">
              <h3 className="card-title">Recent Sales</h3>
              <button className="btn btn-outline btn-sm">View All</button>
            </div>
            {loading ? (
              <div className="loading"><div className="spin"/> Loading sales…</div>
            ) : offline ? (
              <div className="empty">
                <WifiOff size={28} style={{ opacity:.3 }}/>
                <span>Start the backend to see sales data.</span>
              </div>
            ) : sales.length === 0 ? (
              <div className="empty">
                <ShoppingCart size={28} style={{ opacity:.3 }}/>
                <span>No sales yet — create your first sale above.</span>
              </div>
            ) : (
              <div className="sales-list">
                {sales.map(s => (
                  <div key={s.id} className="sale-row-item">
                    <div className="sale-ico"><ShoppingCart size={16}/></div>
                    <div className="sale-info">
                      <div className="sale-inv">{s.invoice_no}</div>
                      <div className="sale-meta">
                        {s.patient_name} · {s.item_count} items · {s.payment_mode}
                      </div>
                    </div>
                    <div className="sale-right">
                      <div className="sale-amt">₹{Number(s.total_amount).toLocaleString('en-IN')}</div>
                      <div className="sale-dt">{s.created_at?.slice(0,10)}</div>
                    </div>
                    <StatusChip s={s.status}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'purchase' && <PurchaseOrders toast={toast}/>}

      {tab === 'inventory' && (
        <div className="card">
          <div className="card-hd">
            <h3 className="card-title">Quick Inventory</h3>
            <button className="btn btn-primary btn-sm" onClick={() => nav('/inventory')}>
              Open Full Inventory →
            </button>
          </div>
          <div className="empty" style={{ height:120 }}>
            <Package size={28} style={{ opacity:.3 }}/>
            <span>Use the Inventory page for full stock management.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Purchase Orders sub-section ── */
function PurchaseOrders({ toast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPurchaseOrders()
      .then(r => setOrders(r.data.data.purchase_orders))
      .catch(() => toast.error('Could not load purchase orders'))
      .finally(() => setLoading(false));
  }, [toast]);

  const map = { Pending:'pending', Approved:'approved', Delivered:'delivered' };

  return (
    <div className="card">
      <div className="card-hd">
        <h3 className="card-title">Purchase Orders</h3>
        <button className="btn btn-primary btn-sm"><Plus size={12}/> New Order</button>
      </div>
      {loading ? (
        <div className="loading"><div className="spin"/> Loading…</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>PO NUMBER</th><th>SUPPLIER</th>
                <th>TOTAL AMOUNT</th><th>STATUS</th><th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.po_number}</td>
                  <td>{o.supplier}</td>
                  <td style={{ fontWeight:600 }}>₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
                  <td><span className={'chip chip-'+(map[o.status]||'pending')}>{o.status}</span></td>
                  <td style={{ color:'var(--text-2)' }}>{o.created_at?.slice(0,10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
