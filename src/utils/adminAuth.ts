// Token JWT do Firebase mantido exclusivamente em memória (nunca em localStorage/sessionStorage)
let memoryToken: string | null = null;

export function getAdminToken(): string | null {
  return memoryToken;
}

export function setAdminToken(token: string | null): void {
  memoryToken = token;
}

export function clearAdminToken(): void {
  memoryToken = null;
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  let token = memoryToken;
  try {
    const { auth } = await import('../lib/firebase');
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
      memoryToken = token;
    }
  } catch {
    // Mantém token atual em memória caso a atualização falhe
  }

  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}

function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

async function parseUploadResponse(res: Response): Promise<string> {
  const rawText = await res.text();
  let data: { url?: string; error?: string } = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = {};
  }
  if (!res.ok || !data.url) {
    throw new Error(
      data.error ||
        (res.status === 413
          ? 'Arquivo muito grande para envio. Reduza a imagem para até 8 MB.'
          : `Falha ao enviar arquivo (HTTP ${res.status}).`)
    );
  }
  return data.url;
}

export interface UploadAdminImageOptions {
  convertWebpToPng?: boolean;
  maxDimension?: number;
}

async function maybeNormalizeImageFile(
  file: File,
  options?: UploadAdminImageOptions
): Promise<File> {
  if (!options?.convertWebpToPng) return file;
  const isWebp =
    file.type.toLowerCase() === 'image/webp' ||
    file.name.toLowerCase().endsWith('.webp');
  if (!isWebp || typeof document === 'undefined') return file;

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Falha ao decodificar WebP'));
        image.src = objectUrl;
      });
      const maxDim = options.maxDimension || 512;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const width = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, width, height);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      );
      if (!pngBlob) return file;
      const baseName = file.name.replace(/\.webp$/i, '') || 'imagem';
      if (pngBlob.size <= 2 * 1024 * 1024) {
        return new File([pngBlob], `${baseName}.png`, { type: 'image/png' });
      }

      // Se o PNG ficar muito grande (>2 MB), gera JPEG de alta qualidade com fundo branco
      const jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = width;
      jpgCanvas.height = height;
      const jpgCtx = jpgCanvas.getContext('2d');
      if (!jpgCtx) return file;
      jpgCtx.fillStyle = '#ffffff';
      jpgCtx.fillRect(0, 0, width, height);
      jpgCtx.drawImage(img, 0, 0, width, height);
      const jpgBlob = await new Promise<Blob | null>((resolve) =>
        jpgCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
      );
      if (!jpgBlob) return file;
      return new File([jpgBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

export async function uploadAdminImageFile(
  rawFile: File,
  options?: UploadAdminImageOptions
): Promise<string> {
  const file = await maybeNormalizeImageFile(rawFile, options);
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
    return await parseUploadResponse(res);
  } catch (multipartErr) {
    if (!isNetworkFetchError(multipartErr)) {
      throw multipartErr;
    }

    // Fallback via JSON base64 caso o proxy/rede bloqueie ou interrompa multipart/form-data
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await adminFetch('/api/upload-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || '',
          dataBase64,
        }),
      });
      return await parseUploadResponse(res);
    } catch (fallbackErr) {
      if (isNetworkFetchError(fallbackErr)) {
        throw new Error(
          'Falha de conexão ao enviar a imagem. Verifique sua rede ou tente novamente em instantes.'
        );
      }
      throw fallbackErr;
    }
  }
}
