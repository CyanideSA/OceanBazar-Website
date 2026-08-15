import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmtafp1fi',
  api_key:    process.env.CLOUDINARY_API_KEY    || '973898168493724',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'H4Ny1VLhzvb1dwEG2u_yKIWs2_M',
});

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  duration?: number; // for videos
}

// ─── Core upload helper ───────────────────────────────────────────────────────

export async function uploadMedia(
  buffer: Buffer,
  folder: string,
  options: {
    publicId?: string;
    transformation?: object;
    resourceType?: 'image' | 'video' | 'auto';
    allowedFormats?: string[];
  } = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = options.resourceType || 'auto';
    // quality/fetch_format are image-only — applying them to videos breaks Cloudinary uploads
    const params: Record<string, unknown> = {
      folder: `oceanbazar/${folder}`,
      public_id: options.publicId,
      resource_type: resourceType,
      overwrite: true,
    };
    if (options.transformation) params.transformation = options.transformation;
    if (options.allowedFormats) params.allowed_formats = options.allowedFormats;
    if (resourceType === 'image') {
      params.quality = 'auto';
      params.fetch_format = 'auto';
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      params,
      (error, result) => {
        if (error) return reject(error);
        const r = result as UploadApiResponse;
        resolve({
          url: r.url,
          secureUrl: r.secure_url,
          publicId: r.public_id,
          resourceType: r.resource_type,
          width: r.width,
          height: r.height,
          format: r.format,
          bytes: r.bytes,
          duration: (r as any).duration,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/** @deprecated Use uploadMedia instead */
export async function uploadImage(buffer: Buffer, folder: string, options: { publicId?: string; transformation?: object } = {}): Promise<UploadResult> {
  return uploadMedia(buffer, folder, { ...options, resourceType: 'image' });
}

// ─── Specific upload helpers ──────────────────────────────────────────────────

export async function uploadProductImage(buffer: Buffer, productId: string, index: number): Promise<UploadResult> {
  return uploadMedia(buffer, 'products', {
    publicId: `${productId}-${index}`,
    resourceType: 'image',
    transformation: { quality: 'auto', fetch_format: 'auto' },
  });
}

export async function uploadReviewMedia(buffer: Buffer, reviewId: string, index: number): Promise<UploadResult> {
  // Supports both images and short videos (≤ 30s)
  return uploadMedia(buffer, 'reviews', {
    publicId: `${reviewId}-${index}`,
    resourceType: 'auto',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm'],
    transformation: { quality: 'auto' },
  });
}

export async function uploadLogo(buffer: Buffer, type: 'dark' | 'light' | 'favicon'): Promise<UploadResult> {
  return uploadMedia(buffer, 'logos', {
    publicId: `logo-${type}`,
    resourceType: 'image',
    transformation: { quality: 'auto', fetch_format: 'auto' },
  });
}

export async function uploadProfilePhoto(buffer: Buffer, userId: string): Promise<UploadResult> {
  return uploadMedia(buffer, 'profiles', {
    publicId: `user-${userId}`,
    resourceType: 'image',
    transformation: { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' },
  });
}

export async function deleteImage(publicId: string, resourceType: 'image' | 'video' = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

