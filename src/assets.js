const defaultAssetBase = 'https://hakuya.top/after-the-rabbit-hole';
const remoteBase = (import.meta.env.VITE_ASSET_BASE_URL || defaultAssetBase).replace(/\/$/, '');

export function assetUrl(path) {
  return `${remoteBase}/${path}`;
}
