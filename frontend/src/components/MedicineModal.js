import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CATS = [
  'Analgesic','Antibiotic','Anticoagulant','Antidiabetic',
  'Antihistamine','Antihypertensive','Cardiovascular',
  'Gastric','Vitamins','Dermatology','Neurology','Other',
];

const EMPTY = {
  medicine_name:'', generic_name:'', category:'', batch_no:'',
  expiry_date:'', quantity:'', cost_price:'', mrp:'', supplier:'',
};

export default function MedicineModal({ open, onClose, onSave, initial }) {
  const [f, setF] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(initial ? {
      medicine_name: initial.medicine_name || '',
      generic_name:  initial.generic_name  || '',
      category:      initial.category      || '',
      batch_no:      initial.batch_no      || '',
      expiry_date:   initial.expiry_date   || '',
      quantity:      initial.quantity      ?? '',
      cost_price:    initial.cost_price    || '',
      mrp:           initial.mrp           || '',
      supplier:      initial.supplier      || '',
    } : EMPTY);
    setErrs({});
  }, [initial, open]);

  if (!open) return null;

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.medicine_name.trim()) e.medicine_name = 'Required';
    if (!f.batch_no.trim())      e.batch_no      = 'Required';
    if (!f.expiry_date)          e.expiry_date   = 'Required';
    if (f.quantity === '' || isNaN(+f.quantity) || +f.quantity < 0) e.quantity   = 'Must be ≥ 0';
    if (!f.cost_price || isNaN(+f.cost_price) || +f.cost_price <= 0) e.cost_price = 'Must be > 0';
    if (!f.mrp || isNaN(+f.mrp) || +f.mrp <= 0)                      e.mrp        = 'Must be > 0';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave({ ...f, quantity: +f.quantity, cost_price: +f.cost_price, mrp: +f.mrp });
    setSaving(false);
  };

  const Field = ({ name, label, type = 'text', placeholder, disabled }) => (
    <div className="fg-item">
      <label className="fg-lbl">{label}</label>
      <input className="inp" type={type} placeholder={placeholder}
        value={f[name]} disabled={disabled}
        onChange={e => set(name, e.target.value)}
        style={errs[name] ? { borderColor: 'var(--danger)' } : {}} />
      {errs[name] && <span className="fg-err">{errs[name]}</span>}
    </div>
  );

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h3 className="modal-title">{initial ? 'Edit Medicine' : 'Add New Medicine'}</h3>
          <button className="btn btn-icon btn-outline" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="modal-body">
          <div className="fg">
            <Field name="medicine_name" label="Medicine Name *"  placeholder="e.g. Paracetamol 500mg" />
            <Field name="generic_name"  label="Generic Name"     placeholder="e.g. Acetaminophen" />

            <div className="fg-item">
              <label className="fg-lbl">Category</label>
              <select className="fg-sel" value={f.category}
                onChange={e => set('category', e.target.value)}>
                <option value="">Select category</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <Field name="batch_no"     label="Batch No *"       placeholder="e.g. PCM-2024-0001"
              disabled={!!initial} />
            <Field name="expiry_date"  label="Expiry Date *"    type="date" />
            <Field name="quantity"     label="Quantity *"       type="number" placeholder="0" />
            <Field name="cost_price"   label="Cost Price (₹) *" type="number" placeholder="0.00" />
            <Field name="mrp"          label="MRP (₹) *"        type="number" placeholder="0.00" />

            <div className="fg-item fc">
              <label className="fg-lbl">Supplier</label>
              <input className="inp" placeholder="Supplier name"
                value={f.supplier} onChange={e => set('supplier', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="modal-ft">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update Medicine' : 'Add Medicine'}
          </button>
        </div>
      </div>
    </div>
  );
}
