import React, { useCallback, useEffect, useState } from "react";
import {
  FiCheckCircle, FiXCircle, FiRefreshCw, FiUpload, FiCalendar,
  FiUsers, FiShoppingBag, FiLink, FiMessageCircle,
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";

function StatusPill({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-crm-border bg-crm-bg-alt text-crm-text-dim"}`}>
      {ok ? <FiCheckCircle /> : <FiXCircle />}
      <span>{label}</span>
    </div>
  );
}

export default function IntegrationsPage() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarForm, setCalendarForm] = useState({
    subject: "",
    body: "",
    start: "",
    end: "",
    attendees: "",
    mailbox: "",
  });
  const [driveFile, setDriveFile] = useState(null);
  const [driveFolder, setDriveFolder] = useState("OceanBazar/Exports");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await adminApi.integrationsStatus();
      setStatus(s);
      if (s?.graphMail) {
        const dir = await adminApi.microsoftDirectory().catch(() => ({ users: [] }));
        setDirectory(dir.users || []);
      }
    } catch {
      toast.error("Failed to load integration status");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const syncMerchant = async () => {
    setLoading(true);
    try {
      const r = await adminApi.googleMerchantSync();
      toast.success(`Merchant Center: synced ${r.synced}/${r.total} products`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Merchant sync failed");
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    try {
      const r = await adminApi.microsoftCalendarCreate({
        ...calendarForm,
        attendees: calendarForm.attendees ? calendarForm.attendees.split(",").map((s) => s.trim()) : [],
      });
      if (r.ok) toast.success("Calendar event created");
      else toast.error(r.error || "Failed to create event");
    } catch {
      toast.error("Calendar create failed");
    }
  };

  const uploadDrive = async () => {
    if (!driveFile) { toast.error("Choose a file first"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || "").split(",")[1];
      try {
        const r = await adminApi.microsoftDriveUpload({
          fileName: driveFile.name,
          contentBase64: base64,
          folderPath: driveFolder,
        });
        if (r.ok) toast.success("Uploaded to OneDrive");
        else toast.error(r.error || "Upload failed");
      } catch {
        toast.error("Drive upload failed");
      }
    };
    reader.readAsDataURL(driveFile);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright flex items-center gap-2">
            <FiLink className="text-crm-primary" /> Integrations Hub
          </h2>
          <p className="text-sm text-crm-text-dim mt-1">Microsoft 365, Meta, Google, and WhatsApp connection status</p>
        </div>
        <button type="button" className="crm-btn crm-btn-secondary h-10" onClick={load} disabled={loading}>
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {status && (
        <div className="crm-card p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatusPill ok={status.microsoftSso} label="Microsoft 365 SSO" />
          <StatusPill ok={status.googleSso} label="Google Workspace SSO" />
          <StatusPill ok={status.graphMail} label="M365 Graph Mail" />
          <StatusPill ok={status.meta} label="Meta Business Suite" />
          <StatusPill ok={status.whatsapp} label="WhatsApp Cloud API" />
          <StatusPill ok={status.googleInsights} label="GA4 + Search Console" />
          <StatusPill ok={status.googleMerchant} label="Google Merchant Center" />
          <StatusPill ok={status.recaptcha} label="reCAPTCHA (server verify)" />
          <StatusPill ok={status.teamsWebhook} label="Teams webhook alerts" />
        </div>
      )}

      {status?.whatsappTemplates && (
        <div className="crm-card p-5 space-y-2">
          <h3 className="font-bold text-crm-text-bright flex items-center gap-2"><FiMessageCircle /> WhatsApp templates</h3>
          <p className="text-sm text-crm-text-dim">Order: <code>{status.whatsappTemplates.order || "not set"}</code></p>
          <p className="text-sm text-crm-text-dim">Shipping: <code>{status.whatsappTemplates.shipping || "not set"}</code></p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="crm-card p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><FiShoppingBag /> Google Merchant Center</h3>
          <p className="text-sm text-crm-text-dim">Sync active in-stock products to Google Shopping feed.</p>
          <button type="button" className="crm-btn crm-btn-primary" disabled={!status?.googleMerchant || loading} onClick={syncMerchant}>
            Sync catalog to Merchant Center
          </button>
        </div>

        <div className="crm-card p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><FiUsers /> M365 directory</h3>
          <p className="text-sm text-crm-text-dim">{directory.length ? `${directory.length} org users loaded` : "Requires Graph User.Read.All"}</p>
          <div className="max-h-40 overflow-y-auto text-xs space-y-1">
            {directory.slice(0, 15).map((u) => (
              <div key={u.id} className="flex justify-between border-b border-crm-border/50 py-1">
                <span>{u.displayName}</span>
                <span className="text-crm-text-muted">{u.mail || u.userPrincipalName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="crm-card p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><FiCalendar /> M365 calendar</h3>
          <input className="crm-input" placeholder="Subject" value={calendarForm.subject} onChange={(e) => setCalendarForm((f) => ({ ...f, subject: e.target.value }))} />
          <textarea className="crm-input" rows={2} placeholder="Body" value={calendarForm.body} onChange={(e) => setCalendarForm((f) => ({ ...f, body: e.target.value }))} />
          <input className="crm-input" type="datetime-local" value={calendarForm.start} onChange={(e) => setCalendarForm((f) => ({ ...f, start: e.target.value }))} />
          <input className="crm-input" type="datetime-local" value={calendarForm.end} onChange={(e) => setCalendarForm((f) => ({ ...f, end: e.target.value }))} />
          <input className="crm-input" placeholder="Attendees (comma-separated emails)" value={calendarForm.attendees} onChange={(e) => setCalendarForm((f) => ({ ...f, attendees: e.target.value }))} />
          <button type="button" className="crm-btn crm-btn-primary" disabled={!status?.graphMail} onClick={createEvent}>Create event</button>
        </div>

        <div className="crm-card p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><FiUpload /> OneDrive upload</h3>
          <input className="crm-input" placeholder="Folder path" value={driveFolder} onChange={(e) => setDriveFolder(e.target.value)} />
          <input type="file" className="crm-input text-sm" onChange={(e) => setDriveFile(e.target.files?.[0] || null)} />
          <button type="button" className="crm-btn crm-btn-primary" disabled={!status?.graphMail || !driveFile} onClick={uploadDrive}>Upload file</button>
        </div>
      </div>
    </div>
  );
}
