import { createClient as createCookieClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

async function getAdminAuthContext(request?: Request) {
  let user: any = null;
  let client: any = await createCookieClient();

  const { data: { user: cookieUser } } = await client.auth.getUser();

  if (cookieUser) {
    user = cookieUser;
  } else if (request) {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const bearerClient = createSupabaseJsClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user: tokenUser } } = await bearerClient.auth.getUser();
      if (tokenUser) {
        user = tokenUser;
        client = bearerClient;
      }
    }
  }

  if (!user) return null;

  // Check admin role — always trust the profiles table, never client-editable user_metadata
  let role: string | null = null;
  const { data: prof } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  role = prof?.role || null;

  if (!role) {
    const adminClient = getSupabaseAdmin();
    const { data: adminProf } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    role = adminProf?.role || null;
  }

  if (role !== 'admin') return null;
  return { user, client };
}

export async function GET(request: Request) {
  try {
    const authCtx = await getAdminAuthContext(request);
    if (!authCtx) {
      return Response.json({ error: 'Unauthorized: Admin role required' }, { status: 401 });
    }

    const { client } = authCtx;
    const { data: users, error } = await client
      .from('profiles')
      .select('id, name, email, role, mobile_number, created_at')
      .order('created_at', { ascending: false });

    if (users && users.length > 0) {
      return Response.json({ users });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: adminUsers } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, mobile_number, created_at')
      .order('created_at', { ascending: false });

    return Response.json({ users: adminUsers || [] });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return Response.json({ error: err.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authCtx = await getAdminAuthContext(request);
    if (!authCtx) {
      return Response.json({ error: 'Unauthorized: Admin role required' }, { status: 401 });
    }

    const { client } = authCtx;
    const supabaseAdmin = getSupabaseAdmin();

    const { email, password, name, role, mobileNumber } = await request.json();

    if (!email || !password || !name || !role) {
      return Response.json({ error: 'Missing required fields: name, email, password and role are all required.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'The email address you entered is invalid. Please use a real email like name@company.com' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    let createdUser: any = null;
    const isFallbackProfile = false;

    // 1. Try admin.createUser (auto-confirms, no email sent)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        mobile_number: mobileNumber || '',
      }
    });

    if (createError) {
      console.warn('admin.createUser failed, attempting auth.signUp fallback:', createError.message);
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            mobile_number: mobileNumber || '',
          }
        }
      });

      if (signUpError) {
        const rawMsg = signUpError.message || '';
        if (rawMsg.toLowerCase().includes('already registered') || rawMsg.toLowerCase().includes('already been registered') || rawMsg.toLowerCase().includes('user already exists')) {
          return Response.json({ error: 'This email is already registered. Please use a different email address.' }, { status: 400 });
        } else if (rawMsg.toLowerCase().includes('email address') && rawMsg.toLowerCase().includes('invalid')) {
          return Response.json({ error: 'The email address you entered is invalid. Please use a real email like name@company.com' }, { status: 400 });
        } else if (rawMsg.toLowerCase().includes('password') && rawMsg.toLowerCase().includes('short')) {
          return Response.json({ error: 'Password is too short. Please use at least 8 characters.' }, { status: 400 });
        } else if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('too many') || rawMsg.toLowerCase().includes('over_email_send_rate_limit')) {
          return Response.json({ error: 'Supabase email rate limit exceeded. Please wait a few minutes before creating another user.' }, { status: 429 });
        }
        return Response.json({ error: rawMsg }, { status: 400 });
      }

      createdUser = signUpData.user;
    } else {
      createdUser = newUser.user;
    }

    if (createdUser && createdUser.id) {
      const profileObj = {
        id: createdUser.id,
        name,
        email,
        role,
        mobile_number: mobileNumber || '',
      };

      const { error: profileError } = await client.from('profiles').upsert(profileObj);

      if (profileError) {
        console.warn('client upsert failed, trying supabaseAdmin:', profileError.message);
        await supabaseAdmin.from('profiles').upsert(profileObj);
      }
    }

    return Response.json({
      user: createdUser,
      message: isFallbackProfile
        ? 'User profile created in directory.'
        : 'User created successfully.'
    });
  } catch (err: any) {
    console.error('Error creating user:', err);
    return Response.json({ error: err.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authCtx = await getAdminAuthContext(request);
    if (!authCtx) {
      return Response.json({ error: 'Unauthorized: Admin role required' }, { status: 401 });
    }

    const { client } = authCtx;
    const supabaseAdmin = getSupabaseAdmin();

    const { userId, email, name, role, mobileNumber, password } = await request.json();

    if (!userId || !email || !name || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
      const updateAuthPayload: any = {
        email,
        user_metadata: {
          name,
          role,
          mobile_number: mobileNumber || '',
        }
      };
      if (password && typeof password === 'string' && password.trim().length >= 8) {
        updateAuthPayload.password = password.trim();
      }
      await supabaseAdmin.auth.admin.updateUserById(userId, updateAuthPayload);
    } catch (e: any) {
      console.warn('admin.updateUserById failed:', e.message);
    }

    const { error: profileError } = await client
      .from('profiles')
      .update({
        name,
        email,
        role,
        mobile_number: mobileNumber || '',
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Error updating user:', err);
    return Response.json({ error: err.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authCtx = await getAdminAuthContext(request);
    if (!authCtx) {
      return Response.json({ error: 'Unauthorized: Admin role required' }, { status: 401 });
    }

    const { user: adminUser, client } = authCtx;
    const { userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (userId === adminUser.id) {
      return Response.json({ error: 'You cannot delete your own admin account.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Look up target user profile (try client first, then admin)
    let targetUser: any = null;
    const { data: cUser } = await client
      .from('profiles')
      .select('id, name, role, email')
      .eq('id', userId)
      .maybeSingle();

    if (cUser) {
      targetUser = cUser;
    } else {
      const { data: aUser } = await supabaseAdmin
        .from('profiles')
        .select('id, name, role, email')
        .eq('id', userId)
        .maybeSingle();
      targetUser = aUser;
    }

    if (!targetUser) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    const actualUserId = targetUser.id;

    if (actualUserId === adminUser.id) {
      return Response.json({ error: 'You cannot delete your own admin account.' }, { status: 400 });
    }

    // 2. Check for linked projects before deletion
    if (targetUser.role === 'architect') {
      const { count } = await supabaseAdmin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('architect_id', actualUserId);

      if (count && count > 0) {
        return Response.json({
          error: `Cannot delete architect "${targetUser.name}" — they have ${count} project(s). Reassign or delete those projects first.`
        }, { status: 400 });
      }
    } else if (targetUser.role === 'designer') {
      const { count } = await supabaseAdmin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_designer_id', actualUserId);

      if (count && count > 0) {
        return Response.json({
          error: `Cannot delete designer "${targetUser.name}" — they are assigned to ${count} project(s). Reassign them first.`
        }, { status: 400 });
      }
    }

    // 3. Delete profile via SECURITY DEFINER RPC (bypasses RLS)
    const { data: rpcResult, error: rpcError } = await client.rpc('admin_delete_profile', {
      target_user_id: actualUserId
    });

    if (rpcError) {
      console.error('admin_delete_profile RPC error:', rpcError.message);
      // Fallback: try direct admin client delete
      const { error: adminDelErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', actualUserId);

      if (adminDelErr) {
        return Response.json({
          error: `Failed to delete user profile: ${adminDelErr.message}`
        }, { status: 500 });
      }
    } else if (rpcResult === false) {
      // RPC ran successfully but returned false — row was not found/deleted
      return Response.json({
        error: 'User profile could not be deleted. It may have already been removed.'
      }, { status: 404 });
    }

    // 4. Verify the profile is actually gone
    const { data: checkGone } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', actualUserId)
      .maybeSingle();

    if (checkGone) {
      return Response.json({
        error: 'Profile deletion failed — the row still exists. Check Supabase RLS DELETE policies for the profiles table.'
      }, { status: 500 });
    }

    // 5. Also remove from auth.users
    try {
      await supabaseAdmin.auth.admin.deleteUser(actualUserId);
    } catch (e: any) {
      // Non-fatal — profile is already gone from public.profiles
      console.warn('auth.admin.deleteUser failed (non-fatal):', e.message);
    }

    return Response.json({ success: true, message: `${targetUser.name} has been deleted.` });
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return Response.json({ error: err.message || 'Failed to delete user' }, { status: 500 });
  }
}
