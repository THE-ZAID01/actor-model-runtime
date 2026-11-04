import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

async function findEjsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...(await findEjsFiles(path.join(directory, entry.name))));
      }
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

for (const file of await findEjsFiles('.')) {
  const source = await readFile(file, 'utf8');
  let tokenPrefix = '__EJS_FORMAT_TOKEN_';

  while (source.includes(tokenPrefix)) {
    tokenPrefix = `_${tokenPrefix}`;
  }

  const tags = [];
  const masked = source.replace(/<%[\s\S]*?%>/g, (tag) => {
    const token = `${tokenPrefix}${tags.length}__`;
    tags.push(tag);
    return token;
  });
  const config = (await prettier.resolveConfig(file)) || {};
  const formatted = await prettier.format(masked, {
    ...config,
    parser: 'html',
  });
  const restored = formatted.replace(
    new RegExp(`${tokenPrefix}(\\d+)__`, 'g'),
    (_token, index) => tags[Number(index)],
  );

  await writeFile(file, restored);
  console.log(`${file} formatted`);
}
