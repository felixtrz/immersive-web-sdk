/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Recipe } from '@pmndrs/chef';
import type { VariantId } from './types.js';
import { VERSION } from './version.js';

export const DEFAULT_ASSETS_BASE =
  process.env.IWSDK_ASSET_BASE ||
  `https://cdn.jsdelivr.net/npm/@iwsdk/starter-assets@${VERSION}/dist`;

async function fetchJSON<T = unknown>(
  url: string,
  fallbackUrl?: string,
): Promise<T> {
  let res = await fetch(url);
  // Fallback to @latest if pinned version not found (e.g., jsDelivr indexing delay)
  if (!res.ok && res.status === 404 && fallbackUrl) {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchRecipesIndex(base = DEFAULT_ASSETS_BASE) {
  const url = new URL(
    'recipes/index.json',
    base.endsWith('/') ? base : base + '/',
  ).toString();
  // If using versioned base, create fallback to @latest
  const fallbackUrl =
    base === DEFAULT_ASSETS_BASE
      ? url.replace(`@${VERSION}/`, '@latest/')
      : undefined;
  return fetchJSON<{ id: VariantId; name: string; recipe: string }[]>(
    url,
    fallbackUrl,
  );
}

export async function fetchRecipe(id: VariantId, base = DEFAULT_ASSETS_BASE) {
  const url = new URL(
    `recipes/${id}.recipe.json`,
    base.endsWith('/') ? base : base + '/',
  ).toString();
  // If using versioned base, create fallback to @latest
  const fallbackUrl =
    base === DEFAULT_ASSETS_BASE
      ? url.replace(`@${VERSION}/`, '@latest/')
      : undefined;
  return fetchJSON<Recipe>(url, fallbackUrl);
}

export async function fetchRecipeByFileName(
  fileName: string,
  base = DEFAULT_ASSETS_BASE,
) {
  const url = new URL(
    `recipes/${fileName}`,
    base.endsWith('/') ? base : base + '/',
  ).toString();
  // If using versioned base, create fallback to @latest
  const fallbackUrl =
    base === DEFAULT_ASSETS_BASE
      ? url.replace(`@${VERSION}/`, '@latest/')
      : undefined;
  return fetchJSON<Recipe>(url, fallbackUrl);
}
