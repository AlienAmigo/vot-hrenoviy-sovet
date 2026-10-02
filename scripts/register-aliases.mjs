/**
 * Резолвер tsconfig-алиасов для Node: читает compilerOptions.paths из tsconfig.json
 * и подставляет их при разрешении импортов. Нужен, потому что Node (type stripping)
 * не умеет tsconfig-paths, а правило проекта — все импорты через алиасы.
 *
 * Подключается флагом: node --import ./scripts/register-aliases.mjs <script>
 * Включается только в check:api (см. package.json); Metro и tsc алиасы знают сами.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

/** Читает paths из tsconfig.json (tsconfig допускает комментарии и хвостовые запятые). */
const loadPaths = () => {
  const raw = readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf8');
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    const noComments = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    config = JSON.parse(noComments.replace(/,\s*([}\]])/g, '$1'));
  }
  return config.compilerOptions?.paths ?? {};
};

/** Разбивает paths на точные совпадения и шаблоны с `*`. */
const exact = new Map();
const wildcards = [];
for (const [key, targets] of Object.entries(loadPaths())) {
  if (!Array.isArray(targets)) {
    continue;
  }
  const star = key.indexOf('*');
  if (star === -1) {
    exact.set(key, targets);
  } else {
    wildcards.push({
      prefix: key.slice(0, star),
      suffix: key.slice(star + 1),
      targets,
    });
  }
}
// Длинный префикс важнее: `@api/*` не должен перехватывать то, что точнее ложится на `@/*`.
wildcards.sort((a, b) => b.prefix.length - a.prefix.length);

/** Подставляет `*` в цели шаблона; null — шаблон не совпал. */
const substitute = (specifier, { prefix, suffix, targets }) => {
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return null;
  }
  const star = specifier.slice(prefix.length, specifier.length - suffix.length);
  return targets.map((target) => target.replace('*', star));
};

/** Ищет файл по цели алиаса: сам файл, затем с расширениями, затем index.*. */
const probe = (target) => {
  const base = path.resolve(projectRoot, target);
  const candidates = path.extname(base)
    ? [base]
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
      ];
  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    let targets = exact.get(specifier) ?? null;
    if (targets === null) {
      for (const wildcard of wildcards) {
        const matched = substitute(specifier, wildcard);
        if (matched !== null) {
          targets = matched;
          break;
        }
      }
    }
    if (targets === null) {
      return nextResolve(specifier, context);
    }

    for (const target of targets) {
      const file = probe(target);
      if (file !== null) {
        return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    // Файла под алиасом нет — отдаём обычному резолверу (вдруг это npm-пакет,
    // например @types/*), но с подсказкой в случае неудачи.
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error instanceof Error) {
        error.message += `\n(алиас ${specifier} → ${targets.join(', ')} не разрешился)`;
      }
      throw error;
    }
  },
});
