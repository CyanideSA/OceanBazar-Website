import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmtafp1fi',
  api_key: process.env.CLOUDINARY_API_KEY || '487252925521551',
  api_secret: process.env.CLOUDINARY_API_SECRET || '_rHB9A85bxjgZqzcNZb0ja9vBk8',
});

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export async function uploadImage(
  buffer: Buffer,
  folder: string,
  options: { publicId?: string; transformation?: object } = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `oceanbazar/${folder}`,
        public_id: options.publicId,
        resource_type: 'image',
        transformation: options.transformation,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        const r = result as UploadApiResponse;
        resolve({
          url: r.url,
          secureUrl: r.secure_url,
          publicId: r.public_id,
          width: r.width,
          height: r.height,
          format: r.format,
          bytes: r.bytes,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

export async function uploadLogo(
  buffer: Buffer,
  type: 'dark' | 'light' | 'favicon'
): Promise<UploadResult> {
  return uploadImage(buffer, 'logos', {
    publicId: `logo-${type}`,
    transformation: { quality: 'auto', fetch_format: 'auto' },
  });
}

export async function deleteImage(publicId: string): Promise<{ result: string }> {
  return cloudinary.uploader.destroy(publicId);
}

export async function uploadProfilePhoto(
  buffer: Buffer,
  userId: string
): Promise<UploadResult> {
  return uploadImage(buffer, 'profiles', {
    publicId: `user-${userId}`,
    transformation: { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' },
  });
}

export { cloudinary };
