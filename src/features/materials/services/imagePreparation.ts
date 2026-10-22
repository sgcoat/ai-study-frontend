import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';

import type { LocalMaterialImage } from '../types';

export const MAX_MATERIAL_IMAGES = 10;
export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_JPEG_QUALITY = 0.72;

async function prepareImage(asset: ImagePicker.ImagePickerAsset, ownerId: string): Promise<LocalMaterialImage> {
  assertAccountDataAccess(ownerId);
  const context = ImageManipulator.manipulate(asset.uri);
  let temporary: File | null = null;
  try {
    if (Math.max(asset.width, asset.height) > IMAGE_MAX_EDGE) {
      context.resize(asset.width >= asset.height
        ? { width: IMAGE_MAX_EDGE }
        : { height: IMAGE_MAX_EDGE });
    }
    const rendered = await context.renderAsync();
    try {
      const image = await rendered.saveAsync({
        compress: IMAGE_JPEG_QUALITY,
        format: SaveFormat.JPEG,
      });
      temporary = new File(image.uri);
      assertAccountDataAccess(ownerId);
      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const directory = new Directory(Paths.cache, 'material-images-v1', encodeURIComponent(ownerId));
      directory.create({ intermediates: true, idempotent: true });
      const saved = new File(directory, `${id}.jpg`);
      temporary.moveSync(saved);
      temporary = null;
      return {
        id,
        uri: saved.uri,
        fileName: `${id}.jpg`,
        mimeType: 'image/jpeg',
        width: image.width,
        height: image.height,
      };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
    try { if (temporary?.exists) temporary.delete(); } catch { /* Cache cleanup can be retried by the OS. */ }
    // Only app-cache copies from the picker are removed. Photo-library originals stay with the user.
    if (asset.uri.startsWith(Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`)) {
      try { const source = new File(asset.uri); if (source.exists) source.delete(); } catch { /* Temporary picker cache. */ }
    }
  }
}

async function prepareImages(assets: ImagePicker.ImagePickerAsset[], ownerId: string) {
  const prepared: LocalMaterialImage[] = [];
  // Process sequentially so multiple full-resolution photos do not exhaust memory.
  for (const asset of assets) prepared.push(await prepareImage(asset, ownerId));
  return prepared;
}

export async function selectMaterialImages(remainingCount: number, ownerId: string): Promise<LocalMaterialImage[]> {
  if (remainingCount <= 0) throw new Error(`이미지는 최대 ${MAX_MATERIAL_IMAGES}장까지 첨부할 수 있습니다.`);
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('사진 접근 권한이 필요합니다. 기기 설정에서 사진 접근을 허용해 주세요.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remainingCount,
    orderedSelection: true,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled) return [];
  return prepareImages(result.assets.slice(0, remainingCount), ownerId);
}

export async function captureMaterialImage(ownerId: string): Promise<LocalMaterialImage[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('카메라 접근 권한이 필요합니다. 기기 설정에서 카메라 접근을 허용해 주세요.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.back,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled) return [];
  return prepareImages(result.assets.slice(0, 1), ownerId);
}
