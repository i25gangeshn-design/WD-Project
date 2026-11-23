const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.119.2';
let client;
let lastWorkspace;
let config;
let workspaceChannel;

export async function initializeBackend() {
  const configResponse = await fetch('/api/config', { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!configResponse.ok) throw new Error('The workspace backend is not configured yet.');
  config = await configResponse.json();
  const { createClient } = await import(SDK_URL);
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('Could not restore the sign-in session.');
  return { user: data.session?.user ?? null, config };
}

export function getClient() {
  if (!client) throw new Error('The workspace has not connected to its backend.');
  return client;
}

export function subscribeToAuth(callback) {
  return getClient().auth.onAuthStateChange((event, session) => callback(event, session?.user ?? null));
}

export function subscribeToWorkspace(eventId, callback) {
  if (workspaceChannel) getClient().removeChannel(workspaceChannel);
  if (!eventId) return () => {};
  let timer;
  workspaceChannel = getClient().channel(`workspace:${eventId}`);
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(), 250);
  };
  for (const table of ['events','event_members','categories','category_fields','counted_items','tracked_records','tracked_record_values','activity_entries']) {
    workspaceChannel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
  }
  workspaceChannel.subscribe();
  return () => {
    clearTimeout(timer);
    if (workspaceChannel) getClient().removeChannel(workspaceChannel);
    workspaceChannel = null;
  };
}

export async function signIn({ email, password }) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(authErrorMessage(error, 'Email or password is incorrect.'));
  return data.user;
}

export async function signUp({ name, email, password }) {
  const { data, error } = await getClient().auth.signUp({
    email, password,
    options: { data: { name } },
  });
  if (error) throw new Error(authErrorMessage(error, 'Account creation could not be completed. Check the details and try again.'));
  return data;
}

function authErrorMessage(error, fallback) {
  const code = error?.code || error?.error_code || '';
  const message = String(error?.message || '');
  if (code === 'over_request_rate_limit') return 'Too many attempts were made. Wait a few minutes, then try again.';
  if (/password/i.test(message) || code === 'weak_password') return 'Use a stronger password and try again.';
  if (code === 'email_not_confirmed') return 'Email confirmation is still enabled in Supabase. Disable Confirm email in the Email provider settings, then retry.';
  return fallback;
}

export async function requestPasswordReset(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/?reset-password=1` });
  if (error) throw new Error(authErrorMessage(error, 'Could not send a reset link. Check the email address and try again.'));
}

export async function updatePassword(password) {
  const { error } = await getClient().auth.updateUser({ password });
  if (error) throw new Error('Could not update the password. Request a fresh reset link and try again.');
}

export async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw new Error('Sign-out could not be completed. Try again.');
}

export async function verifyCaptcha(token) {
  const response = await fetch('/api/captcha/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) throw new Error(result.error || 'Complete the human check and try again.');
}

export async function loadWorkspace(user) {
  if (!user) { lastWorkspace = null; return { version: 4, users: [], events: [] }; }
  const db = getClient();
  const { data: memberships, error: memberError } = await db.from('event_members').select('event_id,user_id,role,created_at').eq('user_id', user.id);
  if (memberError) throw new Error('Could not load your event access.');
  const eventIds = (memberships || []).map(row => row.event_id);
  const users = await rows(db.from('profiles').select('id,name,email,avatar_color'));
  const events = eventIds.length ? await rows(db.from('events').select('*').in('id', eventIds)) : [];
  if (!eventIds.length) {
    const workspace = { version: 4, users: users.map(profile), events: [] };
    lastWorkspace = structuredClone(workspace); return workspace;
  }
  const [allMemberships, categories, entries] = await Promise.all([
    rows(db.from('event_members').select('*').in('event_id', eventIds)),
    rows(db.from('categories').select('*').in('event_id', eventIds)),
    rows(db.from('activity_entries').select('*').in('event_id', eventIds).order('created_at', { ascending: false }).limit(300)),
  ]);
  const categoryIds = categories.map(row => row.id);
  const [fields, counted, tracked] = categoryIds.length ? await Promise.all([
    rows(db.from('category_fields').select('*').in('category_id', categoryIds).order('display_order')),
    rows(db.from('counted_items').select('*').in('category_id', categoryIds)),
    rows(db.from('tracked_records').select('*').in('category_id', categoryIds)),
  ]) : [[], [], []];
  const trackedIds = tracked.map(row => row.id);
  const values = trackedIds.length ? await rows(db.from('tracked_record_values').select('*').in('tracked_record_id', trackedIds)) : [];
  const activityIds = entries.map(row => row.id);
  const readStates = activityIds.length ? await rows(db.from('notification_read_state').select('notification_id').eq('user_id', user.id).in('notification_id', activityIds)) : [];
  const readSet = new Set(readStates.map(row => row.notification_id));
  const usersById = new Map(users.map(row => [row.id, profile(row)]));
  if (!usersById.has(user.id)) {
    const self = await rows(db.from('profiles').select('*').eq('id', user.id));
    if (self[0]) usersById.set(user.id, profile(self[0]));
  }
  const categoriesByEvent = new Map();
  for (const row of categories) {
    const category = { id: row.id, name: row.name, type: row.type, description: row.description, createdBy: row.created_by, assets: [] };
    if (row.type === 'tracked') category.fields = fields.filter(field => field.category_id === row.id).map(field => ({ id: field.id, label: field.label, type: field.type, required: field.required }));
    categoriesByEvent.set(row.id, category);
  }
  for (const row of counted) {
    const category = categoriesByEvent.get(row.category_id); if (!category) continue;
    category.assets.push({ id: row.id, name: row.name, quantity: row.quantity, min: row.minimum_quantity, target: row.target_quantity, location: row.location, image: null, imagePath: row.image_path, version: row.version });
  }
  for (const row of tracked) {
    const category = categoriesByEvent.get(row.category_id); if (!category) continue;
    const recordValues = Object.fromEntries(values.filter(value => value.tracked_record_id === row.id).map(value => [value.field_id, value.value]));
    category.assets.push({ id: row.id, status: row.status, context: row.assignment_note, values: recordValues, version: row.version });
  }
  const workspace = {
    version: 4,
    users: [...usersById.values()],
    events: events.map(row => ({
      id: row.id, name: row.name, short: row.short_name, location: row.location, date: formatEventDate(row.start_date, row.end_date),
      startDate: row.start_date, endDate: row.end_date, note: row.note, creatorId: row.creator_id, createdAt: Date.parse(row.created_at), updatedAt: row.updated_at,
      joinCode: null, adminCode: null,
      members: allMemberships.filter(member => member.event_id === row.id).map(member => ({ userId: member.user_id, role: member.role, online: false, lastSeen: Date.parse(member.created_at) })),
      categories: categories.filter(category => category.event_id === row.id).map(category => categoriesByEvent.get(category.id)),
      notifications: entries.filter(entry => entry.event_id === row.id).map(entry => ({ id: entry.id, actorId: entry.actor_id, kind: entry.kind, title: entry.title, detail: entry.detail, at: Date.parse(entry.created_at), unread: !readSet.has(entry.id) })),
    })),
  };
  const signedImageAssets = workspace.events.flatMap(event => event.categories.flatMap(category => category.assets.filter(asset => asset.imagePath)));
  await Promise.all(signedImageAssets.map(async asset => {
    const { data, error } = await db.storage.from('inventory-images').createSignedUrl(asset.imagePath, 3600);
    if (!error) asset.image = data.signedUrl;
  }));
  lastWorkspace = structuredClone(workspace);
  return workspace;
}

function profile(row) { return { id: row.id, name: row.name, email: row.email, color: row.avatar_color }; }
function formatEventDate(start, end) {
  if (!start && !end) return '';
  const format = value => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end && start !== end) return `${format(start)} – ${format(end)}`;
  return format(start || end);
}
async function rows(query) {
  const { data, error } = await query;
  if (error) throw new Error('The workspace data could not be loaded. Check your access and try again.');
  return data || [];
}

export async function createEvent(input, userId) {
  const start = input.startDate || input.date || null;
  const end = input.endDate || start;
  const { data, error } = await getClient().rpc('create_event', {
    p_name: String(input.name).trim(), p_short_name: '', p_location: String(input.location || '').trim(),
    p_start_date: start, p_end_date: end, p_note: String(input.note || '').trim(),
  });
  if (error) throw new Error('Could not create the event. Check the event details and try again.');
  return { id: data.id, name: input.name.trim(), short: '', location: input.location || '', date: formatEventDate(start,end), startDate:start, endDate:end, note:input.note||'', creatorId:userId, createdAt:Date.now(), joinCode:data.member_code, adminCode:data.admin_code, members:[{userId,role:'creator',online:true,lastSeen:Date.now()}], categories:[], notifications:[] };
}

export async function joinEvent(code, asAdmin = false) {
  const { data, error } = await getClient().rpc('join_event', { p_code: String(code).trim(), p_admin: asAdmin });
  if (error) throw new Error('That event code is not active.');
  return data;
}

export async function rotateCode(eventId, admin = false) {
  const { data, error } = await getClient().rpc('rotate_event_code', { p_event_id: eventId, p_admin: admin });
  if (error) throw new Error('Could not replace this access code.');
  return data;
}

export async function uploadImage(eventId, file) {
  const allowed = new Set(['image/jpeg','image/png','image/webp']);
  if (!allowed.has(file.type) || file.size > 1_572_864) throw new Error('Choose a JPEG, PNG, or WebP image under 1.5 MB.');
  const path = `${eventId}/${crypto.randomUUID()}.${({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' })[file.type]}`;
  const { error } = await getClient().storage.from('inventory-images').upload(path,file,{contentType:file.type,upsert:false});
  if (error) throw new Error('Image upload failed. Try another image.');
  const { data } = await getClient().storage.from('inventory-images').createSignedUrl(path,3600);
  return { path, url:data?.signedUrl || null };
}

export async function markNotificationsRead(event) {
  const unread = event.notifications.filter(item => item.unread);
  if (!unread.length) return;
  const db = getClient(); const user = await db.auth.getUser();
  const records = unread.map(item => ({ notification_id:item.id, user_id:user.data.user.id }));
  const { error } = await db.from('notification_read_state').upsert(records,{onConflict:'notification_id,user_id'});
  if (error) throw new Error('Could not update the notification read state.');
  unread.forEach(item => { item.unread=false; });
}

export async function saveWorkspace(workspace, userId, activeEventId) {
  if (!lastWorkspace) throw new Error('Workspace changes were not saved because the data has not finished loading.');
  const oldDb = lastWorkspace; const db = getClient();
  const oldEvents = new Map(oldDb.events.map(event => [event.id,event]));
  const nextEvents = new Map(workspace.events.map(event => [event.id,event]));
  for (const [eventId, oldEvent] of oldEvents) {
    if (!nextEvents.has(eventId)) {
      const { error } = await db.from('events').delete().eq('id',eventId);
      if (error) throw new Error('Could not delete the event.');
      continue;
    }
  }
  for (const event of workspace.events) {
    const oldEvent = oldEvents.get(event.id);
    if (!oldEvent) continue; // Events are created through the secure RPC above.
    if (event.id !== activeEventId) continue;
    const oldRole = oldEvent.members.find(member=>member.userId===userId)?.role;
    const eventChanged = ['name','short','location','note','startDate','endDate'].some(key=>event[key]!==oldEvent[key]);
    if (eventChanged) {
      const update = {name:event.name,short_name:event.short||'',location:event.location||'',note:event.note||'',start_date:event.startDate||null,end_date:event.endDate||null};
      let query = db.from('events').update(update).eq('id',event.id);
      if (oldRole === 'creator' || oldRole === 'admin') query = query.eq('updated_at',oldEvent.updatedAt);
      const { data,error } = await query.select('id,updated_at').maybeSingle();
      if (error || !data) throw new Error('This event changed elsewhere. Reload it before making another change.');
      event.updatedAt=data.updated_at;
    }
    await syncMembers(db,oldEvent,event,userId);
    await syncCategories(db,oldEvent,event,userId);
    await syncActivity(db,oldEvent,event,userId);
  }
  lastWorkspace = structuredClone(workspace);
}

async function syncMembers(db,oldEvent,event,userId) {
  const prev=new Map(oldEvent.members.map(member=>[member.userId,member]));
  const next=new Map(event.members.map(member=>[member.userId,member]));
  for(const [id,member] of prev) if(!next.has(id)){const {error}=await db.from('event_members').delete().eq('event_id',event.id).eq('user_id',id);if(error)throw new Error('Could not remove this event member.');}
  for(const [id,member] of next){const before=prev.get(id);if(before&&before.role!==member.role){const {error}=await db.from('event_members').update({role:member.role}).eq('event_id',event.id).eq('user_id',id);if(error)throw new Error('You do not have permission to change this role.');}else if(!before&&id===userId){continue;}}
}

async function syncCategories(db,oldEvent,event,userId) {
  const oldCats=new Map(oldEvent.categories.map(category=>[category.id,category]));
  const newCats=new Map(event.categories.map(category=>[category.id,category]));
  for(const [id,cat] of oldCats) if(!newCats.has(id)){const {error}=await db.from('categories').delete().eq('id',id);if(error)throw new Error('Could not delete the category.');}
  for(const cat of event.categories){
    const previous=oldCats.get(cat.id);
    if(!previous){const {error}=await db.from('categories').insert({id:cat.id,event_id:event.id,name:cat.name,type:cat.type,description:cat.description||'',created_by:userId});if(error)throw new Error('Could not create the category.');}
    else if(['name','type','description'].some(key=>cat[key]!==previous[key])){const {error}=await db.from('categories').update({name:cat.name,type:cat.type,description:cat.description||''}).eq('id',cat.id);if(error)throw new Error('Could not update the category.');}
    await syncFields(db,cat,previous);
    await syncAssets(db,event,cat,previous,userId);
  }
}

async function syncFields(db,category,previous) {
  if(category.type!=='tracked') return;
  const old=new Map((previous?.fields||[]).map(field=>[field.id,field])); const next=new Map((category.fields||[]).map(field=>[field.id,field]));
  for(const id of old.keys()) if(!next.has(id)){const {error}=await db.from('category_fields').delete().eq('id',id);if(error)throw new Error('Could not remove a tracked field.');}
  for(const field of next.values()){
    const before=old.get(field.id); const row={id:field.id,category_id:category.id,label:field.label,type:field.type||'text',required:!!field.required,display_order:category.fields.indexOf(field)};
    if(before&&before.label===field.label&&before.type===field.type&&before.required===field.required&&old.get(field.id)&&category.fields.indexOf(field)===(previous?.fields||[]).findIndex(item=>item.id===field.id)) continue;
    const result=before?await db.from('category_fields').update(row).eq('id',field.id):await db.from('category_fields').insert(row);
    if(result.error)throw new Error('Could not save the tracked fields.');
  }
}

async function syncAssets(db,event,category,previous,userId) {
  const oldAssets=new Map((previous?.assets||[]).map(asset=>[asset.id,asset]));const nextAssets=new Map(category.assets.map(asset=>[asset.id,asset]));
  for(const id of oldAssets.keys()) if(!nextAssets.has(id)){
    const {error}=category.type==='counted'?await db.from('counted_items').delete().eq('id',id):await db.from('tracked_records').delete().eq('id',id);
    if(error)throw new Error('Could not delete the inventory record.');
  }
  for(const asset of category.assets){
    const before=oldAssets.get(asset.id);
    if(category.type==='counted'){
      if(!before){const {data,error}=await db.from('counted_items').insert({id:asset.id,category_id:category.id,name:asset.name,quantity:asset.quantity,minimum_quantity:asset.min,target_quantity:asset.target,location:asset.location||'',image_path:asset.imagePath||null}).select('version').single();if(error)throw new Error('Could not create the counted item.');asset.version=data.version;continue;}
      let version=before.version||1;
      if(asset.quantity!==before.quantity){const {data,error}=await db.rpc('adjust_counted_quantity',{p_item_id:asset.id,p_delta:asset.quantity-before.quantity,p_expected_version:version});if(error)throw new Error('This count changed elsewhere or the new quantity is invalid. Reload before trying again.');version=data.version;}
      const metadataChanged=['name','min','target','location','imagePath'].some(key=>asset[key]!==before[key]);
      if(metadataChanged){const {data,error}=await db.rpc('update_counted_item_details',{p_item_id:asset.id,p_expected_version:version,p_name:asset.name,p_minimum_quantity:asset.min,p_target_quantity:asset.target,p_location:asset.location||'',p_image_path:asset.imagePath||null});if(error)throw new Error('This item changed elsewhere or its details are invalid. Reload before trying again.');version=data.version;}
      asset.version=version;
    } else {
      const beforeValues=before?.values||{}; const values=asset.values||{};
      if(!before){const {data,error}=await db.from('tracked_records').insert({id:asset.id,category_id:category.id,status:asset.status,assignment_note:asset.context||''}).select('version').single();if(error)throw new Error('Could not create the tracked record.');asset.version=data.version;}
      else if(asset.status!==before.status||asset.context!==before.context){const {data,error}=await db.from('tracked_records').update({status:asset.status,assignment_note:asset.context||'',version:(before.version||1)+1}).eq('id',asset.id).eq('version',before.version||1).select('version').maybeSingle();if(error||!data)throw new Error('This record changed elsewhere. Reload it before trying again.');asset.version=data.version;}
      for(const [fieldId,value] of Object.entries(values)){if(value===beforeValues[fieldId])continue;const existing=await db.from('tracked_record_values').select('id').eq('tracked_record_id',asset.id).eq('field_id',fieldId).maybeSingle();if(existing.error)throw new Error('Could not check the tracked fields.');const result=existing.data?await db.from('tracked_record_values').update({value:String(value)}).eq('id',existing.data.id):await db.from('tracked_record_values').insert({tracked_record_id:asset.id,field_id:fieldId,value:String(value)});if(result.error)throw new Error('A tracked field value is invalid or no longer available.');}
      for(const fieldId of Object.keys(beforeValues))if(!(fieldId in values)){const {error}=await db.from('tracked_record_values').delete().eq('tracked_record_id',asset.id).eq('field_id',fieldId);if(error)throw new Error('Could not remove a tracked field value.');}
    }
  }
}

async function syncActivity(db,oldEvent,event,userId) {
  const old=new Set(oldEvent.notifications.map(item=>item.id));
  for(const item of event.notifications){
    if(!old.has(item.id)){
      const {error}=await db.from('activity_entries').insert({id:item.id,event_id:event.id,actor_id:item.actorId||userId,kind:item.kind,title:item.title,detail:item.detail||''});
      if(error)throw new Error('The change could not be written to the activity ledger.');
    }
    const wasRead=oldEvent.notifications.find(previous=>previous.id===item.id)?.unread===false;
    if(!item.unread&&!wasRead){const {error}=await db.from('notification_read_state').upsert({notification_id:item.id,user_id:userId},{onConflict:'notification_id,user_id'});if(error)throw new Error('Could not update notification status.');}
  }
}
