import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import logo from './assets/logo-dark.png';
import avatar from './assets/avatar.jpg';
import sheeeshhhEmote from './assets/sheeeshhh.png';
import sheeeshhhSound from './assets/sheesh-mpl-echo-ph.mp3';
import {dbList,dbInsert,dbUpdate,dbUpsert,dbDelete,supabaseConfig,supabase,checkSupabaseSetup} from './supabase';

const DEFAULTS={admin:{name:'Bastaoang Jayson A',password:'webinternDEV'},hostPassword:'BSIT',userPassword:'CRT-NEUST-GSC'};
const REMOTE_AUDIO_VOLUME=1.0;
const defaultRooms=[];
const mapRoom=r=>({id:r.id,title:r.title,host:r.host,participants:r.participants,active:r.active,createdAt:r.created_at});
const mapAttendance=a=>({id:a.id,name:a.name,role:a.role,roomId:a.room_id,roomTitle:a.room_title,host:a.host,joinedAt:a.joined_at,leftAt:a.left_at,duration:a.duration});
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
function App(){
 const [role,setRole]=useState(null),[page,setPage]=useState('entry'),[name,setName]=useState(''),[password,setPassword]=useState(''),[rooms,setRooms]=useState(()=>read('wid_rooms',defaultRooms)),[currentRoom,setCurrentRoom]=useState(null),[camera,setCamera]=useState(false),[mic,setMic]=useState(true),[sharing,setSharing]=useState(false),[pinned,setPinned]=useState(false),[toast,setToast]=useState('');
 const [adminView,setAdminView]=useState(null);
 const [syncStatus,setSyncStatus]=useState('connecting');
 const [credentials,setCredentials]=useState(()=>read('wid_credentials',DEFAULTS));
 const [attendance,setAttendance]=useState(()=>read('wid_attendance',[]));
 const [knownUsers,setKnownUsers]=useState(()=>read('wid_users',[]));
 useEffect(()=>write('wid_rooms',rooms),[rooms]);
 useEffect(()=>write('wid_credentials',credentials),[credentials]);
 useEffect(()=>write('wid_attendance',attendance),[attendance]);
 useEffect(()=>write('wid_users',knownUsers),[knownUsers]);
 useEffect(()=>{
   let cancelled=false;
   (async()=>{
     // Room visibility is the critical path. Do not let an optional table
     // (users, attendance, or settings) prevent the room list from loading.
     try{
       const rr=await dbList('wid_rooms','?select=*&active=eq.true&order=created_at.desc');
       if(cancelled)return;
       setRooms(Array.isArray(rr)?rr.map(mapRoom):[]);
       setSyncStatus('online');
     }catch(e){
       if(cancelled)return;
       setSyncStatus('error');
       console.error('Supabase room sync unavailable:',e);
     }

     // These are useful for the rest of the app, but must not block room
     // discovery when their tables have not been created yet.
     const optionalChecks=[
       ['users',()=>dbList('wid_users','?select=*')],
       ['attendance',()=>dbList('wid_attendance','?select=*&order=joined_at.desc')],
       ['settings',()=>dbList('wid_settings','?select=*&id=eq.1')]
     ];
     for(const [kind,load] of optionalChecks){
       try{
         const data=await load();
         if(cancelled) return;
         if(kind==='users'&&Array.isArray(data))setKnownUsers(data.map(u=>({name:u.name,role:u.role})));
         if(kind==='attendance'&&Array.isArray(data))setAttendance(data.map(mapAttendance));
         if(kind==='settings'&&Array.isArray(data)&&data[0])setCredentials(c=>({...c,hostPassword:data[0].host_password,userPassword:data[0].user_password}));
       }catch(e){
         console.warn(`Optional Supabase ${kind} sync unavailable:`,e.message);
       }
     }
   })();
   return()=>{cancelled=true};
 },[]);
 useEffect(()=>{
   let mounted=true;
   const channel=supabase.channel('wid-rooms-live')
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'wid_rooms'},payload=>{
       if(!mounted||!payload.new?.active)return;
       const next=mapRoom(payload.new);
       setRooms(prev=>prev.some(r=>r.id===next.id)?prev:[next,...prev]);
     })
     .on('postgres_changes',{event:'UPDATE',schema:'public',table:'wid_rooms'},payload=>{
       if(!mounted)return;
       const next=payload.new?mapRoom(payload.new):null;
       if(!next)return;
       setRooms(prev=>next.active?prev.some(r=>r.id===next.id)?prev.map(r=>r.id===next.id?next:r):[next,...prev]:prev.filter(r=>r.id!==next.id));
     })
     .on('postgres_changes',{event:'DELETE',schema:'public',table:'wid_rooms'},payload=>{
       if(!mounted)return;
       if(payload.old?.id)setRooms(prev=>prev.filter(r=>r.id!==payload.old.id));
     })
     .subscribe(status=>{
       if(!mounted)return;
       // Realtime subscription status is separate from REST/database sync.
       // A realtime connection alone must not make the dashboard claim that
       // rooms are available when the REST table is missing or blocked.
       if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Room realtime subscription:',status);
     });
   return()=>{mounted=false;supabase.removeChannel(channel)};
 },[]);
 useEffect(()=>{
   if(!role || page==='meeting') return;
   let cancelled=false;
   const refresh=async()=>{
     try{
       const rr=await dbList('wid_rooms','?select=*&active=eq.true&order=created_at.desc');
       if(!cancelled&&Array.isArray(rr)){setSyncStatus('online');setRooms(rr.map(mapRoom));}
     }catch(e){if(!cancelled){setSyncStatus('error');console.warn('Room refresh failed:',e.message)}}
   };
   refresh();
   const timer=setInterval(refresh,3000);
   return()=>{cancelled=true;clearInterval(timer)};
 },[role,page]);
 useEffect(()=>{
   if(!attendance.length)return;
   const a=attendance[attendance.length-1];
   (async()=>{try{await dbUpsert('wid_attendance',{id:a.id,name:a.name,role:a.role,room_id:a.roomId,room_title:a.roomTitle,host:a.host,joined_at:a.joinedAt,left_at:a.leftAt,duration:a.duration})}catch(e){console.warn('Attendance sync:',e.message)}})();
 },[attendance]);
 useEffect(()=>{
   if(!knownUsers.length)return;
   const u=knownUsers[knownUsers.length-1];
   (async()=>{try{await dbUpsert('wid_users',{name:u.name,role:u.role})}catch(e){console.warn('User sync:',e.message)}})();
 },[knownUsers]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t)}},[toast]);
 const activeRooms=useMemo(()=>rooms.filter(r=>r.active),[rooms]);
 function enterRole(r){setRole(r);setPage('login');setName('');setPassword('');setAdminView(null)}
 function login(e){e.preventDefault();
   const ok=role==='admin'?(name.trim()===credentials.admin.name&&password===credentials.admin.password):(role==='host'?password===credentials.hostPassword:password===credentials.userPassword);
   if(!ok){setToast('Invalid name or password.');return}
   if(role!=='admin'){
     const clean=name.trim();
     setKnownUsers(list=>list.some(u=>u.name===clean&&u.role===role)?list:list.concat({name:clean,role}));
   }
   setPage('dashboard');setToast(`Welcome to WebInternDev, ${name || role}!`)
 }
 async function createRoom(){
   if(activeRooms.length>=2){setToast('Maximum of 2 active meeting rooms has been reached.');return}
   const title=window.prompt('Meeting title:','Web Development Class');
   if(!title?.trim())return;
   const id=crypto.randomUUID();
   const createdAt=new Date().toISOString();
   try{
     const rows=await dbInsert('wid_rooms',{id,title:title.trim(),host:name,participants:0,active:true,created_at:createdAt});
     const saved=Array.isArray(rows)&&rows[0]?mapRoom(rows[0]):{id,title:title.trim(),host:name,participants:0,active:true,createdAt};
     setRooms(prev=>[saved,...prev.filter(r=>r.id!==saved.id)]);
     setSyncStatus('online');
     setToast('Meeting created. It is now available to Users.');
   }catch(e){
     setSyncStatus('error');
     setToast(`Meeting was NOT published: ${e.message}`);
     console.error('createRoom failed',e);
   }
 }
 async function joinRoom(room){
   if(!room?.id){setToast('This meeting has no valid room ID. Please refresh the meeting list.');return}
   if(role==='user'&&Number(room.participants||0)>=50){setToast('This meeting is full.');return}
   const nextParticipants=role==='user'?Math.min(50,Number(room.participants||0)+1):Number(room.participants||0);

   // Never block the actual LiveKit join on a participant-count database update.
   // The room itself is already known to exist; entering the meeting should remain
   // possible even if Supabase briefly rejects the counter update.
   setCurrentRoom({...room,participants:nextParticipants});
   setPage('meeting');
   const now=new Date().toISOString();
   setAttendance(a=>a.concat({id:crypto.randomUUID(),name,role,roomId:room.id,roomTitle:room.title,host:room.host,joinedAt:now,leftAt:null,duration:null}));
   setRooms(x=>x.map(r=>r.id===room.id?{...r,participants:nextParticipants}:r));

   if(role==='user'){
     try{
       await dbUpdate('wid_rooms',`?id=eq.${encodeURIComponent(room.id)}`,{participants:nextParticipants});
     }catch(e){
       console.warn('Participant count update failed after joining; keeping meeting access:',e);
       setToast?.('You joined the meeting. Participant count will sync when the connection is available.');
     }
   }
 }
 async function leaveMeeting(){if(!currentRoom)return; const now=new Date(); const nextParticipants=role==='user'?Math.max(0,Number(currentRoom.participants||0)-1):Number(currentRoom.participants||0); try{if(role==='user')await dbUpdate('wid_rooms',`?id=eq.${encodeURIComponent(currentRoom.id)}`,{participants:nextParticipants});}catch(e){setToast(`Could not update the meeting online: ${e.message}`);return} setAttendance(a=>a.map(x=>{if(x.name===name&&x.roomId===currentRoom.id&&!x.leftAt){const joined=new Date(x.joinedAt);return {...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-joined)/60000))}}return x})); setRooms(x=>x.map(r=>r.id===currentRoom.id?{...r,participants:nextParticipants}:r));setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false);setToast('You left the meeting. You can rejoin while it is active.')}
 async function endRoom(){if(!currentRoom)return; const now=new Date();setAttendance(a=>a.map(x=>x.roomId===currentRoom.id&&!x.leftAt?{...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-new Date(x.joinedAt))/60000))}:x));try{await dbUpdate('wid_rooms',`?id=eq.${currentRoom.id}`,{active:false,participants:0});setRooms(x=>x.filter(r=>r.id!==currentRoom.id));setToast('Meeting ended.')}catch(e){setToast(`Could not end meeting online: ${e.message}`);return}setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false)}
 async function adminEnd(room){try{await dbUpdate('wid_rooms',`?id=eq.${room.id}`,{active:false,participants:0});setRooms(x=>x.filter(r=>r.id!==room.id));setAttendance(a=>a.map(x=>x.roomId===room.id&&!x.leftAt?{...x,leftAt:new Date().toISOString()}:x));setToast(`${room.title} ended.`)}catch(e){setToast(`Could not end meeting online: ${e.message}`)}}
 function signOut(){setRole(null);setPage('entry');setName('');setPassword('');setCurrentRoom(null);setAdminView(null)}
 return <div className="app">
  <header className="topbar"><button className="brand" onClick={()=>{setPage(role?'dashboard':'entry');setAdminView(null)}}><img src={logo}/><span>WebInternDev</span></button>{role&&<div className="top-actions"><span className="role-pill">{role==='admin'?'Admin':role==='host'?'Host':'User'}</span><button className="ghost" onClick={signOut}>Sign out</button></div>}</header>
  <main>
   {page==='entry'&&<Entry onSelect={enterRole}/>}
   {page==='login'&&<Login role={role} name={name} setName={setName} password={password} setPassword={setPassword} onSubmit={login} onBack={()=>setPage('entry')}/>} 
   {page==='dashboard'&&<Dashboard role={role} name={name} rooms={activeRooms} setRooms={setRooms} syncStatus={syncStatus} onCreate={createRoom} onJoin={joinRoom} onEnd={adminEnd} onOpenAdmin={setAdminView} adminView={adminView} credentials={credentials} setCredentials={setCredentials} attendance={attendance} setAttendance={setAttendance} users={knownUsers} setUsers={setKnownUsers} toast={setToast}/>} 
   {page==='meeting'&&<Meeting role={role} name={name} room={currentRoom} avatar={avatar} setToast={setToast} camera={camera} mic={mic} sharing={sharing} pinned={pinned} setCamera={setCamera} setMic={setMic} setSharing={setSharing} setPinned={setPinned} onLeave={leaveMeeting} onEnd={endRoom}/>} 
  </main>{toast&&<div className="toast">{toast}</div>}<footer>WebInternDev • Responsive meeting platform</footer>
 </div>
}
function Entry({onSelect}){return <section className="hero"><div className="hero-card entry-card"><div className="hero-brand-wrap"><img className="hero-logo" src={logo}/></div><div className="entry-intro"><span className="entry-kicker">SECURE • SIMPLE • CONNECTED</span><h1>How do you want to enter?</h1><p>Select your role to continue to WebInternDev.</p></div><div className="role-grid"><RoleCard title="Admin" desc="Monitor meetings and manage the platform" onClick={()=>onSelect('admin')} icon="admin"/><RoleCard title="Host" desc="Create meetings and share your screen" onClick={()=>onSelect('host')} icon="host"/><RoleCard title="User" desc="Join an active meeting and collaborate" onClick={()=>onSelect('user')} icon="user"/></div><div className="entry-footer"><span>WebInternDev</span><span>Professional meeting workspace</span></div></div></section>}
function RoleCard({title,desc,onClick,icon}){const paths={admin:<><path d="M4 19.5V9.8L12 5l8 4.8v9.7"/><path d="M8 19.5v-6h8v6M3 19.5h18M9 9.5h6"/></>,host:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 9 5 3-5 3V9ZM16 9h2M16 12h2M16 15h2"/></>,user:<><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"/></>};return <button className="role-card" onClick={onClick}><span className="role-icon"><svg viewBox="0 0 24 24">{paths[icon]}</svg></span><span>{title}</span><small>{desc}</small><strong>Continue <i>→</i></strong></button>}
function Login({role,name,setName,password,setPassword,onSubmit,onBack}){return <section className="center"><div className="panel login-panel"><div className="login-mark">{role==='admin'?'A':role==='host'?'H':'U'}</div><h1>{role==='admin'?'Admin Login':role==='host'?'Host Login':'User Login'}</h1><p className="muted">{role==='admin'?'Use the administrator account.':'Enter your name and shared role password.'}</p><form onSubmit={onSubmit}><label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder={role==='admin'?'Bastaoang Jayson A':'Enter your name'} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/></label><button className="primary wide">Continue</button></form><button className="link-btn" onClick={onBack}>← Back</button></div></section>}
function Dashboard({role,name,rooms,setRooms,syncStatus,onCreate,onJoin,onEnd,onOpenAdmin,adminView,credentials,setCredentials,attendance,setAttendance,users,setUsers,toast}){
 const [selectedRoom,setSelectedRoom]=useState(null);
 const [setup,setSetup]=useState(null);
 const [checking,setChecking]=useState(false);
 const runSetupCheck=async()=>{setChecking(true);try{const result=await checkSupabaseSetup();setSetup(result);if(result.ok)toast('Supabase setup check passed.');else toast(result.summary)}catch(e){setSetup({ok:false,env:[],tables:[],summary:e?.message||'Setup check failed.'});toast('Supabase setup check failed.')}finally{setChecking(false)}};
 useEffect(()=>{if(syncStatus==='error'&&!setup)runSetupCheck()},[syncStatus]);
 return <section className="dashboard"><div className="welcome"><div><span className="eyebrow">Welcome to WebInternDev!</span><h1>{name||role}</h1><p className="muted">{role==='admin'?'Monitor and manage your meeting platform.':role==='host'?'Create a room and present to up to 50 participants.':'Choose an active meeting to join.'}</p></div>{role==='host'&&<button className="primary" onClick={onCreate}>＋ Create Meeting</button>}</div>
 {setup&&<SupabaseSetupChecker result={setup} checking={checking} onCheck={runSetupCheck}/>}
 {role==='admin'&&<div className="stats"><Stat n={rooms.length} t="Active Meetings"/><Stat n={rooms.reduce((a,r)=>a+r.participants,0)} t="Participants"/><Stat n="50" t="Capacity / Room"/><Stat n="2" t="Room Limit"/></div>}
 <div className="section-head"><h2>{role==='admin'?'Active Meetings':'Available Meetings'}</h2><span>{rooms.length}/2 active • {syncStatus==='online'?'● Online sync':syncStatus==='connecting'?'Connecting…':'⚠ Sync error'}</span></div><div className="room-actions"><button className="ghost small" onClick={async()=>{try{const rr=await dbList('wid_rooms','?select=*&active=eq.true&order=created_at.desc');setRooms(rr.map(mapRoom));setSyncStatus('online');setToast('Meeting list refreshed.')}catch(e){setSyncStatus('error');setSetup(null);setToast('Refresh failed. Running the Supabase setup checker…');setTimeout(runSetupCheck,50)}}}>↻ Refresh meetings</button><button className="ghost small" onClick={runSetupCheck} disabled={checking}>{checking?'Checking…':'⚙ Check Supabase setup'}</button></div><div className="room-grid">{rooms.length?rooms.map(r=><RoomCard key={r.id} room={r} role={role} onJoin={()=>{setSelectedRoom(r);onJoin(r)}} onEnd={()=>onEnd(r)}/>):<div className="empty"><b>No active meetings</b><p>{role==='host'?'Create your first meeting to get started.':'Wait for a Host to create a meeting.'}</p></div>}</div>
 {role==='admin'&&<><div className="section-head"><h2>Admin controls</h2></div><div className="control-grid"><AdminControl title="User Management" icon="users" desc="View users who have entered WebInternDev and manage their access." onClick={()=>onOpenAdmin('users')}/><AdminControl title="Password Management" icon="lock" desc="Change the Host and User shared passwords." onClick={()=>onOpenAdmin('passwords')}/><AdminControl title="Attendance" icon="calendar" desc="View join time, leave time, duration, room and participant history." onClick={()=>onOpenAdmin('attendance')}/></div>{adminView&&<AdminPanel view={adminView} close={()=>onOpenAdmin(null)} credentials={credentials} setCredentials={setCredentials} attendance={attendance} setAttendance={setAttendance} users={users} setUsers={setUsers} toast={toast}/>}</>}
 </section>
}
function SupabaseSetupChecker({result,checking,onCheck}){
 const statusLabel=s=>s==='ok'?'OK':s==='missing'?'MISSING':s==='rls'?'RLS BLOCKED':s==='network'?'NETWORK ERROR':'ERROR';
 return <div className={`setup-checker ${result.ok?'setup-ok':'setup-fail'}`}>
   <div className="setup-checker-head"><div><span className="eyebrow">Supabase Setup Checker</span><h2>{result.ok?'Room sharing is ready':'Room sharing needs attention'}</h2><p>{result.summary}</p></div><button className="ghost small" onClick={onCheck} disabled={checking}>{checking?'Checking…':'Run check again'}</button></div>
   <div className="setup-grid">
    <div className="setup-card"><b>Supabase connection</b>{result.env.map(item=><div className="setup-row" key={item.name}><span className={item.configured?'setup-dot ok':item.fallback?'setup-dot warn':'setup-dot fail'}>●</span><div><strong>{item.name}</strong><small>{item.value}</small></div></div>)}</div>
    <div className="setup-card"><b>Room-sharing database tables</b>{result.tables.map(item=><div className="setup-row" key={item.table}><span className={item.status==='ok'?'setup-dot ok':'setup-dot fail'}>●</span><div><strong>public.{item.table}</strong><small>{statusLabel(item.status)} — {item.detail}</small></div></div>)}</div>
   </div>
   {!result.ok&&<div className="setup-next"><strong>What to do:</strong> Open Supabase → SQL Editor → run the project's <code>supabase_schema.sql</code>. If <b>public.wid_rooms</b> says MISSING, run <code>supabase_schema.sql</code>. If it says <b>RLS BLOCKED</b>, check its policies. The built-in Supabase fallback can work, but Vercel environment variables are recommended for production.</div>}
   {result.ok&&<div className="setup-next setup-next-good">✓ public.wid_rooms is reachable. A Host-created active room will be visible to Users on the same deployment.</div>}
 </div>
}
function AdminControl({title,desc,onClick,icon}){return <button className="admin-control" onClick={onClick}><span className="admin-control-icon">{icon==='users'?'◎':icon==='lock'?'⌑':'▣'}</span><span><b>{title}</b><small>{desc}</small></span><strong>Open →</strong></button>}
function AdminPanel({view,close,credentials,setCredentials,attendance,setAttendance,users,setUsers,toast}){
 const [hostPwd,setHostPwd]=useState(credentials.hostPassword),[userPwd,setUserPwd]=useState(credentials.userPassword);
 const savePasswords=async()=>{if(!hostPwd.trim()||!userPwd.trim()){toast('Passwords cannot be empty.');return}setCredentials(c=>({...c,hostPassword:hostPwd,userPassword:userPwd}));try{await dbUpsert('wid_settings',{id:1,host_password:hostPwd,user_password:userPwd,updated_at:new Date().toISOString()});toast('Host and User passwords updated online.');close()}catch(e){toast('Saved locally, but Supabase update failed. Run supabase_schema.sql and check RLS.')}};
 const removeUser=(idx)=>{const u=users[idx];setUsers(list=>list.filter((_,i)=>i!==idx));toast(`${u.name} removed from the local user list.`)};
 const deleteAttendance=async(id)=>{try{await dbDelete('wid_attendance',`?id=eq.${encodeURIComponent(id)}`);setAttendance(list=>list.filter(x=>x.id!==id));toast?.('Call history entry deleted.')}catch(e){toast?.(`Could not delete call history: ${e.message}`)}};
 const clearAttendance=async()=>{if(!window.confirm('Delete all call and attendance history? This cannot be undone.'))return;try{await dbDelete('wid_attendance','?id=not.is.null');setAttendance([]);toast?.('All call history deleted.')}catch(e){toast?.(`Could not clear call history: ${e.message}`)}};
 return <div className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">Admin Control</span><h2>{view==='users'?'User Management':view==='passwords'?'Password Management':'Attendance'}</h2></div><button className="ghost" onClick={close}>Close</button></div>
 {view==='users'&&<div className="table-wrap">{users.length?<table><thead><tr><th>Name</th><th>Role</th><th>Access</th><th></th></tr></thead><tbody>{users.map((u,i)=><tr key={`${u.name}-${u.role}-${i}`}><td>{u.name}</td><td>{u.role}</td><td><span className="status">Active</span></td><td><button className="danger small" onClick={()=>removeUser(i)}>Remove</button></td></tr>)}</tbody></table>:<div className="empty"><b>No users recorded yet.</b><p>A Host or User will appear here after entering the platform.</p></div>}</div>}
 {view==='passwords'&&<div className="password-grid"><label>Host password<input type="password" value={hostPwd} onChange={e=>setHostPwd(e.target.value)}/></label><label>User password<input type="password" value={userPwd} onChange={e=>setUserPwd(e.target.value)}/></label><div className="panel-actions"><button className="primary" onClick={savePasswords}>Save Passwords</button><button className="ghost" onClick={()=>{setHostPwd(DEFAULTS.hostPassword);setUserPwd(DEFAULTS.userPassword)}}>Reset defaults</button></div></div>}
 {view==='attendance'&&<div className="table-wrap"><div className="history-actions"><b>Call & Attendance History</b>{attendance.length>0&&<button className="danger small" onClick={clearAttendance}>Clear all history</button>}</div>{attendance.length?<table><thead><tr><th>Name</th><th>Role</th><th>Meeting</th><th>Joined</th><th>Left</th><th>Duration</th><th>Action</th></tr></thead><tbody>{attendance.slice().reverse().map(a=><tr key={a.id}><td>{a.name}</td><td>{a.role}</td><td>{a.roomTitle}</td><td>{formatDate(a.joinedAt)}</td><td>{a.leftAt?formatDate(a.leftAt):<span className="status">In meeting</span>}</td><td>{a.duration!=null?`${a.duration} min`:'—'}</td><td><button className="danger small" onClick={()=>deleteAttendance(a.id)}>Delete</button></td></tr>)}</tbody></table>:<div className="empty"><b>No call history yet.</b><p>Call and attendance history is recorded when a Host or User joins a meeting.</p></div>}</div>}
 </div>
}
function formatDate(v){return new Date(v).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}
function Stat({n,t}){return <div className="stat"><strong>{n}</strong><span>{t}</span></div>}
function RoomCard({room,role,onJoin,onEnd}){return <div className="room-card"><div className="room-top"><span className="live">● LIVE</span><span>{room.participants}/50</span></div><h3>{room.title}</h3><p className="muted">Host: {room.host}</p><div className="room-actions">{role==='admin'?<><button className="primary" onClick={onJoin}>Join Room</button><button className="danger" onClick={onEnd}>End Meeting</button></>:<button className="primary" onClick={onJoin}>{role==='host'?'Open Meeting':'Join Meeting'}</button>}</div></div>}
function MeetingIcon({type}){
 const paths={
  mic:<><rect x="8" y="3.5" width="8" height="12" rx="4"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22M8.5 22h7"/></>,
  mute:<><rect x="8" y="3.5" width="8" height="12" rx="4"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22M8.5 22h7M4 4l16 16"/></>,
  camera:<><rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></>,
  cameraOff:<><rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="m16 10 5-3v10l-5-3zM4 4l16 16"/></>,
  screen:<><rect x="3" y="4.5" width="18" height="12" rx="1.8"/><path d="M12 16.5V20M8.5 20h7"/></>,
  stopScreen:<><rect x="3" y="4.5" width="18" height="12" rx="1.8"/><path d="M8 9h8v5H8zM12 16.5V20M8.5 20h7"/></>,
  pin:<><path d="m15 3 6 6-3 1-3 5 1.5 1.5-2 2-1.5-1.5-5 3-1-3 5-5-1-3z"/><path d="m4 20 5-5"/></>,
  chat:<><path d="M4 5.5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3.1a2 2 0 0 1-3-1.9v-8a2 2 0 0 1 2-2z"/><path d="M7 11.5h.01M12 11.5h.01M17 11.5h.01"/></>,
  people:<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.5-4.7 5.5-4.7s4.9 1.7 5.5 4.7"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17 14.5c2.1.6 3.4 2 3.8 4.5"/></>,
  react:<><circle cx="12" cy="12" r="8.5"/><path d="M8.7 10h.01M15.3 10h.01M8.2 14.4c1.2 1.4 2.5 2 3.8 2s2.6-.6 3.8-2"/><path d="M5.8 4.8 4.5 3.5M18.2 4.8l1.3-1.3"/></>,
  end:<><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></>,
  leave:<><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M13 8l4 4-4 4M8 12h9"/></>,
  fitScreen:<><rect x="5" y="5" width="11" height="13" rx="1.5"/><rect x="8" y="2" width="11" height="13" rx="1.5"/></>,
  fullscreen:<><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></>,
  fullscreenExit:<><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/></>,
 };
 return <svg className="meeting-icon-svg" viewBox="0 0 24 24" aria-hidden="true">{paths[type]||paths.people}</svg>;
}

function Meeting({role,name,room,avatar,camera,mic,sharing,pinned,setCamera,setMic,setSharing,setPinned,onLeave,onEnd,setToast}){
 const [connection,setConnection]=useState('connecting');
 const [participants,setParticipants]=useState([]);
 const [localTracks,setLocalTracks]=useState([]);
 const [screenTrack,setScreenTrack]=useState(null);
 const [remoteScreenTrack,setRemoteScreenTrack]=useState(null);
 const [screenAspect,setScreenAspect]=useState(16/9);
 const [screenFullscreen,setScreenFullscreen]=useState(false);
 const [screenEpoch,setScreenEpoch]=useState(0);
 const [chat,setChat]=useState([]);
 const [message,setMessage]=useState('');
 const [micError,setMicError]=useState('');
 const [chatReady,setChatReady]=useState(false);
 const [chatError,setChatError]=useState('');
 const [reactionPicker,setReactionPicker]=useState(false);
 const [reactions,setReactions]=useState([]);
 const [interactivePicker,setInteractivePicker]=useState(false);
 const [interactiveEffects,setInteractiveEffects]=useState([]);
 const [emoteCooldown,setEmoteCooldown]=useState(0);
 const emoteCooldownTimerRef=useRef(null);
 const remoteEmoteCooldownRef=useRef(new Map());
  const liveRoomRef=useRef(null);
 const chatEndRef=useRef(null);
 const seenChatIdsRef=useRef(new Set());
 const seenInteractiveIdsRef=useRef(new Set());
 const mounted=useRef(true);
 const screenTrackRef=useRef(null);
 const mainTileRef=useRef(null);
 const resetScreenView=()=>{
   // Fully clear both local and remote references. This is important when a
   // screen-share track is stopped and then started again: LiveKit may deliver
   // publication events asynchronously, so simply hiding the old video can
   // leave a stale black frame behind.
   setPinned(false);
   setSharing(false);
   screenTrackRef.current=null;
   setScreenTrack(null);
   setRemoteScreenTrack(null);
   setScreenAspect(16/9);
   setScreenEpoch(v=>v+1);
 };
 const isUsableScreenTrack=(track)=>{
   if(!track)return false;
   const media=track.mediaStreamTrack;
   return !media || media.readyState!=='ended';
 };
 const wsUrlHint=import.meta.env.VITE_LIVEKIT_URL || '';
 const MICROPHONE_CAPTURE_OPTIONS={echoCancellation:true,noiseSuppression:true,autoGainControl:false,channelCount:1,latency:0.02};

 useEffect(()=>{
   mounted.current=true;
   let liveRoom;
   const connect=async()=>{
     try{
       const resp=await fetch('/api/livekit-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:room.id,participantName:name,role})});
       const data=await resp.json();
       if(!resp.ok) throw new Error(data.error||data.detail||`Token endpoint returned HTTP ${resp.status}.`);
       const {Room,RoomEvent}=await import('livekit-client');
       liveRoom=new Room({adaptiveStream:false,dynacast:false,autoSubscribe:true});
       liveRoomRef.current=liveRoom;
       const refresh=()=>{
         if(!mounted.current)return;
         const list=[];
         let activeRemoteScreen=null;
         liveRoom.remoteParticipants.forEach(p=>{
           try{p.setVolume?.(REMOTE_AUDIO_VOLUME)}catch{}
           const screenPub=Array.from(p.videoTrackPublications?.values?.()||[]).find(pub=>
             (pub.source==='screen_share' || pub.source==='screenShare') && pub.track
           );
           if(screenPub?.track && isUsableScreenTrack(screenPub.track)) {
             try { screenPub.setSubscribed?.(true); screenPub.setVideoQuality?.(2); } catch {}
             activeRemoteScreen=screenPub.track;
           }
           list.push(p);
         });
         setParticipants(list);
         setRemoteScreenTrack(activeRemoteScreen);
       };
       const setRemoteScreen=(track,publication,participant)=>{
         if(!mounted.current)return;
         const isScreen=publication?.source==='screen_share' || publication?.source==='screenShare';
         if(isScreen) {
           try { publication?.setSubscribed?.(true); publication?.setVideoQuality?.(2); } catch {}
           setRemoteScreenTrack(track || null);
           try{participant?.setVolume?.(REMOTE_AUDIO_VOLUME)}catch{}
         }
       };
       liveRoom.on(RoomEvent.ConnectionStateChanged,(state)=>setConnection(String(state).toLowerCase()));
       liveRoom.on(RoomEvent.ParticipantConnected,(participant)=>{
         refresh();
         try {
           let participantRole='user';
           if(participant?.metadata){
             try { participantRole=JSON.parse(participant.metadata)?.role || 'user'; } catch {}
           }
           if(participantRole==='admin'){
             setToast?.(`Admin ${participant?.name || participant?.identity || 'Admin'} is joining the meeting.`);
           }
         } catch {}
       });
       liveRoom.on(RoomEvent.ParticipantDisconnected,refresh);
       liveRoom.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>{
         setRemoteScreen(track,publication,participant);
         refresh();
       });
       liveRoom.on(RoomEvent.TrackSubscriptionFailed,(trackSid,participant)=>{
         console.warn('LiveKit track subscription failed:', trackSid, participant?.identity);
         setToast?.(`Could not receive audio/video from ${participant?.name || participant?.identity || 'participant'}.`);
       });
       liveRoom.on(RoomEvent.TrackPublished,async(publication,participant)=>{
         try {
           // Be explicit: every participant is allowed to subscribe to every
           // newly published microphone/camera/screen track. This protects
           // against browsers/devices that don't complete the automatic
           // subscription quickly enough.
           if (publication && !publication.isSubscribed) await publication.setSubscribed(true);
           if (publication?.source==='screen_share' || publication?.source==='screenShare') {
             publication.setVideoQuality?.(2);
           }
         } catch(e) {
           console.warn('Could not subscribe to newly published track:', e);
         }
         if(publication?.source==='screen_share' || publication?.source==='screenShare') refresh();
       });
       liveRoom.on(RoomEvent.TrackUnpublished,(publication)=>{
         if(publication?.source==='screen_share' || publication?.source==='screenShare') {
           resetScreenView();
         }
         refresh();
       });
       liveRoom.on(RoomEvent.TrackUnsubscribed,(track,publication)=>{
         if(publication?.source==='screen_share' || publication?.source==='screenShare') {
           resetScreenView();
         }
         refresh();
       });
       // Camera mute/unmute does not always unpublish the track. Refreshing here
       // forces the tile to switch between live video and the avatar fallback.
       if(RoomEvent.TrackMuted) liveRoom.on(RoomEvent.TrackMuted,refresh);
       if(RoomEvent.TrackUnmuted) liveRoom.on(RoomEvent.TrackUnmuted,refresh);
       liveRoom.on(RoomEvent.LocalTrackPublished,refresh);
       liveRoom.on(RoomEvent.LocalTrackUnpublished,refresh);
       const appendChatMessage=(message,participant,local=false)=>{
         const text=typeof message==='string' ? message : (message?.message || message?.text || message?.content);
         const id=(typeof message==='object' && message?.id) ? message.id : crypto.randomUUID();
         if(typeof text!=='string' || !text.trim() || seenChatIdsRef.current.has(id)) return;
         seenChatIdsRef.current.add(id);
         const sender=local ? name : (participant?.name || participant?.identity || 'Participant');
         setChat(c=>c.concat({id,name:sender,text:text.trim(),local}));
       };
       liveRoom.on(RoomEvent.ChatMessage,(chatMessage,participant)=>{
         try{ appendChatMessage(chatMessage,participant,participant?.identity===liveRoom.localParticipant.identity); }
         catch(err){ console.warn('LiveKit chat event failed:',err); }
       });
       // Fallback for older LiveKit builds/tokens that do not expose chatMessage.
       liveRoom.on(RoomEvent.DataReceived,(payload,participant,kind,topic)=>{
         try{
           const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
           const msg=JSON.parse(text);
           if(topic==='system' && msg?.type==='admin_joining'){
             setToast?.(`Admin ${msg.name || 'Admin'} is joining the meeting.`);
             return;
           }
           // Accept reactions with or without a LiveKit topic for compatibility.
           if(msg?.type==='pin_state'){
             const isPinned=Boolean(msg.pinned);
             setPinned(isPinned);
             const hostName=msg.hostName || participant?.name || participant?.identity || 'Host';
             setToast?.(isPinned ? `${hostName} pinned the shared screen for everyone.` : `${hostName} unpinned the shared screen for everyone.`);
             return;
           }
           if(msg?.type==='reaction' && msg.emoji){
             const id=msg.id||crypto.randomUUID();
             setReactions(r=>r.some(x=>x.id===id)?r:r.concat({id,emoji:msg.emoji,name:participant?.name||participant?.identity||'Participant',seed:msg.seed||Math.random()}));
             setTimeout(()=>setReactions(r=>r.filter(x=>x.id!==id)),3600);
             return;
           }
           if(msg?.type==='interactive_emote' && msg.kind==='sheeeshhh'){
             const senderId=String(participant?.identity || msg.senderId || msg.targetId || '');
             const now=Date.now();
             const lastRemote=remoteEmoteCooldownRef.current.get(senderId)||0;
             // Also enforce the 5-second cooldown on received emotes so a participant
             // cannot flood everyone else's meeting view by bypassing the local button.
             if(senderId && now-lastRemote < 5000) return;
             if(senderId) remoteEmoteCooldownRef.current.set(senderId,now);
             const id=msg.id||crypto.randomUUID();
             // Render the effect on the sender's participant tile for everyone in the room.
             const targetId=String(msg.targetId || senderId || '');
             if(targetId){
               setInteractiveEffects(list=>list.some(x=>x.id===id)?list:list.concat({id,targetId,targetName:msg.targetName||participant?.name||participant?.identity||'Participant',kind:'sheeeshhh'}));
               playSheeeshhhSound();
               setTimeout(()=>setInteractiveEffects(list=>list.filter(x=>x.id!==id)),2600);
             }
             return;
           }
           if(topic && topic!=='chat') return;
           if(msg?.type==='chat' && typeof msg.text==='string') appendChatMessage({id:msg.id,message:msg.text},participant,false);
         }catch(err){ /* ignore non-chat data */ }
       });
       liveRoom.on(RoomEvent.LocalTrackPublished,()=>{ if(mounted.current) setChatReady(true); refresh(); });
       liveRoom.on(RoomEvent.LocalTrackUnpublished,refresh);
       liveRoom.on(RoomEvent.LocalTrackMuted,(publication)=>{
         if(mounted.current && publication?.source==='microphone') setMic(false);
         refresh();
       });
       liveRoom.on(RoomEvent.LocalTrackUnmuted,(publication)=>{
         if(mounted.current && publication?.source==='microphone') setMic(true);
         refresh();
       });
       await liveRoom.connect(data.url, data.token);
       setConnection('connected');
       if(role==='admin'){
         setToast?.(`Admin ${name} is joining the meeting.`);
         try {
           const notice=new TextEncoder().encode(JSON.stringify({type:'admin_joining',name}));
           await liveRoom.localParticipant.publishData(notice,{reliable:true,topic:'system'});
         } catch(e) { console.warn('Admin join notice could not be broadcast:',e); }
       }
       setChatReady(true);
       setChatError('');

       // Explicitly subscribe to already-published remote tracks. This is
       // especially important when a participant joins after someone has
       // already enabled their microphone.
       for (const participant of liveRoom.remoteParticipants.values()) {
         for (const publication of participant.trackPublications.values()) {
           try {
             if (!publication.isSubscribed) await publication.setSubscribed(true);
             if (publication?.source==='screen_share' || publication?.source==='screenShare') {
               publication.setVideoQuality?.(2);
             }
           } catch (e) {
             console.warn('Initial remote track subscription failed:', participant.identity, publication.source, e);
           }
         }
       }

       // Request microphone and camera independently. We explicitly verify that
       // an audio input exists before asking LiveKit to publish it.
       const tracks=[];
       try {
         if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not expose microphone access. Use HTTPS and a current browser.');
         const devices = await navigator.mediaDevices.enumerateDevices();
         if (!devices.some(d=>d.kind==='audioinput')) throw new Error('No microphone was detected. Connect or enable a microphone, then try again.');
         await liveRoom.localParticipant.setMicrophoneEnabled(true, MICROPHONE_CAPTURE_OPTIONS);
         const audioPub = Array.from(liveRoom.localParticipant.audioTrackPublications.values()).find(pub=>pub.track && (pub.source==='microphone' || pub.source==='mic'));
         if (!audioPub?.track) throw new Error('LiveKit connected, but the microphone track was not published.');
         if (audioPub.isMuted) await audioPub.setMuted(false);
         if (mounted.current) { setMic(true); setMicError(''); }
       } catch (e) {
         console.warn('Microphone could not be enabled:', e);
         if (mounted.current) { setMic(false); setMicError(e?.message || 'Microphone permission or device access failed.'); setToast?.('Microphone is off. Click Unmute and allow microphone access.'); }
       }
       try {
         await liveRoom.localParticipant.setCameraEnabled(Boolean(camera));
       } catch (e) {
         console.warn('Camera could not be enabled:', e);
         if (mounted.current) setCamera(false);
       }
       liveRoom.localParticipant.trackPublications.forEach(pub=>{
         if(pub.track) tracks.push(pub.track);
       });
       if(mounted.current)setLocalTracks(tracks);
       refresh();
     }catch(e){
       console.error(e);
       if(mounted.current)setConnection(`error:${e.message}`);
     }
   };
   connect();
   return()=>{
     mounted.current=false;
     if(liveRoom){try{liveRoom.disconnect()}catch{}}
     liveRoomRef.current=null;
     setLocalTracks([]);
     setScreenTrack(null);
   };
 },[room.id,name,role]);

 useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chat]);

 const toggleMic=async()=>{
   const r=liveRoomRef.current;
   if(!r){setToast?.('The meeting connection is not ready yet.');return;}
   const next=!mic;
   try {
     if(next){
       if(!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS and a supported browser.');
       const devices = await navigator.mediaDevices.enumerateDevices();
       if(!devices.some(d=>d.kind==='audioinput')) throw new Error('No microphone was detected. Connect a microphone and try again.');
     }
     const pub = await r.localParticipant.setMicrophoneEnabled(next, MICROPHONE_CAPTURE_OPTIONS);
     const audioPub = pub || Array.from(r.localParticipant.audioTrackPublications.values()).find(p=>p.track && (p.source==='microphone' || p.source==='mic'));
     if(next && !audioPub?.track) throw new Error('Microphone permission was granted, but LiveKit did not publish the audio track.');
     if(next && audioPub?.isMuted) await audioPub.setMuted(false);
     setMic(next);
     setMicError('');
     setToast?.(next?'Microphone enabled.':'Microphone muted.');
   } catch(e) {
     console.error('Microphone toggle failed:',e);
     setMic(false);
     setMicError(e?.message || 'Microphone permission or device access failed.');
     setToast?.(`Microphone could not be enabled: ${e?.message || 'check browser microphone permission.'}`);
   }
 };
 const toggleCamera=async()=>{
   const r=liveRoomRef.current;
   if(!r)return;
   const next=!camera;
   try {
     await r.localParticipant.setCameraEnabled(next);
     setCamera(next);
   } catch(e) {
     console.error('Camera toggle failed:',e);
     setCamera(false);
     setToast?.('Camera permission is unavailable. You can still use the microphone and chat.');
   }
 };
 const toggleScreen=async()=>{
   const r=liveRoomRef.current;
   if(!r||role!=='host')return;
   const next=!sharing;
   try{
     // Host-only screen sharing. Keep the capture request deliberately minimal
     // so Chrome/Edge can open the native monitor/window/tab chooser as quickly
     // as possible. The chooser itself is controlled by the browser/OS, not the app.
     if(next) setToast?.('Opening screen chooser… choose Entire screen or a different window/tab. This tab is blocked to prevent the recursive screen-sharing effect.');
     const captureOptions = next ? {
       contentHint:'detail',
       preferCurrentTab:false,
       selfBrowserSurface:'exclude',
       surfaceSwitching:'include',
       monitorTypeSurfaces:'include'
     } : undefined;
     const publication=await r.localParticipant.setScreenShareEnabled(
       next,
       captureOptions,
       next ? {
         source:'screen_share',
         simulcast:false,
         degradationPreference:'maintain-resolution',
         screenShareEncoding:{width:1920,height:1080,maxBitrate:8000000,maxFramerate:15}
       } : undefined
     );
     setSharing(next);
     if(!next){resetScreenView();}
     else {
       const pub=publication || Array.from(r.localParticipant.videoTrackPublications.values()).find(p=>p.source==='screen_share' && p.track);
       if(pub?.track){
         screenTrackRef.current=pub.track;
         setScreenTrack(pub.track);
         setRemoteScreenTrack(null);
         const media=pub.track.mediaStreamTrack;
         if(media){
           media.onended=()=>{
             if(mounted.current) resetScreenView();
           };
         }
       }
       else throw new Error('The browser did not publish a screen-share track.');
     }
   }catch(e){console.error('Screen-share toggle failed:',e);resetScreenView();setToast?.(`Screen sharing could not start: ${e?.message || 'check browser permission.'}`);}
 };
 const playSheeeshhhSound=()=>{
   try{
     const audio=new Audio(sheeeshhhSound);
     audio.preload='auto';audio.volume=0.9;audio.currentTime=0;
     const playPromise=audio.play();
     if(playPromise?.catch) playPromise.catch(()=>{});
   }catch{}
 };
 const startEmoteCooldown=()=>{
   if(emoteCooldownTimerRef.current) clearInterval(emoteCooldownTimerRef.current);
   const endAt=Date.now()+5000;
   const tick=()=>{
     const remaining=Math.max(0,endAt-Date.now());
     setEmoteCooldown(remaining);
     if(remaining<=0){
       clearInterval(emoteCooldownTimerRef.current);
       emoteCooldownTimerRef.current=null;
     }
   };
   tick();
   emoteCooldownTimerRef.current=setInterval(tick,100);
 };
 useEffect(()=>()=>{if(emoteCooldownTimerRef.current) clearInterval(emoteCooldownTimerRef.current);},[]);
 const sendInteractiveEmote=async()=>{
   if(emoteCooldown>0) return;
   const r=liveRoomRef.current;
   if(!r?.localParticipant || r.state!=='connected'){
     setToast?.('Emote is waiting for the meeting connection.');
     return;
   }
   startEmoteCooldown();
   const localId=String(r.localParticipant.identity||`local-${name}`);
   const id=crypto.randomUUID();
   const item={id,targetId:localId,targetName:name||'Participant',kind:'sheeeshhh'};
   setInteractiveEffects(list=>list.concat(item));
   playSheeeshhhSound();
   setTimeout(()=>setInteractiveEffects(list=>list.filter(x=>x.id!==id)),2600);
   const payload=new TextEncoder().encode(JSON.stringify({type:'interactive_emote',id,targetId:localId,targetName:name||'Participant',kind:'sheeeshhh',senderId:localId}));
   try{
     await r.localParticipant.publishData(payload,{reliable:true,topic:'interactive-emote'});
   }catch(firstError){
     try{await r.localParticipant.publishData(payload,{reliable:true});}
     catch(secondError){console.warn('Interactive emote broadcast failed',firstError,secondError);setToast?.('SHEEESHHH played here, but could not be sent to everyone.');}
   }
 };
 const broadcastPinState=async(nextPinned)=>{
   const r=liveRoomRef.current;
   setPinned(nextPinned);
   const hostName=name||'Host';
   setToast?.(nextPinned ? 'Shared screen pinned for everyone.' : 'Shared screen unpinned for everyone.');
   if(!r?.localParticipant || r.state!=='connected') return;
   const payload=new TextEncoder().encode(JSON.stringify({type:'pin_state',pinned:Boolean(nextPinned),hostName}));
   try{
     await r.localParticipant.publishData(payload,{reliable:true,topic:'meeting-state'});
   }catch(firstError){
     try{await r.localParticipant.publishData(payload,{reliable:true});}
     catch(secondError){console.warn('Pin state broadcast failed:',firstError,secondError);setToast?.('Pin changed on your screen, but could not be synchronized to everyone.');}
   }
 };
 const REACTIONS=['😀','😂','😍','😎','👏','👍','❤️','🔥','🎉','😮'];
 const sendReaction=async(emoji)=>{
   const r=liveRoomRef.current;
   const id=crypto.randomUUID();
   const seed=Math.random();
   const item={id,emoji,name,seed};
   setReactions(list=>list.some(x=>x.id===id)?list:list.concat(item));
   setTimeout(()=>setReactions(list=>list.filter(x=>x.id!==id)),3600);
   setReactionPicker(false);
   if(!r?.localParticipant){setToast?.('Reaction sent locally. Connecting to others…');return;}
   const payload=new TextEncoder().encode(JSON.stringify({type:'reaction',id,emoji,seed}));
   try{ await r.localParticipant.publishData(payload,{reliable:true,topic:'reaction'}); }
   catch(firstError){
     try{ await r.localParticipant.publishData(payload,{reliable:true}); }
     catch(secondError){console.warn('Reaction broadcast failed:',firstError,secondError);setToast?.('Reaction is visible here, but could not be sent to others.');}
   }
 };
 const INTERACTIVE_EMOTES=[{kind:'sheeeshhh',label:'SHEEESHHH',image:sheeeshhhEmote}];
 const selectedInteractive=INTERACTIVE_EMOTES[0];
 const sendChat=async(e)=>{
   e?.preventDefault();
   const text=message.trim();
   const r=liveRoomRef.current;
   if(!text)return;
   if(!r || r.state!=='connected'){setChatError('Chat is waiting for the meeting connection.');setToast?.('Chat is not connected yet.');return;}
   try {
     let sent;
     if(typeof r.localParticipant.sendChatMessage==='function'){
       sent=await r.localParticipant.sendChatMessage(text,{topic:'chat'});
     } else {
       const id=crypto.randomUUID();
       const data=new TextEncoder().encode(JSON.stringify({type:'chat',id,text}));
       await r.localParticipant.publishData(data,{reliable:true,topic:'chat'});
       sent={id,message:text};
     }
     const localText=typeof sent==='string' ? sent : (sent?.message || sent?.text || sent?.content || text);
     const localId=(typeof sent==='object' && sent?.id) ? sent.id : crypto.randomUUID();
     if (localText && !seenChatIdsRef.current.has(localId)) {
       seenChatIdsRef.current.add(localId);
       setChat(c=>c.concat({id:localId,name,text:localText.trim(),local:true}));
     }
     setMessage('');
     setChatError('');
   } catch(err) {
     console.error('Chat send failed:',err);
     setChatError(err?.message || 'Chat message could not be sent.');
     setToast?.(`Chat message could not be sent: ${err?.message || 'check the meeting connection.'}`);
   }
 };
 const trackForParticipant=(participant,source)=>{
   if(!participant)return null;
   const pubs=Array.from(participant.videoTrackPublications.values());
   return pubs.find(p=>p.source===source && p.track)?.track||null;
 };
 const allParticipants=[{local:true,participant:liveRoomRef.current?.localParticipant||null,name,role},...participants.map(p=>({local:false,participant:p,name:p.name||p.identity,role:p.metadata?(()=>{try{return JSON.parse(p.metadata).role}catch{return 'user'}})():'user'}))];
 const screenFromRemote=(isUsableScreenTrack(remoteScreenTrack)?remoteScreenTrack:null) || participants.map(p=>trackForParticipant(p,'screen_share')||trackForParticipant(p,'screenShare')).find(isUsableScreenTrack) || null;
 const mainScreen=isUsableScreenTrack(screenTrack)?screenTrack:screenFromRemote;
 const remoteScreenActive=Boolean(screenFromRemote);
 const showingScreen=Boolean(mainScreen);
 const toggleScreenFullscreen=()=>{
   // App fullscreen avoids the browser/Android instructional banner.
   setScreenFullscreen(v=>!v);
 };
 useEffect(()=>{
   const onKey=(event)=>{if(event.key==='Escape') setScreenFullscreen(false);};
   window.addEventListener('keydown',onKey);
   return()=>window.removeEventListener('keydown',onKey);
 },[]);
 return <section className="meeting">
   <div className="meeting-head"><div><b>{room.title}</b><span className="muted"> • {room.participants}/50</span></div><span className={connection==='connected'?'live':'connection-pill'}>{connection==='connected'?'● LIVE':connection==='connecting'?'Connecting…':connection.startsWith('error:')?'Connection error':'Reconnecting…'}</span></div>
   {connection.startsWith('error:')&&<div className="meeting-error">{connection.slice(6)}<button className="ghost small" onClick={()=>window.location.reload()}>Reload</button></div>}
   <div className={`stage ${pinned&&mainScreen?'pinned':''} ${showingScreen?'screen-active':''}`}>
     <div ref={mainTileRef} className={`main-tile ${screenFullscreen?'app-fullscreen':''}`} style={showingScreen?{'--screen-aspect':screenAspect}:undefined}>
       {showingScreen ? <LiveVideo key={`screen-${screenEpoch}-${mainScreen?.sid||mainScreen?.mediaStreamTrack?.id||'active'}`} track={mainScreen} className="screen-video" onAspectRatio={setScreenAspect} /> :
         <div key={`placeholder-${screenEpoch}`} className="screen-share-placeholder" role="status" aria-live="polite">
           <span>Screen Share</span>
         </div>
       }
       <div className="reaction-layer" aria-live="polite">{reactions.map((r,i)=><div className="floating-reaction" style={{left:`${8+((i*19+Math.floor((r.seed||0)*31))%82)}%`,animationDelay:`${(i%3)*65}ms`}} key={r.id} title={`${r.name}: ${r.emoji}`}><span className="reaction-glow"/><span className="reaction-ring"/><span className="reaction-particle p1"/><span className="reaction-particle p2"/><span className="reaction-particle p3"/><span className="reaction-emoji">{r.emoji}</span></div>)}</div>
       {showingScreen&&<button type="button" className="screen-fit-button" aria-label={screenFullscreen?'Exit full screen':'Full screen shared screen'} title={screenFullscreen?'Exit full screen':'Full screen'} onClick={toggleScreenFullscreen}><MeetingIcon type={screenFullscreen?'fullscreenExit':'fullscreen'}/></button>}
     </div>
     <div className="thumbs">{allParticipants.slice(0,10).map((p,i)=>{const targetId=String(p.participant?.identity||`local-${name}`);const effect=interactiveEffects.find(x=>x.targetId===targetId);return <ParticipantTile key={p.participant?.identity||`${p.name}-${i}`} item={p} avatar={avatar} localCameraEnabled={p.local ? camera : undefined} interactiveEffect={effect}/>})}</div>
   </div>
   <div className="remote-audio" aria-hidden="true">{participants.map(p=><RemoteAudio key={p.identity} participant={p}/>)}</div>
   {micError&&<div className="meeting-status-error">Microphone: {micError} <button className="ghost small" onClick={toggleMic}>Try microphone again</button></div>}
   <div className="audio-note">Remote participant audio playback is set to 100%. You can also use your phone/computer volume buttons.</div>
   <div className="meeting-bottom">
     <div className="meeting-controls">
       <button aria-label={mic?'Mute microphone':'Unmute microphone'} title={mic?'Mute microphone':'Unmute microphone'} className={mic?'control active is-mic':'control is-mic'} onClick={toggleMic}><span className="meeting-symbol"><MeetingIcon type={mic?'mic':'mute'}/></span><span>{mic?'Mute':'Unmute'}</span></button>
       <button aria-label={camera?'Turn camera off':'Turn camera on'} title={camera?'Turn camera off':'Turn camera on'} className={camera?'control active is-camera':'control is-camera'} onClick={toggleCamera}><span className="meeting-symbol"><MeetingIcon type={camera?'camera':'cameraOff'}/></span><span>Camera</span></button>
       {role==='host'&&<>
         <button aria-label={sharing?'Stop sharing screen':'Share screen'} title={sharing?'Stop sharing screen':'Share screen'} className={sharing?'control active is-sharing':'control is-sharing'} onClick={toggleScreen}><span className="meeting-symbol"><MeetingIcon type={sharing?'stopScreen':'screen'}/></span><span>{sharing?'Stop share':'Share'}</span></button>
         <button aria-label={pinned?'Unpin screen for everyone':'Pin screen for everyone'} title={pinned?'Unpin screen for everyone':'Pin screen for everyone'} disabled={!showingScreen} className={pinned?'control active':'control'} onClick={()=>broadcastPinState(!pinned)}><span className="meeting-symbol"><MeetingIcon type="pin"/></span><span>{pinned?'Unpin':'Pin'}</span></button>
       </>}
       <div className="reaction-control-wrap"><button aria-label="Send reaction" title="Reactions" className={reactionPicker?'control active react-open':'control react-open'} onClick={()=>{setReactionPicker(v=>!v);setInteractivePicker(false)}}><span className="meeting-symbol"><MeetingIcon type="react"/></span><span>React</span></button>{reactionPicker&&<div className="reaction-picker">{REACTIONS.map(emoji=><button type="button" key={emoji} onClick={()=>sendReaction(emoji)} aria-label={`Send ${emoji}`}>{emoji}</button>)}</div>}</div>
       <div className="interactive-control-wrap"><button type="button" aria-label={emoteCooldown>0?`SHEEESHHH cooldown ${Math.ceil(emoteCooldown/1000)} seconds`:'Play SHEEESHHH emote'} title={emoteCooldown>0?`Wait ${Math.ceil(emoteCooldown/1000)}s before using Emote again`:'Play SHEEESHHH'} disabled={emoteCooldown>0} className={`control interactive-open${emoteCooldown>0?' cooldown':''}`} onClick={(e)=>{e.stopPropagation();sendInteractiveEmote()}}><span className="meeting-symbol interactive-selected-icon"><img src={sheeeshhhEmote} alt="SHEEESHHH"/></span><span>{emoteCooldown>0?`Emote ${Math.ceil(emoteCooldown/1000)}s`:'Emote'}</span></button></div>
       <button aria-label="Open chat" title="Chat" className="control" onClick={()=>document.getElementById('chat-panel')?.classList.toggle('open')}><span className="meeting-symbol"><MeetingIcon type="chat"/></span><span>Chat</span></button>
       <button aria-label="Open participants" title="Participants" className="control" onClick={()=>document.getElementById('participants-panel')?.classList.toggle('open')}><span className="meeting-symbol"><MeetingIcon type="people"/></span><span>People</span></button>
       {role==='host'?<button aria-label="End meeting" title="End meeting" className="danger control end-control" onClick={onEnd}><span className="meeting-symbol"><MeetingIcon type="end"/></span><span>End</span></button>:<button aria-label="Leave meeting" title="Leave meeting" className="danger control end-control" onClick={onLeave}><span className="meeting-symbol"><MeetingIcon type="leave"/></span><span>Leave</span></button>}
     </div>
     {role==='host'&&<div className="host-note">Host controls: screen share + pin/unpin. Only the Host can share and pin the screen. Click Share to open the browser's native chooser: select an entire screen, an open window, or a browser tab. You can share a PDF, PowerPoint, Excel sheet, Word file, website, or any other content visible in the selected window/tab. The app uses a minimal capture request to avoid delaying the chooser; the browser/OS controls how quickly its native chooser appears.</div>}
   </div>
   <aside id="chat-panel" className="meeting-side-panel"><div className="side-head"><b>Chat</b><button onClick={()=>document.getElementById('chat-panel')?.classList.remove('open')}>×</button></div><div className="chat-list">{chat.length?chat.map(m=><div className={m.local?'chat-msg local':'chat-msg'} key={m.id}><b>{m.name}</b><span>{m.text}</span></div>):<p className="muted">{chatReady?'No messages yet.':'Connecting chat…'}</p>}<div ref={chatEndRef}/></div>{chatError&&<div className="chat-error">{chatError}</div>}<form className="chat-form" onSubmit={sendChat}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder={chatReady?'Type a message…':'Connecting chat…'} disabled={!chatReady}/><button className="primary" type="submit" disabled={!chatReady||!message.trim()}>Send</button></form></aside>
   <aside id="participants-panel" className="meeting-side-panel participants-panel"><div className="side-head"><b>Participants ({participants.length+1})</b><button onClick={()=>document.getElementById('participants-panel')?.classList.remove('open')}>×</button></div><div className="participant-list"><div className="participant-row"><img src={avatar}/><span>{name} <small>• {role}</small></span></div>{participants.map(p=><div className="participant-row" key={p.identity}><img src={avatar}/><span>{p.name||p.identity}</span></div>)}</div></aside>
 </section>
}
function RemoteAudio({participant}){
 const audioPubs=participant?Array.from(participant.audioTrackPublications?.values?.()||[]).filter(p=>p.track && (p.source==='microphone' || p.source==='mic')):[];
 return <>{audioPubs.map(pub=><AudioTrack key={`${participant.identity}-${pub.trackSid||pub.track?.sid||pub.source}`} track={pub.track}/>)}</>;
}
function AudioTrack({track}){
 const ref=useRef(null);
 useEffect(()=>{
   if(!track||!ref.current)return;
   try{track.setVolume?.(REMOTE_AUDIO_VOLUME)}catch{}
   const el=track.attach();
   el.autoplay=true;
   el.playsInline=true;
   el.volume=REMOTE_AUDIO_VOLUME;
   // Keep browser playback loud enough for normal speech without boosting beyond unity.
   el.muted=false;
   el.setAttribute('playsinline','');
   el.setAttribute('aria-label','Remote participant audio');
   el.style.display='none';
   ref.current.innerHTML='';
   ref.current.appendChild(el);
   const play=()=>el.play?.().catch(()=>{});
   play();
   return()=>{try{track.detach(el);el.remove()}catch{}}
 },[track]);
 return <div ref={ref} aria-hidden="true"/>;
}
function LiveVideo({track,className,label,onAspectRatio}){const ref=useRef(null);useEffect(()=>{if(!track||!ref.current)return;const el=track.attach();el.className=className||'';el.autoplay=true;el.playsInline=true;ref.current.innerHTML='';ref.current.appendChild(el);const updateAspect=()=>{if(el.videoWidth&&el.videoHeight&&onAspectRatio)onAspectRatio(el.videoWidth/el.videoHeight)};el.addEventListener?.('loadedmetadata',updateAspect);updateAspect();return()=>{el.removeEventListener?.('loadedmetadata',updateAspect);try{track.detach(el);el.remove()}catch{}}},[track,className,onAspectRatio]);return <div ref={ref} className="live-video-wrap" aria-label={label}/> }
function isActiveCameraPublication(publication){
 if(!publication?.track)return false;
 if(publication.isMuted===true)return false;
 const media=publication.track.mediaStreamTrack;
 if(media?.readyState==='ended')return false;
 if(media?.muted===true)return false;
 return true;
}
function ParticipantTile({item,avatar,localCameraEnabled,interactiveEffect}){
 const publication=item.participant?Array.from(item.participant.videoTrackPublications?.values?.()||[]).find(p=>p.source==='camera'&&isActiveCameraPublication(p))||null:null;
 const showVideo=item.local ? Boolean(localCameraEnabled)&&Boolean(publication) : Boolean(publication);
 const videoTrack=showVideo?publication.track:null;
  const sheeshEffect=interactiveEffect?.kind==='sheeeshhh'?<div className="participant-emote-effect" aria-label={`${interactiveEffect.targetName} SHEEESHHH`}><div className="emote-energy"/><div className="emote-burst"><i/><i/><i/><i/><i/><i/></div><div className="emote-text">SHEEESHHH!</div><img src={sheeeshhhEmote} alt=""/></div>:null;
 const label=<span className="thumb-name">{item.name}{item.role==='host'?' • Host':item.role==='admin'?' • Admin':''}</span>;
 return <div className={`thumb ${interactiveEffect?'interactive-hit':''}`} aria-label={item.name}>
   {videoTrack?<><LiveVideo track={videoTrack} className="thumb-video" label={item.name}/>{label}</>:<><div className="participant-avatar-fallback"><img className={interactiveEffect?'avatar-image-hidden-for-emote':''} src={avatar} alt=""/>{label}</div></>}
   {sheeshEffect}
 </div>
}

createRoot(document.getElementById('root')).render(<App/>);
