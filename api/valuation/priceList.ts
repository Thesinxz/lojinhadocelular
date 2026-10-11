/**
 * Lista fixa de preços: cada modelo do catálogo que a loja avalia, com todas as capacidades.
 * Cada linha (modelo + GB) pode ter um preço próprio em `customBasePrices`.
 */
import { IPHONE_CATALOG } from "../../src/lib/iphoneCatalog";
import {
  BASE_IPHONE_VALUES,
  POPULAR_CONFIG_IPHONES,
  getReferenceVariationKey,
  resolveDevicePrice,
  resolveIphoneModel,
} from "./engine";

import type { PriceListColor, PriceListModel, PriceListRow } from "@contracts/valuation";

export type { PriceListColor, PriceListModel, PriceListRow };

function evaluatedModelKeys(): Set<string> {
  const keys = new Set<string>();
  for (const m of POPULAR_CONFIG_IPHONES) keys.add(m.id);
  for (const k of Object.keys(BASE_IPHONE_VALUES)) keys.add(k);
  return keys;
}

/** Modelos avaliados × capacidades do catálogo, do mais novo ao mais antigo. */
export function buildPriceList(customBasePrices: Record<string, number> = {}): PriceListModel[] {
  const evaluated = evaluatedModelKeys();
  const seen = new Set<string>();
  const list: PriceListModel[] = [];
  for (const spec of IPHONE_CATALOG) {
    const key = resolveIphoneModel(spec.name)?.key;
    if (!key || !evaluated.has(key) || seen.has(key)) continue;
    seen.add(key);
    list.push({
      key,
      name: spec.name,
      year: spec.year,
      rows: spec.capacities.map((capacity) => {
        const rowKey = getReferenceVariationKey(spec.name, capacity);
        // Sugestão = o que o motor usaria sem o preço próprio desta linha.
        const { [rowKey]: _own, ...others } = customBasePrices;
        void _own;
        const resolved = resolveDevicePrice(spec.name, capacity, undefined, others);
        return {
          key: rowKey,
          capacity,
          suggested: resolved.base + resolved.storageBonus,
          suggestedSource: resolved.source,
          colors: spec.colors.map((color) => {
            const colorKey = getReferenceVariationKey(spec.name, capacity, color.name);
            const { [colorKey]: _ownColor, ...rest } = customBasePrices;
            void _ownColor;
            const r = resolveDevicePrice(spec.name, capacity, color.name, rest);
            return { name: color.name, hex: color.hex, key: colorKey, suggested: r.base + r.storageBonus };
          }),
        };
      }),
    });
  }
  return list;
}
