import { Directory, File, Paths } from 'expo-file-system';
import { ApiError } from '../../../api/apiError';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';
import { writeLocalJson } from '../../../api/localJson';
import type { CreateMaterialInput, LocalMaterialImage, MaterialDraft } from '../types';

const namespace = 'material-drafts-v1';
const draftIdPattern = /^draft-[A-Za-z0-9-]{1,100}$/;
const imageIdPattern = /^note-[A-Za-z0-9-]{1,100}$/;
type SavedImage = Omit<LocalMaterialImage, 'uri'>;
type SavedDraft = Omit<MaterialDraft, 'images'> & { version: 1; images: SavedImage[] };

export function emptyMaterialInput(): CreateMaterialInput {
  return { title: '', subject: '', content: '', images: [], isPublic: false };
}

function storageError(): ApiError {
  return new ApiError('임시 저장본을 읽거나 저장하지 못했어요. 기기 저장 공간을 확인하고 다시 시도해 주세요.', 'unknown', undefined, 'MATERIAL_DRAFT_STORAGE_ERROR');
}

function directory(owner: string): Directory {
  if (!owner || owner === '.' || owner === '..') throw storageError();
  assertAccountDataAccess(owner);
  return new Directory(Paths.document, namespace, encodeURIComponent(owner));
}

function imageDirectory(owner: string, id: string): Directory {
  if (!draftIdPattern.test(id)) throw storageError();
  return new Directory(directory(owner), id, 'images');
}

function imageFile(owner: string, draftId: string, imageId: string): File {
  if (!imageIdPattern.test(imageId)) throw storageError();
  return new File(imageDirectory(owner, draftId), `${imageId}.jpg`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validImage(value: unknown): value is SavedImage {
  return isRecord(value) && typeof value.id === 'string' && imageIdPattern.test(value.id) && value.fileName === `${value.id}.jpg` &&
    value.mimeType === 'image/jpeg' && Number.isInteger(value.width) && Number.isInteger(value.height) &&
    (value.width as number) > 0 && (value.height as number) > 0 && (value.width as number) <= 20000 && (value.height as number) <= 20000;
}

function readSavedDraft(owner: string): SavedDraft | null {
  const file = new File(directory(owner), 'draft.json');
  if (!file.exists) return null;
  const text = file.textSync();
  if (text.length > 160000) throw storageError();
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.version !== 1 || value.ownerId !== owner || typeof value.id !== 'string' || !draftIdPattern.test(value.id) ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      typeof value.title !== 'string' || value.title.length > 100 || typeof value.subject !== 'string' || value.subject.length > 50 ||
      typeof value.content !== 'string' || value.content.length > 30000 || typeof value.isPublic !== 'boolean' ||
      !Array.isArray(value.images) || value.images.length > 10 || !value.images.every(validImage) ||
      new Set(value.images.map((image) => image.id)).size !== value.images.length ||
      !['editing', 'pending', 'submitted'].includes(String(value.submission)) ||
      (value.materialId !== undefined && (typeof value.materialId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value.materialId))) ||
      (value.submission === 'submitted' && (typeof value.materialId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value.materialId)))) throw storageError();
  return value as unknown as SavedDraft;
}

function hydrate(owner: string, saved: SavedDraft): MaterialDraft {
  return { ...saved, requestKey: saved.id, images: saved.images.map((image) => ({ ...image, uri: imageFile(owner, saved.id, image.id).uri })) };
}

export function readMaterialDraft(owner: string): MaterialDraft | null {
  try { const saved = readSavedDraft(owner); return saved ? hydrate(owner, saved) : null; }
  catch (error) { if (error instanceof ApiError) throw error; throw storageError(); }
}

export function createMaterialDraft(owner: string): MaterialDraft {
  try {
    if (readSavedDraft(owner)) throw new ApiError('작성 중인 임시 저장본이 있어요. 먼저 이어서 작성해 주세요.', 'unknown');
    const saved: SavedDraft = { ...emptyMaterialInput(), version: 1, id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      ownerId: owner, revision: 1, updatedAt: new Date().toISOString(), images: [], submission: 'editing' };
    directory(owner).create({ intermediates: true, idempotent: true });
    writeLocalJson(new File(directory(owner), 'draft.json'), saved);
    return hydrate(owner, saved);
  } catch (error) { if (error instanceof ApiError) throw error; throw storageError(); }
}

export function hasMaterialDraftContent(draft: MaterialDraft): boolean {
  return Boolean(draft.title.trim() || draft.subject.trim() || draft.content.trim() || draft.images.length || draft.isPublic || draft.submission !== 'editing');
}

export function persistMaterialDraft(previous: MaterialDraft, input: CreateMaterialInput,
  submission = previous.submission, materialId = previous.materialId): MaterialDraft {
  try {
    const current = readSavedDraft(previous.ownerId);
    if (!current || current.id !== previous.id || current.revision !== previous.revision) {
      throw new ApiError('다른 화면에서 임시 저장본이 변경되었어요. 최신 임시 저장본을 다시 불러와 주세요.', 'unknown', undefined, 'MATERIAL_DRAFT_CONFLICT');
    }
    const images: SavedImage[] = input.images.map(({ uri, ...image }) => {
      if (!validImage(image) || uri !== imageFile(previous.ownerId, previous.id, image.id).uri) throw storageError();
      return image;
    });
    if (input.title.length > 100 || input.subject.length > 50 || input.content.length > 30000 || images.length > 10 ||
        new Set(images.map((image) => image.id)).size !== images.length) throw storageError();
    const next: SavedDraft = { version: 1, id: current.id, ownerId: current.ownerId, revision: current.revision + 1,
      title: input.title, subject: input.subject, content: input.content, isPublic: input.isPublic, images,
      updatedAt: new Date().toISOString(), submission, ...(materialId ? { materialId } : {}) };
    writeLocalJson(new File(directory(previous.ownerId), 'draft.json'), next);
    // Remove only files no longer referenced by the committed draft.
    try {
      const imageFolder = imageDirectory(previous.ownerId, previous.id);
      if (imageFolder.exists) for (const file of imageFolder.list()) {
        if (file instanceof File && !images.some((image) => `${image.id}.jpg` === file.name)) file.delete();
      }
    } catch { /* The manifest is already committed; final discard retries unused-image cleanup. */ }
    return hydrate(previous.ownerId, next);
  } catch (error) { if (error instanceof ApiError) throw error; throw storageError(); }
}

export function retainMaterialDraftImages(draft: MaterialDraft, images: LocalMaterialImage[]): LocalMaterialImage[] {
  const copied: File[] = [];
  try {
    const current = readSavedDraft(draft.ownerId);
    if (!current || current.id !== draft.id || current.revision !== draft.revision || current.submission !== 'editing') throw storageError();
    const target = imageDirectory(draft.ownerId, draft.id);
    target.create({ intermediates: true, idempotent: true });
    return images.map((image) => {
      if (!validImage(image)) throw storageError();
      const saved = imageFile(draft.ownerId, draft.id, image.id);
      if (saved.exists) throw storageError();
      copied.push(saved);
      new File(image.uri).copySync(saved);
      return { ...image, uri: saved.uri };
    });
  } catch (error) {
    for (const file of copied) { try { if (file.exists) file.delete(); } catch { /* Incomplete private copy. */ } }
    if (error instanceof ApiError) throw error;
    throw storageError();
  }
}

export function missingMaterialDraftImages(draft: MaterialDraft, images = draft.images): string[] {
  return images.filter((image) => { try { return !imageFile(draft.ownerId, draft.id, image.id).exists; } catch { return true; } }).map((image) => image.id);
}

export function discardMaterialDraft(owner: string, expectedId?: string): void {
  try {
    if (expectedId) {
      const current = readSavedDraft(owner);
      if (current && current.id !== expectedId) throw new ApiError('다른 임시 저장본이 열려 있어요. 다시 확인해 주세요.', 'unknown');
    }
    const folder = directory(owner);
    if (folder.exists) folder.delete();
  } catch (error) { if (error instanceof ApiError) throw error; throw storageError(); }
}
