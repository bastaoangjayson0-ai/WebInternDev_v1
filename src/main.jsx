import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import logo from './assets/logo.jfif';
import avatar from './assets/avatar.jpg';
import {dbList,dbInsert,dbUpdate,dbUpsert,dbDelete,supabaseConfig,supabase,checkSupabaseSetup} from './supabase';

const DEFAULTS={admin:{name:'Bastaoang Jayson A',password:'webinternDEV'},hostPassword:'BSIT',userPassword:'CRT-NEUST-GSC'};
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
     try{
       const [rr,uu,aa,ss]=await Promise.all([
         dbList('wid_rooms','?select=*&active=eq.true&order=created_at.desc'),
         dbList('wid_users','?select=*'),
         dbList('wid_attendance','?select=*&order=joined_at.desc'),
         dbList('wid_settings','?select=*&id=eq.1')
       ]);
       if(cancelled)return;
       setSyncStatus('online');
       setRooms(Array.isArray(rr)?rr.map(mapRoom):[]);
       if(Array.isArray(uu))setKnownUsers(uu.map(u=>({name:u.name,role:u.role})));
       if(Array.isArray(aa))setAttendance(aa.map(mapAttendance));
       if(Array.isArray(ss)&&ss[0])setCredentials(c=>({...c,hostPassword:ss[0].host_password,userPassword:ss[0].user_password}));
     }catch(e){
       if(cancelled)return;
       setSyncStatus('error');
       console.error('Supabase initial sync unavailable:',e);
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
       if(status==='SUBSCRIBED')setSyncStatus('online');
       else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setSyncStatus('error');
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
     const rows=await dbUpsert('wid_rooms',{id,title:title.trim(),host:name,participants:0,active:true,created_at:createdAt});
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
 function joinRoom(room){if(role==='user'&&room.participants>=50){setToast('This meeting is full.');return} setCurrentRoom(room); setPage('meeting'); const now=new Date().toISOString(); setAttendance(a=>a.concat({id:crypto.randomUUID(),name,role,roomId:room.id,roomTitle:room.title,host:room.host,joinedAt:now,leftAt:null,duration:null})); setRooms(x=>x.map(r=>r.id===room.id?{...r,participants:Math.min(50,r.participants+(role==='user'?1:0))}:r));}
 function leaveMeeting(){if(!currentRoom)return; const now=new Date(); setAttendance(a=>a.map(x=>{if(x.name===name&&x.roomId===currentRoom.id&&!x.leftAt){const joined=new Date(x.joinedAt);return {...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-joined)/60000))}}return x})); setRooms(x=>x.map(r=>r.id===currentRoom.id?{...r,participants:Math.max(0,r.participants-(role==='user'?1:0))}:r));setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false);setToast('You left the meeting. You can rejoin while it is active.')}
 async function endRoom(){if(!currentRoom)return; const now=new Date();setAttendance(a=>a.map(x=>x.roomId===currentRoom.id&&!x.leftAt?{...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-new Date(x.joinedAt))/60000))}:x));try{await dbUpdate('wid_rooms',`?id=eq.${currentRoom.id}`,{active:false,participants:0});setRooms(x=>x.filter(r=>r.id!==currentRoom.id));setToast('Meeting ended.')}catch(e){setToast(`Could not end meeting online: ${e.message}`);return}setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false)}
 async function adminEnd(room){try{await dbUpdate('wid_rooms',`?id=eq.${room.id}`,{active:false,participants:0});setRooms(x=>x.filter(r=>r.id!==room.id));setAttendance(a=>a.map(x=>x.roomId===room.id&&!x.leftAt?{...x,leftAt:new Date().toISOString()}:x));setToast(`${room.title} ended.`)}catch(e){setToast(`Could not end meeting online: ${e.message}`)}}
 function signOut(){setRole(null);setPage('entry');setName('');setPassword('');setCurrentRoom(null);setAdminView(null)}
 return <div className="app">
  <header className="topbar"><button className="brand" onClick={()=>{setPage(role?'dashboard':'entry');setAdminView(null)}}><img src={logo}/><span>WebInternDev</span></button>{role&&<div className="top-actions"><span className="role-pill">{role==='admin'?'Admin':role==='host'?'Host':'User'}</span><button className="ghost" onClick={signOut}>Sign out</button></div>}</header>
  <main>
   {page==='entry'&&<Entry onSelect={enterRole}/>}
   {page==='login'&&<Login role={role} name={name} setName={setName} password={password} setPassword={setPassword} onSubmit={login} onBack={()=>setPage('entry')}/>} 
   {page==='dashboard'&&<Dashboard role={role} name={name} rooms={activeRooms} setRooms={setRooms} syncStatus={syncStatus} onCreate={createRoom} onJoin={joinRoom} onEnd={adminEnd} onOpenAdmin={setAdminView} adminView={adminView} credentials={credentials} setCredentials={setCredentials} attendance={attendance} users={knownUsers} setUsers={setKnownUsers} toast={setToast}/>} 
   {page==='meeting'&&<Meeting role={role} name={name} room={currentRoom} avatar={avatar} camera={camera} mic={mic} sharing={sharing} pinned={pinned} setCamera={setCamera} setMic={setMic} setSharing={setSharing} setPinned={setPinned} onLeave={leaveMeeting} onEnd={endRoom}/>} 
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
   <div className="setup-checker-head"><div><span className="eyebrow">Supabase Setup Checker</span><h2>{result.ok?'Database setup looks good':'Database setup needs attention'}</h2><p>{result.summary}</p></div><button className="ghost small" onClick={onCheck} disabled={checking}>{checking?'Checking…':'Run check again'}</button></div>
   <div className="setup-grid">
    <div className="setup-card"><b>Environment variables</b>{result.env.map(item=><div className="setup-row" key={item.name}><span className={item.configured?'setup-dot ok':'setup-dot fail'}>●</span><div><strong>{item.name}</strong><small>{item.value}</small></div></div>)}</div>
    <div className="setup-card"><b>Required database tables</b>{result.tables.map(item=><div className="setup-row" key={item.table}><span className={item.status==='ok'?'setup-dot ok':'setup-dot fail'}>●</span><div><strong>public.{item.table}</strong><small>{statusLabel(item.status)} — {item.detail}</small></div></div>)}</div>
   </div>
   {!result.ok&&<div className="setup-next"><strong>What to do:</strong> Open Supabase → SQL Editor → run the project's <code>supabase_schema.sql</code>. If a table says <b>RLS BLOCKED</b>, check its policies. If an environment variable says missing, add it in Vercel → Project Settings → Environment Variables, then redeploy.</div>}
   {result.ok&&<div className="setup-next setup-next-good">✓ Supabase REST access is working for all required tables. You can now create and publish meetings.</div>}
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
function Meeting({role,name,room,avatar,camera,mic,sharing,pinned,setCamera,setMic,setSharing,setPinned,onLeave,onEnd}){
 const [connection,setConnection]=useState('connecting');
 const [participants,setParticipants]=useState([]);
 const [localTracks,setLocalTracks]=useState([]);
 const [screenTrack,setScreenTrack]=useState(null);
 const [chat,setChat]=useState([]);
 const [message,setMessage]=useState('');
 const liveRoomRef=useRef(null);
 const chatEndRef=useRef(null);
 const mounted=useRef(true);
 const screenTrackRef=useRef(null);
 const wsUrlHint=import.meta.env.VITE_LIVEKIT_URL || '';

 useEffect(()=>{
   mounted.current=true;
   let liveRoom;
   const connect=async()=>{
     try{
       const resp=await fetch('/api/livekit-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:room.id,participantName:name,role})});
       const data=await resp.json();
       if(!resp.ok) throw new Error(data.error||data.detail||`Token endpoint returned HTTP ${resp.status}.`);
       const {Room,RoomEvent,Track,createLocalTracks}=await import('livekit-client');
       liveRoom=new Room({adaptiveStream:true,dynacast:true});
       liveRoomRef.current=liveRoom;
       const refresh=()=>{
         if(!mounted.current)return;
         const list=[];
         liveRoom.remoteParticipants.forEach(p=>list.push(p));
         setParticipants(list);
       };
       liveRoom.on(RoomEvent.ConnectionStateChanged,(state)=>setConnection(String(state).toLowerCase()));
       liveRoom.on(RoomEvent.ParticipantConnected,refresh);
       liveRoom.on(RoomEvent.ParticipantDisconnected,refresh);
       liveRoom.on(RoomEvent.TrackSubscribed,refresh);
       liveRoom.on(RoomEvent.TrackUnsubscribed,refresh);
       liveRoom.on(RoomEvent.LocalTrackPublished,refresh);
       liveRoom.on(RoomEvent.LocalTrackUnpublished,refresh);
       liveRoom.on(RoomEvent.DataReceived,(payload,participant)=>{
         try{
           const msg=JSON.parse(new TextDecoder().decode(payload));
           if(msg.type==='chat') setChat(c=>c.concat({id:crypto.randomUUID(),name:participant?.name||'Participant',text:msg.text,local:false}));
         }catch{}
       });
       await liveRoom.connect(data.url, data.token);
       setConnection('connected');
       const tracks=await createLocalTracks({audio:true,video:true});
       for(const track of tracks){
         await liveRoom.localParticipant.publishTrack(track);
         if(track.kind==='video' && !camera) track.mute();
         if(track.kind==='audio' && !mic) track.mute();
       }
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
   if(!r)return;
   const next=!mic;
   await r.localParticipant.setMicrophoneEnabled(next);
   setMic(next);
 };
 const toggleCamera=async()=>{
   const r=liveRoomRef.current;
   if(!r)return;
   const next=!camera;
   await r.localParticipant.setCameraEnabled(next);
   setCamera(next);
 };
 const toggleScreen=async()=>{
   const r=liveRoomRef.current;
   if(!r||role!=='host')return;
   const next=!sharing;
   try{
     await r.localParticipant.setScreenShareEnabled(next);
     setSharing(next);
     if(!next){setPinned(false);screenTrackRef.current=null;setScreenTrack(null);}
     else {
       const pub=Array.from(r.localParticipant.videoTrackPublications.values()).find(p=>p.source==='screen_share');
       if(pub?.track){screenTrackRef.current=pub.track;setScreenTrack(pub.track);}
     }
   }catch(e){setSharing(false);setPinned(false);}
 };
 const sendChat=async(e)=>{
   e?.preventDefault();
   const text=message.trim();
   const r=liveRoomRef.current;
   if(!text||!r)return;
   const data=new TextEncoder().encode(JSON.stringify({type:'chat',text}));
   await r.localParticipant.publishData(data,{reliable:true});
   setChat(c=>c.concat({id:crypto.randomUUID(),name,text,local:true}));
   setMessage('');
 };
 const trackForParticipant=(participant,source)=>{
   if(!participant)return null;
   const pubs=Array.from(participant.videoTrackPublications.values());
   return pubs.find(p=>p.source===source && p.track)?.track||null;
 };
 const allParticipants=[{local:true,participant:liveRoomRef.current?.localParticipant||null,name,role},...participants.map(p=>({local:false,participant:p,name:p.name||p.identity,role:p.metadata?(()=>{try{return JSON.parse(p.metadata).role}catch{return 'user'}})():'user'}))];
 const screenFromRemote=participants.map(p=>trackForParticipant(p,'screen_share')).find(Boolean);
 const mainScreen=screenTrack||screenFromRemote;
 return <section className="meeting">
   <div className="meeting-head"><div><b>{room.title}</b><span className="muted"> • {room.participants}/50</span></div><span className={connection==='connected'?'live':'connection-pill'}>{connection==='connected'?'● LIVE':connection==='connecting'?'Connecting…':connection.startsWith('error:')?'Connection error':'Reconnecting…'}</span></div>
   {connection.startsWith('error:')&&<div className="meeting-error">{connection.slice(6)}<button className="ghost small" onClick={()=>window.location.reload()}>Reload</button></div>}
   <div className={`stage ${pinned&&mainScreen?'pinned':''}`}>
     <div className="main-tile">
       {pinned&&mainScreen?<LiveVideo track={mainScreen} className="screen-video" label="Screen share"/>:<div className="main-content">
         {sharing&&screenTrack?<LiveVideo track={screenTrack} className="screen-video" label={`${name} is sharing screen`}/>:camera&&localTracks.find(t=>t.kind==='video')?<LiveVideo track={localTracks.find(t=>t.kind==='video')} className="local-video" label={name}/>:<div className="avatar-view"><img src={avatar}/><span>{name}</span></div>}
       </div>}
       {sharing&&<span className="share-label">🖥️ {name} is sharing screen</span>}
     </div>
     <div className="thumbs">{allParticipants.slice(0,10).map((p,i)=><ParticipantTile key={p.participant?.identity||`${p.name}-${i}`} item={p} avatar={avatar}/>)}</div>
   </div>
   <div className="meeting-bottom">
     <div className="meeting-controls"><button className={mic?'control active':'control'} onClick={toggleMic}>{mic?'🎤':'🔇'}</button><button className={camera?'control active':'control'} onClick={toggleCamera}>{camera?'📹':'📷'}</button>{role==='host'&&<><button className={sharing?'control active':'control'} onClick={toggleScreen}>🖥️</button><button disabled={!sharing} className={pinned?'control active':'control'} onClick={()=>setPinned(!pinned)}>📌</button></>}<button className="control" onClick={()=>document.getElementById('chat-panel')?.classList.toggle('open')}>💬</button><button className="control" onClick={()=>document.getElementById('participants-panel')?.classList.toggle('open')}>👥</button>{role==='host'?<button className="danger control" onClick={onEnd}>End</button>:<button className="danger control" onClick={onLeave}>Leave</button>}</div>
     {role==='host'&&<div className="host-note">Host controls: screen share + pin/unpin. Pinning is responsive across desktop, tablet, and mobile.</div>}
   </div>
   <aside id="chat-panel" className="meeting-side-panel"><div className="side-head"><b>Chat</b><button onClick={()=>document.getElementById('chat-panel')?.classList.remove('open')}>×</button></div><div className="chat-list">{chat.length?chat.map(m=><div className={m.local?'chat-msg local':'chat-msg'} key={m.id}><b>{m.name}</b><span>{m.text}</span></div>):<p className="muted">No messages yet.</p>}<div ref={chatEndRef}/></div><form className="chat-form" onSubmit={sendChat}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type a message…"/><button className="primary">Send</button></form></aside>
   <aside id="participants-panel" className="meeting-side-panel participants-panel"><div className="side-head"><b>Participants ({participants.length+1})</b><button onClick={()=>document.getElementById('participants-panel')?.classList.remove('open')}>×</button></div><div className="participant-list"><div className="participant-row"><img src={avatar}/><span>{name} <small>• {role}</small></span></div>{participants.map(p=><div className="participant-row" key={p.identity}><img src={avatar}/><span>{p.name||p.identity}</span></div>)}</div></aside>
 </section>
}
function LiveVideo({track,className,label}){const ref=useRef(null);useEffect(()=>{if(!track||!ref.current)return;const el=track.attach();el.className=className||'';el.autoplay=true;el.playsInline=true;ref.current.innerHTML='';ref.current.appendChild(el);return()=>{try{track.detach(el);el.remove()}catch{}}},[track,className]);return <div ref={ref} className="live-video-wrap" aria-label={label}/>}
function ParticipantTile({item,avatar}){const videoTrack=item.participant?Array.from(item.participant.videoTrackPublications?.values?.()||[]).find(p=>p.source==='camera'&&p.track)?.track||null:null;return <div className="thumb">{videoTrack?<LiveVideo track={videoTrack} className="thumb-video" label={item.name}/>:<img src={avatar}/>}<span>{item.name}{item.role==='host'?' • Host':''}</span></div>}

createRoot(document.getElementById('root')).render(<App/>);
