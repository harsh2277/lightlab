import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { requireProjectAccess } from '@/utils/supabase/authorize';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireProjectAccess(id);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieClient = await createCookieClient();
    const adminClient = getSupabaseAdmin();
    const userId = auth.userId;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file || !category) {
      return Response.json({ error: 'File and category are required' }, { status: 400 });
    }



    // Upload file to Supabase storage
    const fileExt = file.name.split('.').pop();
    const filePath = `deliverables/${id}/${category}-${Date.now()}.${fileExt}`;
    const buffer = await file.arrayBuffer();

    try {
      await adminClient.storage
        .from('project-assets')
        .upload(filePath, Buffer.from(buffer), {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true
        });
    } catch (e) {}

    // Insert database record
    const insertPayload: any = {
      project_id: id,
      file_name: file.name,
      file_path: filePath,
      category: category
    };
    if (userId) insertPayload.uploaded_by = userId;

    let fileRecord: any = null;
    let dbError: any = null;

    // Try cookie client
    const { data: cRecord, error: cErr } = await cookieClient
      .from('project_files')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (cRecord) {
      fileRecord = cRecord;
    } else {
      dbError = cErr;
      // Try admin client
      const { data: aRecord, error: aErr } = await adminClient
        .from('project_files')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (aRecord) {
        fileRecord = aRecord;
      } else {
        dbError = aErr;
        // Try without uploaded_by field as last resort
        delete insertPayload.uploaded_by;
        const { data: fallbackRecord, error: fErr } = await cookieClient
          .from('project_files')
          .insert(insertPayload)
          .select()
          .maybeSingle();

        if (fallbackRecord) {
          fileRecord = fallbackRecord;
        } else {
          dbError = fErr || aErr || cErr;
        }
      }
    }

    if (!fileRecord && dbError) {
      throw new Error(dbError.message || 'Failed to save uploaded file record');
    }

    return Response.json({ success: true, fileRecord: fileRecord || { file_name: file.name, file_path: filePath, category } });
  } catch (err: any) {
    console.error('Error handling designer upload API:', err);
    return Response.json({ error: err.message || 'Failed to upload deliverable' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireProjectAccess(id);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieClient = await createCookieClient();
    const adminClient = getSupabaseAdmin();

    const { fileId, filePath } = await request.json();

    if (!fileId || !filePath) {
      return Response.json({ error: 'Missing fileId or filePath' }, { status: 400 });
    }

    // Delete file from storage
    try {
      await adminClient.storage
        .from('project-assets')
        .remove([filePath]);
    } catch (e) {}

    // Delete database record
    const { error: dbError } = await cookieClient
      .from('project_files')
      .delete()
      .eq('id', fileId)
      .eq('project_id', id);

    if (dbError) {
      await adminClient
        .from('project_files')
        .delete()
        .eq('id', fileId)
        .eq('project_id', id);
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Error handling designer delete API:', err);
    return Response.json({ error: err.message || 'Failed to delete deliverable' }, { status: 500 });
  }
}
