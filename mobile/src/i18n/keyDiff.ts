type JsonTree = { [key: string]: string | JsonTree };

/** Plural suffixes are language specific, so they are compared by base key. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

export function flattenKeys(tree: JsonTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path.replace(PLURAL_SUFFIX, '')] : flattenKeys(value, path);
  });
}

export type KeyDiff = { missing: string[]; extra: string[] };

/** Keys present in the reference but absent from the candidate, and the reverse. */
export function diffKeys(reference: JsonTree, candidate: JsonTree): KeyDiff {
  const referenceKeys = new Set(flattenKeys(reference));
  const candidateKeys = new Set(flattenKeys(candidate));
  return {
    missing: [...referenceKeys].filter((key) => !candidateKeys.has(key)).sort(),
    extra: [...candidateKeys].filter((key) => !referenceKeys.has(key)).sort(),
  };
}
