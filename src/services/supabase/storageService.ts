import { supabase } from './client';

export type StorageBucket = 'condominium_documents' | 'maintenance_attachments' | 'assembly_minutes';

export const storageService = {
  async uploadFile(
    bucket: StorageBucket,
    path: string,
    file: File | Blob
  ): Promise<{ path: string; error?: any }> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
      });

    if (error) throw error;
    return { path: data.path };
  },

  async createSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds = 3600
  ): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.warn('Erro ao gerar signed URL:', error);
      return null;
    }
    return data.signedUrl;
  },

  async deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};
