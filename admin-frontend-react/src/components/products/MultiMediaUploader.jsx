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
        next.push({
          url: r.secureUrl || r.url,
          publicId: r.publicId,
          resourceType: r.resourceType || (file.type?.startsWith("video/") ? "video" : "image"),
          _localName: file.name,
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
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
  const colorClass = isVideo ? "purple" : "blue";

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-${colorClass}-500 hover:bg-${colorClass}-500/5 transition-all group`}
      >
        <Icon size={28} className={`mx-auto mb-2 text-gray-500 group-hover:text-${colorClass}-400`} />
        <p className="text-sm font-semibold text-gray-300">
          {isVideo ? "Drop videos here or click to select" :
           isBanner ? "Drop banner images here or click to select" :
           "Drop files here or click to select"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {hint || (isVideo ? "MP4, MOV, WEBM supported" : isBanner ? "Recommended: 1200x400px" : "Supports JPG, PNG, WEBP")}
          {` · Max ${maxCount}`}
        </p>
        {uploading && <p className={`text-xs text-${colorClass}-400 mt-2 animate-pulse`}>Uploading...</p>}
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
              className={`relative group rounded-xl overflow-hidden border-2 border-gray-600 hover:border-gray-400 cursor-grab transition-all ${
                isBanner ? "flex items-center gap-3 p-2 bg-gray-800" : ""
              }`}
            >
              {isVideo ? (
                <div className="w-full aspect-square bg-gray-800 flex flex-col items-center justify-center gap-1">
                  <FiFilm size={24} className="text-purple-400" />
                  <p className="text-[10px] text-gray-400 truncate px-2 w-full text-center">
                    {asset._localName || "Video"}
                  </p>
                </div>
              ) : isBanner ? (
                <>
                  <img
                    src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                    alt="" className="w-24 h-14 object-cover rounded bg-gray-700 flex-shrink-0"
                    onError={(e) => { e.target.style.background = "#374151"; }}
                  />
                  <p className="text-xs text-gray-300 truncate flex-1">{asset._localName || "Banner"}</p>
                </>
              ) : (
                <img
                  src={normalizeProductImageUrl ? normalizeProductImageUrl(asset.url) : asset.url}
                  alt="" className="w-full aspect-square object-cover bg-gray-800"
                  onError={(e) => { e.target.style.background = "#374151"; }}
                />
              )}
              <div className={`${isBanner ? "flex-shrink-0" : "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"}`}>
                <button type="button" onClick={() => remove(idx)}
                  className={`text-xs ${isBanner ? "text-red-400 hover:text-red-300 p-1" : "bg-red-600 text-white px-2 py-1 rounded font-semibold hover:bg-red-700"}`}>
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
