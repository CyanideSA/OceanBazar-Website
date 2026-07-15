import React, { useCallback, useEffect, useState } from "react";
import { FiZap, FiPlus, FiSend, FiUsers, FiTrash2, FiCpu, FiRefreshCw, FiX } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";

const STATUS_STYLES = {
  draft: "bg-crm-bg-hover text-crm-text-dim",
  active: "bg-crm-success-dim text-crm-success",
  paused: "bg-crm-warning-dim text-crm-warning",
  completed: "bg-crm-primary-dim text-crm-primary",
  archived: "bg-crm-bg-hover text-crm-text-dim",
};

const AUDIENCE_TYPES = [
  { value: "all", label: "All customers" },
  { value: "segment", label: "By segment" },
  { value: "churn_risk", label: "At-risk (churn)" },
  { value: "high_value", label: "High value (LTV)" },
];

const emptyForm = () => ({
  name: "",
  description: "",
  audience: { type: "all", segments: [], minChurnScore: 0.6, minLtv: 0 },
  steps: [{ subject: "", body: "", delayHours: 0 }],
});

export default function AiMarketingPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [segments, setSegments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([adminApi.campaigns(), adminApi.intelSegments()]);
      setCampaigns(c?.campaigns || []);
      setSegments((s?.segments || []).map((x) => x.segment));
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const refreshPreview = async (audience) => {
    try {
      setPreview(await adminApi.campaignAudiencePreview(audience));
    } catch { setPreview(null); }
  };

  const generateCopy = async () => {
    if (!genTopic.trim()) { toast.error("Enter a topic to generate"); return; }
    setGenerating(true);
    try {
      const r = await adminApi.marketingGenerate({ kind: "email", topic: genTopic.trim(), audience: form.audience.type });
      setForm((f) => {
        const steps = [...f.steps];
        steps[0] = { ...steps[0], subject: r.subject || steps[0].subject, body: r.body || steps[0].body };
        return { ...f, steps };
      });
      toast.success(r.source === "heuristic" ? "Generated (heuristic fallback)" : "AI copy generated");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const addStep = () => setForm((f) => ({ ...f, steps: [...f.steps, { subject: "", body: "", delayHours: 24 }] }));
  const removeStep = (i) => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  const updateStep = (i, patch) => setForm((f) => {
    const steps = [...f.steps];
    steps[i] = { ...steps[i], ...patch };
    return { ...f, steps };
  });

  const save = async () => {
    if (!form.name.trim()) { toast.error("Campaign name required"); return; }
    setSaving(true);
    try {
      await adminApi.createCampaign({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        audience: form.audience,
        triggerType: "manual",
        steps: form.steps.map((s) => ({ subject: s.subject, body: s.body, delayHours: Number(s.delayHours) || 0 })),
      });
      toast.success("Campaign created");
      setShowCreate(false);
      setForm(emptyForm());
      setPreview(null);
      load();
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  const enroll = async (id) => {
    try {
      const r = await adminApi.campaignEnroll(id);
      toast.success(`Enrolled ${r.enrolled} of ${r.audienceSize} customers`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Enrollment failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this campaign?")) return;
    try { await adminApi.deleteCampaign(id); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiZap size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">AI Marketing</h2>
            <p className="text-crm-text-dim text-sm">AI-generated campaigns, audience builder &amp; email automation journeys</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="crm-btn crm-btn-primary flex items-center gap-2"><FiPlus size={16} /> New campaign</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="crm-card flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-crm-text-bright">{c.name}</h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status] || ""}`}>{c.status}</span>
              </div>
              {c.description && <p className="text-sm text-crm-text-dim mt-1 line-clamp-2">{c.description}</p>}
              <div className="flex gap-4 text-xs text-crm-text-dim mt-3">
                <span>{c._count?.steps ?? 0} steps</span>
                <span>{c._count?.enrollments ?? 0} enrolled</span>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-crm-border">
                <button onClick={() => enroll(c.id)} disabled={c.status === "completed"} className="crm-btn text-xs flex items-center gap-1 flex-1 justify-center"><FiSend size={12} /> Enroll &amp; run</button>
                <button onClick={() => remove(c.id)} className="crm-btn text-xs text-crm-danger"><FiTrash2 size={14} /></button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="crm-card col-span-full text-center py-12 text-crm-text-dim">
              No campaigns yet. Create your first AI-powered campaign.
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg bg-crm-bg h-full overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-crm-text-bright">New Campaign</h3>
              <button onClick={() => setShowCreate(false)} className="text-crm-text-dim hover:text-crm-text-bright"><FiX size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-crm-text-dim uppercase font-bold">Campaign name</label>
                <input className="crm-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-crm-text-dim uppercase font-bold">Description</label>
                <textarea className="crm-input w-full" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="crm-card bg-crm-bg-alt">
                <label className="text-xs text-crm-text-dim uppercase font-bold flex items-center gap-1"><FiUsers size={12} /> Audience</label>
                <div className="flex gap-2 mt-2">
                  <select className="crm-input flex-1" value={form.audience.type}
                    onChange={(e) => { const audience = { ...form.audience, type: e.target.value }; setForm({ ...form, audience }); refreshPreview(audience); }}>
                    {AUDIENCE_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <button type="button" onClick={() => refreshPreview(form.audience)} className="crm-btn text-xs"><FiRefreshCw size={14} /></button>
                </div>
                {form.audience.type === "segment" && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {segments.map((seg) => {
                      const active = form.audience.segments?.includes(seg);
                      return (
                        <button key={seg} type="button"
                          onClick={() => {
                            const set = new Set(form.audience.segments || []);
                            active ? set.delete(seg) : set.add(seg);
                            const audience = { ...form.audience, segments: [...set] };
                            setForm({ ...form, audience }); refreshPreview(audience);
                          }}
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${active ? "bg-crm-primary text-white" : "bg-crm-bg-hover text-crm-text-dim"}`}>
                          {seg}
                        </button>
                      );
                    })}
                    {segments.length === 0 && <span className="text-xs text-crm-text-dim">No segments computed yet</span>}
                  </div>
                )}
                {preview && <p className="text-xs text-crm-primary mt-2">≈ {preview.estimatedSize} customers match</p>}
              </div>

              <div className="crm-card bg-crm-bg-alt">
                <label className="text-xs text-crm-text-dim uppercase font-bold flex items-center gap-1"><FiCpu size={12} /> AI copy generator</label>
                <div className="flex gap-2 mt-2">
                  <input className="crm-input flex-1" placeholder="Topic e.g. Eid sale 20% off" value={genTopic} onChange={(e) => setGenTopic(e.target.value)} />
                  <button type="button" onClick={generateCopy} disabled={generating} className="crm-btn crm-btn-primary text-xs flex items-center gap-1">
                    {generating ? <FiRefreshCw size={14} className="animate-spin" /> : <FiZap size={14} />} Generate
                  </button>
                </div>
                <p className="text-[11px] text-crm-text-dim mt-1">Fills the first step. Use {"{{name}}"} for personalization.</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-crm-text-dim uppercase font-bold">Journey steps</label>
                  <button type="button" onClick={addStep} className="text-crm-primary text-xs flex items-center gap-1"><FiPlus size={12} /> Add step</button>
                </div>
                <div className="space-y-3 mt-2">
                  {form.steps.map((s, i) => (
                    <div key={i} className="crm-card bg-crm-bg-alt space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-crm-text-bright">Step {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" className="crm-input w-20 h-7 text-xs" value={s.delayHours}
                            onChange={(e) => updateStep(i, { delayHours: e.target.value })} title="Delay hours" />
                          <span className="text-[10px] text-crm-text-dim">h delay</span>
                          {form.steps.length > 1 && <button type="button" onClick={() => removeStep(i)} className="text-crm-danger"><FiTrash2 size={13} /></button>}
                        </div>
                      </div>
                      <input className="crm-input w-full text-sm" placeholder="Subject" value={s.subject} onChange={(e) => updateStep(i, { subject: e.target.value })} />
                      <textarea className="crm-input w-full text-sm" rows={4} placeholder="Email body" value={s.body} onChange={(e) => updateStep(i, { body: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary flex-1">{saving ? "Saving…" : "Create campaign"}</button>
                <button onClick={() => setShowCreate(false)} className="crm-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
