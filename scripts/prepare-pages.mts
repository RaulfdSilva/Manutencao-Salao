import { readdir, rename, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function htmlFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(
        'Links simbólicos não são permitidos no artefato público',
      );
    if (entry.name.startsWith('.env'))
      throw new Error(
        'Arquivo de ambiente não é permitido no artefato público',
      );
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(filename)));
    else if (entry.name.endsWith('.html')) files.push(filename);
  }
  return files;
}

/** Preserve actual Expo-generated pages; add directory indexes for a static host, not an SPA fallback. */
export async function preparePages(directory: string): Promise<void> {
  const root = path.resolve(directory);
  const files = await htmlFiles(root);
  if (!files.includes(path.join(root, 'index.html')))
    throw new Error('Exportação sem página inicial');
  for (const filename of files) {
    const relative = path.relative(root, filename);
    if (relative === '+not-found.html') {
      await copyFile(filename, path.join(root, '404.html'));
    }
    if (path.basename(filename) === 'index.html' || relative === '404.html')
      continue;
    const destination = path.join(
      path.dirname(filename),
      path.basename(filename, '.html'),
      'index.html',
    );
    if (files.includes(destination))
      throw new Error('Conflito entre páginas estáticas exportadas');
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(filename, destination);
  }
  await writeFile(path.join(root, '.nojekyll'), '');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await preparePages(process.argv[2] ?? 'dist');
}
