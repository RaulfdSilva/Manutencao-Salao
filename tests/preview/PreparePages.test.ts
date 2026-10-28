// TypeScript/Vite map this ESM extension to the .mts source; the workflow uses Node 24 directly.
import { preparePages } from '../../scripts/prepare-pages.mjs';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';

describe('real static page artifact preparation', () => {
  it('preserves the exported HTML while creating directory indexes, a 404 and nojekyll; can run twice', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'preview-export-'));
    try {
      mkdirSync(path.join(root, 'maintenance'), { recursive: true });
      writeFileSync(
        path.join(root, 'index.html'),
        '<html>Home from Expo</html>',
      );
      writeFileSync(
        path.join(root, 'maintenance.html'),
        '<html>Actual list from Expo</html>',
      );
      writeFileSync(
        path.join(root, 'maintenance', 'demo-monthly.html'),
        '<html>Actual dynamic page from Expo</html>',
      );
      writeFileSync(
        path.join(root, '+not-found.html'),
        '<html>Actual not found from Expo</html>',
      );
      await preparePages(root);
      expect(
        readFileSync(path.join(root, 'maintenance/index.html'), 'utf8'),
      ).toBe('<html>Actual list from Expo</html>');
      expect(
        readFileSync(
          path.join(root, 'maintenance/demo-monthly/index.html'),
          'utf8',
        ),
      ).toBe('<html>Actual dynamic page from Expo</html>');
      expect(readFileSync(path.join(root, 'index.html'), 'utf8')).toBe(
        '<html>Home from Expo</html>',
      );
      expect(readFileSync(path.join(root, '404.html'), 'utf8')).toBe(
        '<html>Actual not found from Expo</html>',
      );
      expect(existsSync(path.join(root, '.nojekyll'))).toBe(true);
      expect(existsSync(path.join(root, 'maintenance.html'))).toBe(false);
      await preparePages(root);
      expect(readFileSync(path.join(root, '404.html'), 'utf8')).toBe(
        '<html>Actual not found from Expo</html>',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('refuses missing home and environment files instead of uploading an unsafe artifact', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'preview-invalid-'));
    try {
      await expect(preparePages(root)).rejects.toThrow(
        'Exportação sem página inicial',
      );
      writeFileSync(path.join(root, 'index.html'), '<html>Home</html>');
      writeFileSync(
        path.join(root, '.env'),
        'SYNTHETIC_TEST_VALUE=not-a-secret',
      );
      await expect(preparePages(root)).rejects.toThrow('Arquivo de ambiente');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('rejects conflicting actual pages rather than replacing a directory index', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'preview-conflict-'));
    try {
      mkdirSync(path.join(root, 'team'));
      writeFileSync(path.join(root, 'index.html'), '<html>Home</html>');
      writeFileSync(path.join(root, 'team.html'), '<html>List</html>');
      writeFileSync(
        path.join(root, 'team/index.html'),
        '<html>Conflicting list</html>',
      );
      await expect(preparePages(root)).rejects.toThrow(
        'Conflito entre páginas',
      );
      expect(readFileSync(path.join(root, 'team/index.html'), 'utf8')).toBe(
        '<html>Conflicting list</html>',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
