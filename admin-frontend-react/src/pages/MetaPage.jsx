import React, { useCallback, useEffect, useState } from "react";
import { FiFacebook, FiInstagram, FiRefreshCw, FiSend, FiPlus } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";

export default function MetaPage() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [connect, setConnect] = useState({ pageId: "", igId: "", pageAccessToken: "", adAccountId: "", catalogId: "", wabaId: "", waPhoneNumberId: "" });
  const [posts, setPosts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [newPost, setNewPost] = useState({ postType: "image", caption: "", mediaUrls: "", scheduledAt: "" });
  const [newCampaign, setNewCampaign] = useState({ name: "", objective: "OUTCOME_TRAFFIC", budget: "" });
  const [loading, setLoading] = useState(false);
  const [waTemplates, setWaTemplates] = useState({ order: null, shipping: null });

  const load = useCallback(async () => {
    try {
      const [s, p, c, integ] = await Promise.all([
        adminApi.metaStatus(),
        adminApi.metaPosts(),
        adminApi.metaCampaigns(),
        adminApi.integrationsStatus().catch(() => null),
      ]);
      setStatus(s);
      setPosts(p?.posts || []);
      setCampaigns(c?.campaigns || []);
      if (integ?.whatsappTemplates) setWaTemplates(integ.whatsappTemplates);
    } catch {
      toast.error("Failed to load Meta status");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("meta_connected") === "1") {
      toast.success("Meta account connected via OAuth");
      window.history.replaceState({}, "", window.location.pathname);
      load();
    }
    const oauthErr = params.get("meta_oauth_error");
    if (oauthErr) {
      toast.error(`Meta OAuth failed: ${decodeURIComponent(oauthErr)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const onMessage = (ev) => {
      if (ev?.data?.type === "meta_oauth_success") {
        toast.success(`Meta connected — Page ${ev.data.pageId}`);
        load();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load, toast]);

  const saveConnect = async () => {
    setLoading(true);
    try {
      await adminApi.metaConnect(connect);
      toast.success("Meta account connected");
      load();
    } catch {
      toast.error("Connect failed");
    } finally {
      setLoading(false);
    }
  };

  const syncCatalog = async () => {
    setLoading(true);
    try {
      const r = await adminApi.metaCatalogSync();
      toast.success(`Synced ${r.synced}/${r.total} products`);
    } catch {
      toast.error("Catalog sync failed");
    } finally {
      setLoading(false);
    }
  };

  const schedulePost = async () => {
    try {
      await adminApi.metaCreatePost({
        postType: newPost.postType,
        caption: newPost.caption,
        mediaUrls: newPost.mediaUrls ? newPost.mediaUrls.split(",").map((s) => s.trim()) : [],
        scheduledAt: newPost.scheduledAt || null,
      });
      toast.success("Post scheduled");
      setNewPost({ postType: "image", caption: "", mediaUrls: "", scheduledAt: "" });
      load();
    } catch {
      toast.error("Failed to schedule post");
    }
  };

  const createCampaign = async () => {
    try {
      await adminApi.metaCreateCampaign(newCampaign);
      toast.success("Campaign created");
      load();
    } catch {
      toast.error("Campaign creation failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiFacebook size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright">Meta Business Suite</h2>
          <p className="text-crm-text-dim text-sm">Facebook + Instagram messaging, catalog sync, posts & ads</p>
        </div>
      </div>

      <div className="crm-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-crm-text-bright">Connect account</h3>
          <button
            type="button"
            className="crm-btn crm-btn-secondary text-xs h-9"
            onClick={async () => {
              try {
                const { url } = await adminApi.metaOAuthUrl();
                if (url) window.open(url, "meta_oauth", "width=600,height=700");
                else toast.error("Meta OAuth not configured");
              } catch {
                toast.error("Could not start Meta OAuth");
              }
            }}
          >
            Connect via Facebook Login
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {["pageId", "igId", "pageAccessToken", "adAccountId", "catalogId", "wabaId", "waPhoneNumberId"].map((k) => (
            <input key={k} className="crm-input" placeholder={k} value={connect[k]} onChange={(e) => setConnect((c) => ({ ...c, [k]: e.target.value }))} />
          ))}
        </div>
        <button className="crm-btn-primary" disabled={loading} onClick={saveConnect}>Save connection</button>
        {status?.configured && <p className="text-xs text-emerald-600">Graph API configured · WhatsApp via Meta Cloud API</p>}
      </div>

      {(waTemplates.order || waTemplates.shipping) && (
        <div className="crm-card space-y-2 p-4">
          <h3 className="font-bold text-crm-text-bright">WhatsApp message templates</h3>
          <p className="text-xs text-crm-text-dim">Order confirm: <code>{waTemplates.order || "—"}</code></p>
          <p className="text-xs text-crm-text-dim">Shipping update: <code>{waTemplates.shipping || "—"}</code></p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="crm-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Catalog sync</h3>
            <button className="crm-btn-ghost" onClick={syncCatalog}><FiRefreshCw /> Sync</button>
          </div>
          <p className="text-sm text-crm-text-dim">Push active products to Commerce Manager catalog.</p>
        </div>

        <div className="crm-card space-y-3">
          <h3 className="font-bold">Schedule post / reel / story</h3>
          <select className="crm-input" value={newPost.postType} onChange={(e) => setNewPost((p) => ({ ...p, postType: e.target.value }))}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
          </select>
          <textarea className="crm-input" rows={2} placeholder="Caption" value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
          <input className="crm-input" placeholder="Media URLs (comma-separated)" value={newPost.mediaUrls} onChange={(e) => setNewPost((p) => ({ ...p, mediaUrls: e.target.value }))} />
          <input className="crm-input" type="datetime-local" value={newPost.scheduledAt} onChange={(e) => setNewPost((p) => ({ ...p, scheduledAt: e.target.value }))} />
          <button className="crm-btn-primary" onClick={schedulePost}><FiSend className="inline" /> Schedule</button>
        </div>
      </div>

      <div className="crm-card space-y-3">
        <h3 className="font-bold">Ads Manager scaffold</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="crm-input" placeholder="Campaign name" value={newCampaign.name} onChange={(e) => setNewCampaign((c) => ({ ...c, name: e.target.value }))} />
          <input className="crm-input" placeholder="Objective" value={newCampaign.objective} onChange={(e) => setNewCampaign((c) => ({ ...c, objective: e.target.value }))} />
          <input className="crm-input" placeholder="Budget (BDT)" value={newCampaign.budget} onChange={(e) => setNewCampaign((c) => ({ ...c, budget: e.target.value }))} />
        </div>
        <button className="crm-btn-primary" onClick={createCampaign}><FiPlus className="inline" /> Create campaign</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="crm-card">
          <h3 className="font-bold mb-2">Scheduled posts</h3>
          <ul className="space-y-2 text-sm">
            {posts.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-crm-border pb-1">
                <span>{p.post_type} · {p.status}</span>
                <button className="text-crm-primary text-xs" onClick={() => adminApi.metaPublishPost(p.id).then(() => { toast.success("Published"); load(); })}>Publish</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="crm-card">
          <h3 className="font-bold mb-2">Ad campaigns</h3>
          <ul className="space-y-2 text-sm">
            {campaigns.map((c) => (
              <li key={c.id} className="border-b border-crm-border pb-1">{c.name} · {c.status}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
