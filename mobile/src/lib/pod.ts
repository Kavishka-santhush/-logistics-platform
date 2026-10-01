import * as ImagePicker from 'expo-image-picker';
import { api } from './api';
import type { OrderDetail, UploadResult } from '@/types';

/**
 * Proof-of-delivery flow: capture photos -> multipart upload to
 * POST /uploads/pod -> record on the order via POST /orders/:id/pod.
 */

export interface PodInput {
  capturedName?: string;
  latitude?: number;
  longitude?: number;
  codCollected?: number;
  scannedBarcodes?: string[];
  signatureUrl?: string;
  metadata?: Record<string, any>;
}

/** Ask permission and pick (or shoot) up to `count` delivery photos. */
export async function pickPodPhotos(count = 4): Promise<ImagePicker.ImagePickerAsset[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is required to capture proof of delivery.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: count,
    quality: 0.7,
    exif: true,
  });
  if (result.canceled) return [];
  return result.assets;
}

function toUploadFile(asset: ImagePicker.ImagePickerAsset) {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  return {
    uri: asset.uri,
    name: `pod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    type: mimeType,
  };
}

/** Upload the photos then attach them to the order as a POD record. */
export async function captureAndRecordPod(
  orderId: string,
  assets: ImagePicker.ImagePickerAsset[],
  input: PodInput = {},
): Promise<{ photoUrls: string[]; pod: unknown }> {
  if (!assets.length) throw new Error('No photos selected.');

  const uploaded = await api.uploadFile<UploadResult | UploadResult[]>('pod', assets.map(toUploadFile));
  const list = Array.isArray(uploaded) ? uploaded : [uploaded];
  const photoUrls = list.map((u) => u.url);

  const pod = await api.post(`/orders/${orderId}/pod`, {
    photoUrls,
    signatureUrl: input.signatureUrl,
    capturedName: input.capturedName,
    latitude: input.latitude,
    longitude: input.longitude,
    codCollected: input.codCollected,
    scannedBarcodes: input.scannedBarcodes,
    metadata: input.metadata,
  });
  return { photoUrls, pod };
}

/** Deliver = record POD (optional) then flip the status; failure reason for FAILED. */
export async function completeDelivery(
  order: OrderDetail,
  assets: ImagePicker.ImagePickerAsset[],
  input: PodInput & { status: 'DELIVERED' | 'FAILED' },
): Promise<void> {
  if (input.status === 'DELIVERED' && assets.length) {
    await captureAndRecordPod(order.id, assets, input);
  }
  await api.post(`/orders/${order.id}/status`, {
    status: input.status,
    payload:
      input.status === 'FAILED'
        ? { failedReason: input.metadata?.failedReason ?? 'OTHER', failedNote: input.metadata?.failedNote }
        : undefined,
    note: input.metadata?.note,
  });
}
