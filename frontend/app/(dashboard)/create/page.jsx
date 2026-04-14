'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { vmService } from '../../../lib/vmService';
import { ToastContainer, toast } from '../../../components/Toast';

const DEFAULTS = { name: '', cpu: 2, ram: 2, disk: 20, templateId: '', instances: 1 };

export default function CreateVMPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULTS);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    vmService.templates()
      .then(res => setTemplates(res.data))
      .catch(() => toast('Failed to load templates', 'error'))
      .finally(() => setTemplatesLoading(false));
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.templateId) e.templateId = 'Select a template';
    if (form.cpu < 1 || form.cpu > 64) e.cpu = '1–64 cores';
    if (form.ram < 1 || form.ram > 512) e.ram = '1–512 GB';
    if (form.instances < 1 || form.instances > 100) e.instances = '1–100 instances';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const res = await vmService.create({
        ...form,
        cpu: parseInt(form.cpu),
        ram: parseInt(form.ram),
        disk: parseInt(form.disk),
        templateId: parseInt(form.templateId),
        instances: parseInt(form.instances),
      });
      const count = parseInt(form.instances);
      const msg = count > 1
        ? `${count} VMs created successfully`
        : `VM "${res.data.name}" created (VMID: ${res.data.vmid})`;
      toast(msg, 'success');
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to create VM', 'error');
    } finally {
      setLoading(false);
    }
  }

  const selectedTemplate = templates.find(t => t.vmid == form.templateId);

  return (
    <div className="max-w-lg">
      <ToastContainer />
      <h1 className="text-xl font-bold mb-6">Create VM</h1>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label">VM Name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-server-01" />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="label">Template</label>
          {templatesLoading ? <p className="text-gray-500 text-sm">Loading templates...</p> : (
            <select className="input" value={form.templateId} onChange={e => set('templateId', e.target.value)}>
              <option value="">Select a template</option>
              {templates.map(t => (
                <option key={t.vmid} value={t.vmid}>
                  {t.name} (VMID: {t.vmid}) [{t.type === 'lxc' ? 'CT' : 'VM'}]
                </option>
              ))}
            </select>
          )}
          {errors.templateId && <p className="text-red-400 text-xs mt-1">{errors.templateId}</p>}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">CPU (cores)</label>
            <input className="input" type="number" min={1} max={64} value={form.cpu} onChange={e => set('cpu', e.target.value)} />
            {errors.cpu && <p className="text-red-400 text-xs mt-1">{errors.cpu}</p>}
          </div>
          <div>
            <label className="label">RAM (GB)</label>
            <input className="input" type="number" min={1} max={512} value={form.ram} onChange={e => set('ram', e.target.value)} />
            {errors.ram && <p className="text-red-400 text-xs mt-1">{errors.ram}</p>}
          </div>
          <div>
            <label className="label">Disk (GB)</label>
            <input className="input" type="number" min={1} max={10000} value={form.disk} onChange={e => set('disk', e.target.value)} />
            {errors.disk && <p className="text-red-400 text-xs mt-1">{errors.disk}</p>}
          </div>
        </div>
        <div>
          <label className="label">Number of Instances</label>
          <input className="input" type="number" min={1} max={100} value={form.instances} onChange={e => set('instances', e.target.value)} />
          {errors.instances && <p className="text-red-400 text-xs mt-1">{errors.instances}</p>}
          {form.instances > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              Will create: {form.name ? `${form.name}-1` : 'name-1'} ... {form.name ? `${form.name}-${form.instances}` : `name-${form.instances}`}
            </p>
          )}
        </div>
        {selectedTemplate && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400 space-y-1">
            <p>Template: <span className="text-gray-200">{selectedTemplate.name}</span></p>
            <p>Resources: <span className="text-gray-200">{form.cpu} vCPU · {form.ram} GB RAM · {form.disk} GB Disk</span></p>
            <p>Instances: <span className="text-gray-200">{form.instances}</span></p>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create VM'}</button>
          <button type="button" className="btn-ghost" onClick={() => router.push('/')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
