import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../lib/env";
import type { EvaluationPhotoItem } from "../../contracts/types";

const PHOTO_URL_TTL_SECONDS = 15 * 60;
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

let client: S3Client | null = null;
let clientSignature = "";

function getConfig() {
  return {
    endpoint: env.s3Endpoint,
    region: env.s3Region,
    bucket: env.s3BucketName,
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  };
}

export function isEvaluationPhotoStorageConfigured(): boolean {
  const config = getConfig();
  return Boolean(
    config.endpoint &&
      config.region &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey,
  );
}

function getClient(): S3Client {
  const config = getConfig();
  if (!isEvaluationPhotoStorageConfigured()) {
    throw new Error("Armazenamento S3 das avaliações não está configurado.");
  }

  const nextSignature = `${config.endpoint}|${config.region}|${config.bucket}|${config.accessKeyId}`;
  if (!client || clientSignature !== nextSignature) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    clientSignature = nextSignature;
  }
  return client;
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function safeContentType(contentType: string): string {
  return ["image/jpeg", "image/png", "image/webp"].includes(contentType)
    ? contentType
    : "image/jpeg";
}

function newObjectKey(contentType: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `evaluations/${date}/${randomUUID()}.${extensionForContentType(contentType)}`;
}

export async function createEvaluationPhotoUploadUrl(input: {
  contentType: string;
  size: number;
}): Promise<{ configured: true; objectKey: string; uploadUrl: string; contentType: string } | { configured: false }> {
  if (!isEvaluationPhotoStorageConfigured()) return { configured: false };
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > MAX_PHOTO_BYTES) {
    throw new Error("A foto deve ter entre 1 byte e 2 MB após a compressão.");
  }

  const contentType = safeContentType(input.contentType);
  const objectKey = newObjectKey(contentType);
  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: env.s3BucketName,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return { configured: true, objectKey, uploadUrl, contentType };
}

function parseDataUrl(value: string): { contentType: string; body: Buffer } | null {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;
  const body = Buffer.from(match[2], "base64");
  if (body.length === 0 || body.length > MAX_PHOTO_BYTES) return null;
  return { contentType: match[1].toLowerCase(), body };
}

function objectKeyFromPhoto(photo: EvaluationPhotoItem): string | null {
  if (photo.storage === "s3" && photo.objectKey) return photo.objectKey;
  if (photo.url.startsWith("s3://")) return photo.url.slice("s3://".length);
  return null;
}

export function getPhotoObjectKey(photo: EvaluationPhotoItem): string | null {
  return objectKeyFromPhoto(photo);
}

export async function prepareEvaluationPhotosForStorage(
  photos: EvaluationPhotoItem[],
): Promise<EvaluationPhotoItem[]> {
  if (!isEvaluationPhotoStorageConfigured()) return photos;

  const stored: EvaluationPhotoItem[] = [];
  for (const photo of photos) {
    const existingObjectKey = objectKeyFromPhoto(photo);
    if (existingObjectKey) {
      stored.push({
        ...photo,
        url: `s3://${existingObjectKey}`,
        storage: "s3",
        objectKey: existingObjectKey,
      });
      continue;
    }

    const parsed = parseDataUrl(photo.url);
    if (!parsed) {
      stored.push({ ...photo, storage: "inline" });
      continue;
    }

    const contentType = safeContentType(parsed.contentType);
    const objectKey = newObjectKey(contentType);
    await getClient().send(
      new PutObjectCommand({
        Bucket: env.s3BucketName,
        Key: objectKey,
        Body: parsed.body,
        ContentType: contentType,
        ContentLength: parsed.body.length,
      }),
    );
    stored.push({
      ...photo,
      url: `s3://${objectKey}`,
      storage: "s3",
      objectKey,
    });
  }
  return stored;
}

export async function hydrateEvaluationPhotos(
  photos: EvaluationPhotoItem[],
): Promise<EvaluationPhotoItem[]> {
  if (!isEvaluationPhotoStorageConfigured()) return photos;
  const result: EvaluationPhotoItem[] = [];
  for (const photo of photos) {
    const objectKey = objectKeyFromPhoto(photo);
    if (!objectKey) {
      result.push(photo);
      continue;
    }
    const url = await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: env.s3BucketName, Key: objectKey }),
      { expiresIn: PHOTO_URL_TTL_SECONDS },
    );
    result.push({ ...photo, url, storage: "s3", objectKey });
  }
  return result;
}

export async function deleteEvaluationPhotoObjects(objectKeys: string[]): Promise<void> {
  const uniqueKeys = [...new Set(objectKeys.filter(Boolean))];
  if (!uniqueKeys.length || !isEvaluationPhotoStorageConfigured()) return;
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: env.s3BucketName,
      Delete: { Objects: uniqueKeys.map(Key => ({ Key })), Quiet: true },
    }),
  );
}

export function parseStoredEvaluationPhotos(value: unknown): EvaluationPhotoItem[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as EvaluationPhotoItem[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as EvaluationPhotoItem[]) : [];
  } catch {
    return [];
  }
}

export function maxEvaluationPhotoBytes(): number {
  return MAX_PHOTO_BYTES;
}
