import { ApiError } from './apiError';

const deletedOwners = new Set<string>();
export function blockAccountData(ownerId: string): void { deletedOwners.add(ownerId); }
export function allowAccountData(ownerId: string): void { deletedOwners.delete(ownerId); }
export function assertAccountDataAccess(ownerId: string): void {
  if (deletedOwners.has(ownerId)) throw new ApiError('삭제된 계정의 학습 데이터를 저장할 수 없습니다.', 'unauthorized', 401, 'ACCOUNT_DELETED');
}
