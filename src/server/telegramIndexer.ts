import { detectJavCode } from './codeDetector.ts';
import { GithubMetadataService } from './githubMetadataService.ts';
import { TelegramDb, type TelegramVideoIndexRecord, type TelegramGalleryItem } from './telegramDb.ts';

export interface IndexResult {
  success: boolean;
  type?: 'video' | 'photo';
  code?: string;
  metadataFound?: boolean;
  duplicate?: boolean;
  messageId?: number;
  channelId?: string;
  galleryCount?: number;
  reason?: string;
  record?: TelegramVideoIndexRecord;
}

export class TelegramIndexer {
  static async processUpdate(update: any): Promise<IndexResult> {
    if (!update || typeof update !== 'object') return { success: false, reason: 'Invalid update payload' };
    const post = update.channel_post || update.message;
    if (!post) return { success: false, reason: 'Update does not contain channel_post or message' };
    return this.processPost(post);
  }

  static async processPost(post: any): Promise<IndexResult> {
    const channelId = String(post.chat?.id || '');
    const configuredChannel = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (configuredChannel && channelId !== configuredChannel) {
      return { success: false, channelId, reason: `Ignoring post from unexpected channel ${channelId}` };
    }
    const messageId = Number(post.message_id || 0);
    const mediaGroupId = post.media_group_id ? String(post.media_group_id) : undefined;
    const caption = post.caption || post.text || '';

    const detected = detectJavCode(caption);
    let code = detected?.canonical;

    if (mediaGroupId) {
      if (code) {
        await TelegramDb.setMediaGroupCode(mediaGroupId, code);
        const pending = await TelegramDb.getPendingMediaGroup(mediaGroupId);
        if (pending) {
          for (const photo of pending.photos) {
            await TelegramDb.addGalleryPhoto(code, photo, pending.channel_id);
          }
          await TelegramDb.clearPendingMediaGroup(mediaGroupId);
        }
      } else {
        code = await TelegramDb.getCodeByMediaGroup(mediaGroupId);
      }
    }

    let videoObj = post.video;
    if (!videoObj && post.document?.mime_type?.startsWith('video/')) videoObj = post.document;
    const isPhoto = Array.isArray(post.photo) && post.photo.length > 0;

    if (!videoObj && !isPhoto) {
      return { success: false, messageId, channelId, reason: 'Post contains neither a video nor a photo' };
    }

    if (!code) {
      if (isPhoto && mediaGroupId) {
        const highestRes = post.photo[post.photo.length - 1];
        await TelegramDb.addPendingMediaGroup(mediaGroupId, {
          channel_id: channelId,
          message_id: messageId,
          file_id: highestRes.file_id,
          file_unique_id: highestRes.file_unique_id,
          width: highestRes.width,
          height: highestRes.height,
        });
        return { success: true, type: 'photo', messageId, channelId, reason: 'Photo stored as pending media-group item' };
      }

      return {
        success: false,
        messageId,
        channelId,
        reason: `Could not identify JAV code from caption ("${caption.slice(0, 50)}") or media_group_id`,
      };
    }

    let metadataFound = false;
    try {
      const ghLookup = await GithubMetadataService.lookup(code);
      metadataFound = Boolean(ghLookup.metadataFound && ghLookup.video);
    } catch (e: any) {
      console.warn(`GitHub metadata lookup error for ${code}:`, e.message);
    }

    if (isPhoto) {
      const highestRes = post.photo[post.photo.length - 1];
      const photoItem: TelegramGalleryItem = {
        message_id: messageId,
        file_id: highestRes.file_id,
        file_unique_id: highestRes.file_unique_id,
        width: highestRes.width,
        height: highestRes.height,
      };
      const updatedRecord = await TelegramDb.addGalleryPhoto(code, photoItem, channelId);
      return {
        success: true,
        type: 'photo',
        code,
        metadataFound,
        messageId,
        channelId,
        galleryCount: updatedRecord.telegram.gallery?.length || 1,
        record: updatedRecord,
      };
    }

    if (!videoObj.file_id || typeof videoObj.file_id !== 'string') {
      return { success: false, messageId, channelId, reason: 'Broken or empty video file_id' };
    }

    const isDuplicate = await TelegramDb.hasMessage(channelId, messageId);
    if (isDuplicate) {
      return {
        success: true,
        type: 'video',
        code,
        duplicate: true,
        messageId,
        channelId,
        reason: `Video message ${messageId} in channel ${channelId} already indexed`,
        record: await TelegramDb.getVideo(code) || undefined,
      };
    }

    const existingForCode = await TelegramDb.getVideo(code);
    if (existingForCode?.telegram.video_file_id) {
      const existingWidth = existingForCode.telegram.width || 0;
      const incomingWidth = videoObj.width || 0;
      const existingSize = existingForCode.telegram.file_size || 0;
      const incomingSize = videoObj.file_size || 0;
      const isUpgrade = incomingWidth > existingWidth ||
        (incomingWidth === existingWidth && incomingSize > existingSize);

      if (isUpgrade) {
        existingForCode.telegram.video_file_id = videoObj.file_id;
        existingForCode.telegram.file_unique_id = videoObj.file_unique_id || existingForCode.telegram.file_unique_id;
        existingForCode.telegram.width = videoObj.width || existingForCode.telegram.width;
        existingForCode.telegram.height = videoObj.height || existingForCode.telegram.height;
        existingForCode.telegram.file_size = videoObj.file_size || existingForCode.telegram.file_size;
        existingForCode.telegram.duration = videoObj.duration || existingForCode.telegram.duration;
        existingForCode.updated_at = new Date().toISOString();
        await TelegramDb.saveVideo(existingForCode);
        return {
          success: true, type: 'video', code, metadataFound, duplicate: false,
          messageId, channelId, reason: 'Upgraded video file_id with higher quality release',
          record: existingForCode,
        };
      }
    }

    const record: TelegramVideoIndexRecord = {
      code,
      telegram: {
        channel_id: channelId,
        message_id: messageId,
        video_file_id: videoObj.file_id,
        file_unique_id: videoObj.file_unique_id,
        duration: videoObj.duration,
        width: videoObj.width,
        height: videoObj.height,
        file_size: videoObj.file_size,
        mime_type: videoObj.mime_type || 'video/mp4',
        media_group_id: mediaGroupId,
      },
      indexed_at: new Date().toISOString(),
    };

    const pending = mediaGroupId ? await TelegramDb.getPendingMediaGroup(mediaGroupId) : null;
    if (pending) {
      record.telegram.gallery = pending.photos;
      await TelegramDb.clearPendingMediaGroup(pending.media_group_id);
    }

    await TelegramDb.saveVideo(record);

    return {
      success: true, type: 'video', code, metadataFound, duplicate: false,
      messageId, channelId, galleryCount: record.telegram.gallery?.length || 0, record,
    };
  }
}
