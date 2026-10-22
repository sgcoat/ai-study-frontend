import { Directory, File, Paths } from 'expo-file-system';
import { assertAccountDataAccess } from './accountDataAccess';

/** Public development/session data only. Authentication tokens remain in SecureStore. */
export function scopedDirectory(namespace: string, ...identifiers: string[]): Directory {
  if (identifiers[0]) assertAccountDataAccess(identifiers[0]);
  const directory = new Directory(Paths.document, namespace, ...identifiers.map(encodeURIComponent));
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export function readLocalJson(file: File): unknown {
  return file.exists ? JSON.parse(file.textSync()) : null;
}

export function writeLocalJson(file: File, value: unknown): void {
  const temporary = new File(file.parentDirectory, `${file.name}.next.tmp`);
  temporary.write(JSON.stringify(value));
  temporary.moveSync(file, { overwrite: true });
}
