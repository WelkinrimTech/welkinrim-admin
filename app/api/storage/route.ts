import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isErrorResponse } from '@/lib/apiAuth';

interface BucketOptionsInput {
  public: boolean;
  // supabase-js expects camelCase here and maps it to file_size_limit /
  // allowed_mime_types itself; snake_case keys were silently ignored.
  fileSizeLimit?: number | string | null;
  allowedMimeTypes?: string[] | null;
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (isErrorResponse(ctx)) return ctx;
  const supabaseAdmin = ctx.admin;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const bucket = searchParams.get('bucket');

  try {
    // List buckets
    if (action === 'listBuckets') {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ buckets: data });
    }

    // Get bucket details
    if (action === 'getBucket' && bucket) {
      const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ bucket: data });
    }

    // List files in bucket
    if (action === 'listFiles' && bucket) {
      const folder = searchParams.get('folder') || '';
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ files: data });
    }

    // Get public URL
    if (action === 'getPublicUrl' && bucket) {
      const fileName = searchParams.get('file');
      if (!fileName) {
        return NextResponse.json({ error: 'File name required' }, { status: 400 });
      }
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
      return NextResponse.json({ url: data.publicUrl });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Storage API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (isErrorResponse(ctx)) return ctx;
  const supabaseAdmin = ctx.admin;

  try {
    const body = await request.json();
    const { action, bucket, fileName, fileNames, isPublic, fileSizeLimit, allowedMimeTypes } = body;

    // Create bucket with configuration
    if (action === 'createBucket') {
      const options: BucketOptionsInput = {
        public: isPublic ?? true,
      };

      if (fileSizeLimit) {
        options.fileSizeLimit = fileSizeLimit;
      }

      if (allowedMimeTypes && Array.isArray(allowedMimeTypes)) {
        options.allowedMimeTypes = allowedMimeTypes;
      }

      const { data, error } = await supabaseAdmin.storage.createBucket(bucket, options);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, bucket: data });
    }

    // Update bucket configuration
    if (action === 'updateBucket') {
      const options: BucketOptionsInput = {
        public: isPublic,
      };

      if (fileSizeLimit !== undefined) {
        options.fileSizeLimit = fileSizeLimit;
      }

      if (allowedMimeTypes && Array.isArray(allowedMimeTypes)) {
        options.allowedMimeTypes = allowedMimeTypes;
      }

      const { data, error } = await supabaseAdmin.storage.updateBucket(bucket, options);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, bucket: data });
    }

    // Delete bucket
    if (action === 'deleteBucket') {
      const { error } = await supabaseAdmin.storage.deleteBucket(bucket);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Empty bucket
    if (action === 'emptyBucket') {
      // First list all files
      const { data: files, error: listError } = await supabaseAdmin.storage.from(bucket).list('', {
        limit: 1000,
      });

      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      if (files && files.length > 0) {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(files.map(f => f.name));
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true, deletedCount: files?.length || 0 });
    }

    // Delete file
    if (action === 'deleteFile') {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([fileName]);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Delete multiple files
    if (action === 'deleteFiles') {
      if (!fileNames || !Array.isArray(fileNames)) {
        return NextResponse.json({ error: 'fileNames array required' }, { status: 400 });
      }
      const { error } = await supabaseAdmin.storage.from(bucket).remove(fileNames);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deleted: fileNames.length });
    }

    // Upload file (base64 encoded)
    if (action === 'uploadFile') {
      const { fileData, contentType } = body;
      if (!fileData || !fileName) {
        return NextResponse.json({ error: 'fileData and fileName required' }, { status: 400 });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(fileData, 'base64');
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: true,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, path: data?.path });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Storage API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}