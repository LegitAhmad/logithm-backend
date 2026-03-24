import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient | null;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabaseUrl');
    const supabasePrivateKey =
      this.configService.get<string>('supabasePrivateKey');
    const supabasePublicKey =
      this.configService.get<string>('supabasePublicKey');
    const supabaseKey = supabasePrivateKey || supabasePublicKey;

    this.bucket =
      this.configService.get<string>('supabaseBucket') ?? 'profile-pictures';

    this.client =
      supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          })
        : null;
  }

  async uploadProfilePicture(userId: string, webpBuffer: Buffer) {
    console.log('[supabase.uploadProfilePicture] start', {
      userId,
      size: webpBuffer?.length,
      bucket: this.bucket,
      hasClient: Boolean(this.client),
    });

    if (!this.client) {
      console.error('[supabase.uploadProfilePicture] client not configured');
      throw new InternalServerErrorException(
        'Supabase storage is not configured',
      );
    }

    const objectPath = `users/${userId}/${Date.now()}.webp`;

    const { error: uploadError } = await this.client.storage
      .from(this.bucket)
      .upload(objectPath, webpBuffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[supabase.uploadProfilePicture] upload failed', {
        message: uploadError.message,
      });
      throw new InternalServerErrorException(
        `Failed to upload profile image: ${uploadError.message}`,
      );
    }

    const { data } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(objectPath);

    if (!data?.publicUrl) {
      console.error('[supabase.uploadProfilePicture] missing public URL');
      throw new InternalServerErrorException(
        'Failed to generate profile image URL',
      );
    }

    console.log('[supabase.uploadProfilePicture] success', {
      userId,
      objectPath,
    });

    return data.publicUrl;
  }
}
