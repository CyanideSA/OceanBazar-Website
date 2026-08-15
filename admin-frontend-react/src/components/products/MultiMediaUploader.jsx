import { useRef, useState } from "react";
import { FiUpload, FiTrash2, FiFilm, FiImage } from "react-icons/fi";
import { adminApi } from "../../lib/api";
import { useToast } from "../ToastProvider";
import { normalizeProductImageUrl } from "../../utils/mediaUrl";

const PREVIEW_MODES = { image: "image", video: "video", banner: "banner" };

export default function MultiMediaUploader({
  assets,
  onChange,
  accept = "image/*",
  folder = "products",
  maxCount = 20,
  preview = "image",
  hint = "",
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const dragIdx = useRef(null);

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    const remaining = maxCount - assets.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxCount} files allowed`);
      return;
    }
    const batch = Array.from(files).slice(0, remaining);
    setUploading(true);
    const next = [...assets];
    for (const file of batch) {
      try {
        const r = await adminApi.uploadMedia(file, folder);
        const url = r.secureUrl || r.url;
        if (!url) throw new Error("Upload returned no URL");
        next.push({
          url,
          publicId: r.publicId,
          resourceType: r.resourceType || (file.type?.startsWith("video/") ? "video" : "image"),
          assetType: file.type?.startsWith("video/") ? "video" : "image",
          _localName: file.name,
        });
        // #region agent log
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'media-e2e',hypothesisId:'H1-H4',location:'MultiMediaUploader.jsx:upload',message:'media upload ok',data:{folder,name:file.name,mime:file.type,size:file.size,resourceType:r.resourceType,url:String(url).slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (err) {
        const detail = err?.response?.data?.error || err?.message || "Upload failed";
        toast.error(`Failed to upload ${file.name}`, detail);
        // #region agent log
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'media-e2e',hypothesisId:'H1-H4',location:'MultiMediaUploader.jsx:upload',message:'media upload failed',data:{folder,name:file.name,mime:file.type,size:file.size,detail:String(detail)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
    }
    onChange(next);
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const remove = (idx) => onChange(assets.filter((_, i) => i !== idx));

  const onDragStart = (idx) => { dragIdx.current = idx; };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const next = [...assets];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    onChange(next);
  };

  const isVideo = preview === PREVIEW_MODES.video;
  const isBanner = preview === PREVIEW_MODES.banner;
  const Icon = isVideo ? FiFilm : FiImage;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-crm-border-strong rounded-xl p-6 text-center cursor-pointer hover:border-crm-primary hover:bg-crm-primary/5 transition-all group"
      >
        <Icon size={28} className="mx-auto mb-2 text-crm-text-muted group-hover:text-crm-primary" />
        <p className="text-sm font-semibold text-crm-text">
          {isVideo ? "Drop videos here or click to select" :
           isBanner ? "Drop banner images here or click to select" :
           "Drop files here or click to select"}
        </p>
        <p className="text-xs text-crm-text-muted mt-1">
          {hint || (isVideo ? "MP4, MOV, WEBM supported" : isBanner ? "Recommended: 1200x400px" : "Supports JPG, PNG, WEBP")}
          {` · Max ${maxCount}`}
        </p>
        {uploading && <p className="text-xs text-crm-primary mt-2 animate-pulse">Uploading...</p>}
        <input ref={fileRef} type="file" multiple accept={accept} className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {assets.length > 0 && (
        <div className={isBanner ? "space-y-2" : "grid grid-cols-4 gap-3"}>
          {assets.map((asset, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              className={`relative group rounded-xl overflow-hidden border-2 border-crm-border-strong hover:border-crm-border-strong cursor-grab transition-all ${
                isBanner ? "flex items-center gap-3 p-2 bg-crm-bg-alt" : ""
              }`}
            >
              {isVideo ? (
                <div className="w-full aspect-square bg-crm-bg-alt flex flex-col items-center justify-center gap-1">
                  <FiFilm size={24} className="text-crm-purple" />
                  <p className="text-[10px] text-crm-text-dim truncate px-2 w-full text-center">
                    {asset._localName || "Video"}
                  </p>
                </div>
              ) : isBanner ? (
                <>
                  <img
                    src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                    alt="" className="w-24 h-14 object-cover rounded bg-crm-bg-hover flex-shrink-0"
                    onError={(e) => { e.target.style.background = "var(--crm-bg-hover)"; }}
                  />
                  <p className="text-xs text-crm-text truncate flex-1">{asset._localName || "Banner"}</p>
                </>
              ) : (
                <img
                  src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                  alt="" className="w-full aspect-square object-cover bg-crm-bg-alt"
                  onError={(e) => { e.target.style.background = "var(--crm-bg-hover)"; }}
                />
              )}
              <div className={`${isBanner ? "flex-shrink-0" : "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"}`}>
                <button type="button" onClick={() => remove(idx)}
                  className={`text-xs ${isBanner ? "text-crm-danger hover:text-crm-danger-hover p-1" : "bg-crm-danger text-white px-2 py-1 rounded font-semibold hover:bg-crm-danger-hover"}`}>
                  {isBanner ? <FiTrash2 size={14} /> : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
