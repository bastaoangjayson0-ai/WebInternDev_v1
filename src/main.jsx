import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import logo from './assets/logo.jfif';
import avatar from './assets/avatar.jpg';
import {dbList,dbInsert,dbUpdate,dbUpsert,dbDelete,supabaseConfig,supabase,checkSupabaseSetup} from './supabase';

const DEFAULTS={admin:{name:'Bastaoang Jayson A',password:'webinternDEV'},hostPassword:'BSIT',userPassword:'CRT-NEUST-GSC'};
const REMOTE_AUDIO_VOLUME=0.9;
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
   {page==='dashboard'&&<Dashboard role={role} name={name} rooms={activeRooms} setRooms={setRooms} syncStatus={syncStatus} onCreate={createRoom} onJoin={joinRoom} onEnd={adminEnd} onOpenAdmin={setAdminView} adminView={adminView} credentials={credentials} setCredentials={setCredentials} attendance={attendance} users={knownUsers} setUsers={setKnownUsers} toast={setToast}/>} 
   {page==='meeting'&&<Meeting role={role} name={name} room={currentRoom} avatar={avatar} setToast={setToast} camera={camera} mic={mic} sharing={sharing} pinned={pinned} setCamera={setCamera} setMic={setMic} setSharing={setSharing} setPinned={setPinned} onLeave={leaveMeeting} onEnd={endRoom}/>} 
  </main>{toast&&<div className="toast">{toast}</div>}<footer>WebInternDev • Responsive meeting platform</footer>
 </div>
}
function Entry({onSelect}){return <section className="hero"><div className="hero-card entry-card"><div className="hero-brand-wrap"><img className="hero-logo" src={logo}/></div><div className="entry-intro"><span className="entry-kicker">SECURE • SIMPLE • CONNECTED</span><h1>How do you want to enter?</h1><p>Select your role to continue to WebInternDev.</p></div><div className="role-grid"><RoleCard title="Admin" desc="Monitor meetings and manage the platform" onClick={()=>onSelect('admin')} icon="admin"/><RoleCard title="Host" desc="Create meetings and share your screen" onClick={()=>onSelect('host')} icon="host"/><RoleCard title="User" desc="Join an active meeting and collaborate" onClick={()=>onSelect('user')} icon="user"/></div><div className="entry-footer"><span>WebInternDev</span><span>Professional meeting workspace</span></div></div></section>}
function RoleCard({title,desc,onClick,icon}){const paths={admin:<><path d="M4 19.5V9.8L12 5l8 4.8v9.7"/><path d="M8 19.5v-6h8v6M3 19.5h18M9 9.5h6"/></>,host:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 9 5 3-5 3V9ZM16 9h2M16 12h2M16 15h2"/></>,user:<><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"/></>};return <button className="role-card" onClick={onClick}><span className="role-icon"><svg viewBox="0 0 24 24">{paths[icon]}</svg></span><span>{title}</span><small>{desc}</small><strong>Continue <i>→</i></strong></button>}
function Login({role,name,setName,password,setPassword,onSubmit,onBack}){return <section className="center"><div className="panel login-panel"><div className="login-mark">{role==='admin'?'A':role==='host'?'H':'U'}</div><h1>{role==='admin'?'Admin Login':role==='host'?'Host Login':'User Login'}</h1><p className="muted">{role==='admin'?'Use the administrator account.':'Enter your name and shared role password.'}</p><form onSubmit={onSubmit}><label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder={role==='admin'?'Bastaoang Jayson A':'Enter your name'} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/></label><button className="primary wide">Continue</button></form><button className="link-btn" onClick={onBack}>← Back</button></div></section>}
function Dashboard({role,name,rooms,setRooms,syncStatus,onCreate,onJoin,onEnd,onOpenAdmin,adminView,credentials,setCredentials,attendance,users,setUsers,toast}){
 const [selectedRoom,setSelectedRoom]=useState(null);
 const [setup,setSetup]=useState(null);
 const [checking,setChecking]=useState(false);
 const runSetupCheck=async()=>{setChecking(true);try{const result=await checkSupabaseSetup();setSetup(result);if(result.ok)toast('Supabase setup check passed.');else toast(result.summary)}catch(e){setSetup({ok:false,env:[],tables:[],summary:e?.message||'Setup check failed.'});toast('Supabase setup check failed.')}finally{setChecking(false)}};
 useEffect(()=>{if(syncStatus==='error'&&!setup)runSetupCheck()},[syncStatus]);
 return <section className="dashboard"><div className="welcome"><div><span className="eyebrow">Welcome to WebInternDev!</span><h1>{name||role}</h1><p className="muted">{role==='admin'?'Monitor and manage your meeting platform.':role==='host'?'Create a room and present to up to 50 participants.':'Choose an active meeting to join.'}</p></div>{role==='host'&&<button className="primary" onClick={onCreate}>＋ Create Meeting</button>}</div>
 {setup&&<SupabaseSetupChecker result={setup} checking={checking} onCheck={runSetupCheck}/>}
 {role==='admin'&&<div className="stats"><Stat n={rooms.length} t="Active Meetings"/><Stat n={rooms.reduce((a,r)=>a+r.participants,0)} t="Participants"/><Stat n="50" t="Capacity / Room"/><Stat n="2" t="Room Limit"/></div>}
 <div className="section-head"><h2>{role==='admin'?'Active Meetings':'Available Meetings'}</h2><span>{rooms.length}/2 active • {syncStatus==='online'?'● Online sync':syncStatus==='connecting'?'Connecting…':'⚠ Sync error'}</span></div><div className="room-actions"><button className="ghost small" onClick={async()=>{try{const rr=await dbList('wid_rooms','?select=*&active=eq.true&order=created_at.desc');setRooms(rr.map(mapRoom));setSyncStatus('online');setToast('Meeting list refreshed.')}catch(e){setSyncStatus('error');setSetup(null);setToast('Refresh failed. Running the Supabase setup checker…');setTimeout(runSetupCheck,50)}}}>↻ Refresh meetings</button><button className="ghost small" onClick={runSetupCheck} disabled={checking}>{checking?'Checking…':'⚙ Check Supabase setup'}</button></div><div className="room-grid">{rooms.length?rooms.map(r=><RoomCard key={r.id} room={r} role={role} onJoin={()=>{setSelectedRoom(r);onJoin(r)}} onEnd={()=>onEnd(r)}/>):<div className="empty"><b>No active meetings</b><p>{role==='host'?'Create your first meeting to get started.':'Wait for a Host to create a meeting.'}</p></div>}</div>
 {role==='admin'&&<><div className="section-head"><h2>Admin controls</h2></div><div className="control-grid"><AdminControl title="User Management" icon="users" desc="View users who have entered WebInternDev and manage their access." onClick={()=>onOpenAdmin('users')}/><AdminControl title="Password Management" icon="lock" desc="Change the Host and User shared passwords." onClick={()=>onOpenAdmin('passwords')}/><AdminControl title="Attendance" icon="calendar" desc="View join time, leave time, duration, room and participant history." onClick={()=>onOpenAdmin('attendance')}/></div>{adminView&&<AdminPanel view={adminView} close={()=>onOpenAdmin(null)} credentials={credentials} setCredentials={setCredentials} attendance={attendance} users={users} setUsers={setUsers} toast={toast}/>}</>}
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
function AdminPanel({view,close,credentials,setCredentials,attendance,users,setUsers,toast}){
 const [hostPwd,setHostPwd]=useState(credentials.hostPassword),[userPwd,setUserPwd]=useState(credentials.userPassword);
 const savePasswords=async()=>{if(!hostPwd.trim()||!userPwd.trim()){toast('Passwords cannot be empty.');return}setCredentials(c=>({...c,hostPassword:hostPwd,userPassword:userPwd}));try{await dbUpsert('wid_settings',{id:1,host_password:hostPwd,user_password:userPwd,updated_at:new Date().toISOString()});toast('Host and User passwords updated online.');close()}catch(e){toast('Saved locally, but Supabase update failed. Run supabase_schema.sql and check RLS.')}};
 const removeUser=(idx)=>{const u=users[idx];setUsers(list=>list.filter((_,i)=>i!==idx));toast(`${u.name} removed from the local user list.`)};
 return <div className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">Admin Control</span><h2>{view==='users'?'User Management':view==='passwords'?'Password Management':'Attendance'}</h2></div><button className="ghost" onClick={close}>Close</button></div>
 {view==='users'&&<div className="table-wrap">{users.length?<table><thead><tr><th>Name</th><th>Role</th><th>Access</th><th></th></tr></thead><tbody>{users.map((u,i)=><tr key={`${u.name}-${u.role}-${i}`}><td>{u.name}</td><td>{u.role}</td><td><span className="status">Active</span></td><td><button className="danger small" onClick={()=>removeUser(i)}>Remove</button></td></tr>)}</tbody></table>:<div className="empty"><b>No users recorded yet.</b><p>A Host or User will appear here after entering the platform.</p></div>}</div>}
 {view==='passwords'&&<div className="password-grid"><label>Host password<input type="password" value={hostPwd} onChange={e=>setHostPwd(e.target.value)}/></label><label>User password<input type="password" value={userPwd} onChange={e=>setUserPwd(e.target.value)}/></label><div className="panel-actions"><button className="primary" onClick={savePasswords}>Save Passwords</button><button className="ghost" onClick={()=>{setHostPwd(DEFAULTS.hostPassword);setUserPwd(DEFAULTS.userPassword)}}>Reset defaults</button></div></div>}
 {view==='attendance'&&<div className="table-wrap">{attendance.length?<table><thead><tr><th>Name</th><th>Role</th><th>Meeting</th><th>Joined</th><th>Left</th><th>Duration</th></tr></thead><tbody>{attendance.slice().reverse().map(a=><tr key={a.id}><td>{a.name}</td><td>{a.role}</td><td>{a.roomTitle}</td><td>{formatDate(a.joinedAt)}</td><td>{a.leftAt?formatDate(a.leftAt):<span className="status">In meeting</span>}</td><td>{a.duration!=null?`${a.duration} min`:'—'}</td></tr>)}</tbody></table>:<div className="empty"><b>No attendance yet.</b><p>Attendance is recorded when a Host or User joins a meeting.</p></div>}</div>}
 </div>
}
function formatDate(v){return new Date(v).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}
function Stat({n,t}){return <div className="stat"><strong>{n}</strong><span>{t}</span></div>}
function RoomCard({room,role,onJoin,onEnd}){return <div className="room-card"><div className="room-top"><span className="live">● LIVE</span><span>{room.participants}/50</span></div><h3>{room.title}</h3><p className="muted">Host: {room.host}</p><div className="room-actions">{role==='admin'?<button className="danger" onClick={onEnd}>End Meeting</button>:<button className="primary" onClick={onJoin}>{role==='host'?'Open Meeting':'Join Meeting'}</button>}</div></div>}
function Meeting({role,name,room,avatar,camera,mic,sharing,pinned,setCamera,setMic,setSharing,setPinned,onLeave,onEnd,setToast}){
 const [connection,setConnection]=useState('connecting');
 const [participants,setParticipants]=useState([]);
 const [localTracks,setLocalTracks]=useState([]);
 const [screenTrack,setScreenTrack]=useState(null);
 const [remoteScreenTrack,setRemoteScreenTrack]=useState(null);
 const [chat,setChat]=useState([]);
 const [message,setMessage]=useState('');
 const [micError,setMicError]=useState('');
 const [chatReady,setChatReady]=useState(false);
 const [chatError,setChatError]=useState('');
 const liveRoomRef=useRef(null);
 const chatEndRef=useRef(null);
 const mounted=useRef(true);
 const screenTrackRef=useRef(null);
 const wsUrlHint=import.meta.env.VITE_LIVEKIT_URL || '';
 const MICROPHONE_CAPTURE_OPTIONS={echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,latency:0.02};

 useEffect(()=>{
   mounted.current=true;
   let liveRoom;
   const connect=async()=>{
     try{
       const resp=await fetch('/api/livekit-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:room.id,participantName:name,role})});
       const data=await resp.json();
       if(!resp.ok) throw new Error(data.error||data.detail||`Token endpoint returned HTTP ${resp.status}.`);
       const {Room,RoomEvent}=await import('livekit-client');
       liveRoom=new Room({adaptiveStream:true,dynacast:true,autoSubscribe:true});
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
           if(screenPub?.track) activeRemoteScreen=screenPub.track;
           list.push(p);
         });
         setParticipants(list);
         setRemoteScreenTrack(activeRemoteScreen);
       };
       const setRemoteScreen=(track,publication,participant)=>{
         if(!mounted.current)return;
         const isScreen=publication?.source==='screen_share' || publication?.source==='screenShare';
         if(isScreen) {
           setRemoteScreenTrack(track || null);
           try{participant?.setVolume?.(REMOTE_AUDIO_VOLUME)}catch{}
         }
       };
       liveRoom.on(RoomEvent.ConnectionStateChanged,(state)=>setConnection(String(state).toLowerCase()));
       liveRoom.on(RoomEvent.ParticipantConnected,refresh);
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
         } catch(e) {
           console.warn('Could not subscribe to newly published track:', e);
         }
         if(publication?.source==='screen_share' || publication?.source==='screenShare') refresh();
       });
       liveRoom.on(RoomEvent.TrackUnpublished,(publication)=>{
         if(publication?.source==='screen_share') setRemoteScreenTrack(null);
         refresh();
       });
       liveRoom.on(RoomEvent.TrackUnsubscribed,refresh);
       liveRoom.on(RoomEvent.LocalTrackPublished,refresh);
       liveRoom.on(RoomEvent.LocalTrackUnpublished,refresh);
       const appendRemoteChat=(text,participant)=>{
         if(typeof text!=='string' || !text.trim()) return;
         setChat(c=>c.concat({id:crypto.randomUUID(),name:participant?.name||participant?.identity||'Participant',text:text.trim(),local:false}));
       };
       liveRoom.on(RoomEvent.DataReceived,(payload,participant,kind,topic)=>{
         try{
           const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
           let msg;
           try{ msg=JSON.parse(text); }catch{ msg=null; }
           if((!topic || topic==='chat') && msg?.type==='chat' && typeof msg.text==='string') appendRemoteChat(msg.text,participant);
         }catch(err){ console.warn('Chat receive failed:',err); }
       });
       liveRoom.on(RoomEvent.ChatMessage,(chatMessage,participant)=>{
         try{
           const text=typeof chatMessage==='string' ? chatMessage : (chatMessage?.message || chatMessage?.text || chatMessage?.content);
           if(typeof text==='string') appendRemoteChat(text,participant);
         }catch(err){ console.warn('LiveKit chat event failed:',err); }
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
       setChatReady(true);
       setChatError('');

       // Explicitly subscribe to already-published remote tracks. This is
       // especially important when a participant joins after someone has
       // already enabled their microphone.
       for (const participant of liveRoom.remoteParticipants.values()) {
         for (const publication of participant.trackPublications.values()) {
           try {
             if (!publication.isSubscribed) await publication.setSubscribed(true);
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
     const publication=await r.localParticipant.setScreenShareEnabled(next);
     setSharing(next);
     if(!next){setPinned(false);screenTrackRef.current=null;setScreenTrack(null);}
     else {
       const pub=publication || Array.from(r.localParticipant.videoTrackPublications.values()).find(p=>p.source==='screen_share' && p.track);
       if(pub?.track){screenTrackRef.current=pub.track;setScreenTrack(pub.track);}
       else throw new Error('The browser did not publish a screen-share track.');
     }
   }catch(e){setSharing(false);setPinned(false);setToast?.('Screen sharing could not start. Check browser permission and try again.');}
 };
 const sendChat=async(e)=>{
   e?.preventDefault();
   const text=message.trim();
   const r=liveRoomRef.current;
   if(!text)return;
   if(!r || r.state!=='connected'){setChatError('Chat is waiting for the meeting connection.');setToast?.('Chat is not connected yet.');return;}
   try {
     if(!r.localParticipant.permissions?.canPublishData && r.localParticipant.permissions?.canPublishData !== undefined){
       throw new Error('LiveKit token does not allow chat/data publishing.');
     }
     const data=new TextEncoder().encode(JSON.stringify({type:'chat',text,ts:Date.now()}));
     await r.localParticipant.publishData(data,{reliable:true,topic:'chat'});
     setChat(c=>c.concat({id:crypto.randomUUID(),name,text,local:true}));
     setMessage('');
     setChatError('');
   } catch(err) {
     console.error('Chat send failed:',err);
     setChatError(err?.message || 'LiveKit data channel failed.');
     setToast?.('Chat message could not be sent. Check that the meeting is connected.');
   }
 };
 const trackForParticipant=(participant,source)=>{
   if(!participant)return null;
   const pubs=Array.from(participant.videoTrackPublications.values());
   return pubs.find(p=>p.source===source && p.track)?.track||null;
 };
 const allParticipants=[{local:true,participant:liveRoomRef.current?.localParticipant||null,name,role},...participants.map(p=>({local:false,participant:p,name:p.name||p.identity,role:p.metadata?(()=>{try{return JSON.parse(p.metadata).role}catch{return 'user'}})():'user'}))];
 const screenFromRemote=remoteScreenTrack || participants.map(p=>trackForParticipant(p,'screen_share')).find(Boolean);
 const mainScreen=screenTrack||screenFromRemote;
 const remoteScreenActive=Boolean(screenFromRemote);
 const showingScreen=Boolean(mainScreen);
 return <section className="meeting">
   <div className="meeting-head"><div><b>{room.title}</b><span className="muted"> • {room.participants}/50</span></div><span className={connection==='connected'?'live':'connection-pill'}>{connection==='connected'?'● LIVE':connection==='connecting'?'Connecting…':connection.startsWith('error:')?'Connection error':'Reconnecting…'}</span></div>
   {connection.startsWith('error:')&&<div className="meeting-error">{connection.slice(6)}<button className="ghost small" onClick={()=>window.location.reload()}>Reload</button></div>}
   <div className={`stage ${pinned&&mainScreen?'pinned':''} ${showingScreen?'screen-active':''}`}>
     <div className="main-tile">
       {showingScreen?<LiveVideo track={mainScreen} className="screen-video" label={screenTrack?`${name} is sharing screen`:'Host is sharing screen'}/>:<div className="main-content">
         {sharing&&screenTrack?<LiveVideo track={screenTrack} className="screen-video" label={`${name} is sharing screen`}/>:camera&&localTracks.find(t=>t.kind==='video')?<LiveVideo track={localTracks.find(t=>t.kind==='video')} className="local-video" label={name}/>:<div className="avatar-view"><img src={avatar}/><span>{name}</span></div>}
       </div>}
       {(sharing||remoteScreenActive)&&<span className="share-label">🖥️ {screenTrack?`${name} is sharing screen`:'Host is sharing screen'}</span>}
     </div>
     <div className="thumbs">{allParticipants.slice(0,10).map((p,i)=><ParticipantTile key={p.participant?.identity||`${p.name}-${i}`} item={p} avatar={avatar}/>)}</div>
   </div>
   <div className="remote-audio" aria-hidden="true">{participants.map(p=><RemoteAudio key={p.identity} participant={p}/>)}</div>
   {micError&&<div className="meeting-status-error">Microphone: {micError} <button className="ghost small" onClick={toggleMic}>Try microphone again</button></div>}
   <div className="audio-note">Remote participant audio is automatically kept at a comfortable level.</div>
   <div className="meeting-bottom">
     <div className="meeting-controls">
       <button aria-label={mic?'Mute microphone':'Unmute microphone'} title={mic?'Mute microphone':'Unmute microphone'} className={mic?'control active':'control'} onClick={toggleMic}><span className="meeting-symbol">{mic?'🎤':'🔇'}</span><span>{mic?'Mute':'Unmute'}</span></button>
       <button aria-label={camera?'Turn camera off':'Turn camera on'} title={camera?'Turn camera off':'Turn camera on'} className={camera?'control active':'control'} onClick={toggleCamera}><span className="meeting-symbol">{camera?'📹':'📷'}</span><span>Camera</span></button>
       {role==='host'&&<>
         <button aria-label={sharing?'Stop sharing screen':'Share screen'} title={sharing?'Stop sharing screen':'Share screen'} className={sharing?'control active':'control'} onClick={toggleScreen}><span className="meeting-symbol">🖥️</span><span>{sharing?'Stop share':'Share'}</span></button>
         <button aria-label={pinned?'Unpin screen':'Pin screen'} title={pinned?'Unpin screen':'Pin screen'} disabled={!showingScreen} className={pinned?'control active':'control'} onClick={()=>setPinned(!pinned)}><span className="meeting-symbol">📌</span><span>{pinned?'Unpin':'Pin'}</span></button>
       </>}
       <button aria-label="Open chat" title="Chat" className="control" onClick={()=>document.getElementById('chat-panel')?.classList.toggle('open')}><span className="meeting-symbol">💬</span><span>Chat</span></button>
       <button aria-label="Open participants" title="Participants" className="control" onClick={()=>document.getElementById('participants-panel')?.classList.toggle('open')}><span className="meeting-symbol">👥</span><span>People</span></button>
       {role==='host'?<button aria-label="End meeting" title="End meeting" className="danger control end-control" onClick={onEnd}><span className="meeting-symbol">⛔</span><span>End</span></button>:<button aria-label="Leave meeting" title="Leave meeting" className="danger control end-control" onClick={onLeave}><span className="meeting-symbol">↩️</span><span>Leave</span></button>}
     </div>
     {role==='host'&&<div className="host-note">Host controls: screen share + pin/unpin. Pinning is responsive across desktop, tablet, and mobile.</div>}
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
function LiveVideo({track,className,label}){const ref=useRef(null);useEffect(()=>{if(!track||!ref.current)return;const el=track.attach();el.className=className||'';el.autoplay=true;el.playsInline=true;ref.current.innerHTML='';ref.current.appendChild(el);return()=>{try{track.detach(el);el.remove()}catch{}}},[track,className]);return <div ref={ref} className="live-video-wrap" aria-label={label}/>}
function ParticipantTile({item,avatar}){const videoTrack=item.participant?Array.from(item.participant.videoTrackPublications?.values?.()||[]).find(p=>p.source==='camera'&&p.track)?.track||null:null;return <div className="thumb">{videoTrack?<LiveVideo track={videoTrack} className="thumb-video" label={item.name}/>:<img src={avatar}/>}<span>{item.name}{item.role==='host'?' • Host':''}</span></div>}

createRoot(document.getElementById('root')).render(<App/>);
