import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import logo from './assets/logo.jfif';
import avatar from './assets/avatar.jpg';
import {dbList,dbInsert,dbUpdate,dbUpsert,dbDelete,supabaseConfig} from './supabase';

const DEFAULTS={admin:{name:'Bastaoang Jayson A',password:'webinternDEV'},hostPassword:'BSIT',userPassword:'CRT-NEUST-GSC'};
const defaultRooms=[];
const mapRoom=r=>({id:r.id,title:r.title,host:r.host,participants:r.participants,active:r.active,createdAt:r.created_at});
const mapAttendance=a=>({id:a.id,name:a.name,role:a.role,roomId:a.room_id,roomTitle:a.room_title,host:a.host,joinedAt:a.joined_at,leftAt:a.left_at,duration:a.duration});
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
function App(){
 const [role,setRole]=useState(null),[page,setPage]=useState('entry'),[name,setName]=useState(''),[password,setPassword]=useState(''),[rooms,setRooms]=useState(()=>read('wid_rooms',defaultRooms)),[currentRoom,setCurrentRoom]=useState(null),[camera,setCamera]=useState(false),[mic,setMic]=useState(true),[sharing,setSharing]=useState(false),[pinned,setPinned]=useState(false),[toast,setToast]=useState('');
 const [adminView,setAdminView]=useState(null);
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
       const [rr,uu,aa,ss]=await Promise.all([dbList('wid_rooms','?select=*&order=created_at.desc'),dbList('wid_users','?select=*'),dbList('wid_attendance','?select=*&order=joined_at.desc'),dbList('wid_settings','?select=*\&id=eq.1')]);
       if(cancelled)return;
       if(Array.isArray(rr))setRooms(rr.map(mapRoom));
       if(Array.isArray(uu))setKnownUsers(uu.map(u=>({name:u.name,role:u.role})));
       if(Array.isArray(aa))setAttendance(aa.map(mapAttendance));
       if(Array.isArray(ss)&&ss[0])setCredentials(c=>({...c,hostPassword:ss[0].host_password,userPassword:ss[0].user_password}));
     }catch(e){console.warn('Supabase initial sync unavailable:',e.message)}
   })();
   return()=>{cancelled=true};
 },[]);
 useEffect(()=>{
   if(!rooms.length)return;
   const fresh=rooms;
   (async()=>{try{for(const r of fresh){await dbUpsert('wid_rooms',{id:r.id,title:r.title,host:r.host,participants:r.participants,active:r.active,created_at:new Date(r.createdAt||Date.now()).toISOString()})}}catch(e){console.warn('Room sync:',e.message)}})();
 },[rooms]);
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
 function createRoom(){if(activeRooms.length>=2){setToast('Maximum of 2 active meeting rooms has been reached.');return} const title=window.prompt('Meeting title:','Web Development Class'); if(!title?.trim())return; const room={id:crypto.randomUUID(),title:title.trim(),host:name,participants:0,active:true,createdAt:Date.now()};setRooms(x=>[...x,room]);setToast('Meeting created successfully.')}
 function joinRoom(room){if(role==='user'&&room.participants>=50){setToast('This meeting is full.');return} setCurrentRoom(room); setPage('meeting'); const now=new Date().toISOString(); setAttendance(a=>a.concat({id:crypto.randomUUID(),name,role,roomId:room.id,roomTitle:room.title,host:room.host,joinedAt:now,leftAt:null,duration:null})); setRooms(x=>x.map(r=>r.id===room.id?{...r,participants:Math.min(50,r.participants+(role==='user'?1:0))}:r));}
 function leaveMeeting(){if(!currentRoom)return; const now=new Date(); setAttendance(a=>a.map(x=>{if(x.name===name&&x.roomId===currentRoom.id&&!x.leftAt){const joined=new Date(x.joinedAt);return {...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-joined)/60000))}}return x})); setRooms(x=>x.map(r=>r.id===currentRoom.id?{...r,participants:Math.max(0,r.participants-(role==='user'?1:0))}:r));setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false);setToast('You left the meeting. You can rejoin while it is active.')}
 function endRoom(){if(!currentRoom)return; const now=new Date();setAttendance(a=>a.map(x=>x.roomId===currentRoom.id&&!x.leftAt?{...x,leftAt:now.toISOString(),duration:Math.max(0,Math.round((now-new Date(x.joinedAt))/60000))}:x));setRooms(x=>x.map(r=>r.id===currentRoom.id?{...r,active:false,participants:0}:r));setCurrentRoom(null);setPage('dashboard');setSharing(false);setPinned(false);setToast('Meeting ended.')}
 function adminEnd(room){setRooms(x=>x.map(r=>r.id===room.id?{...r,active:false,participants:0}:r));setAttendance(a=>a.map(x=>x.roomId===room.id&&!x.leftAt?{...x,leftAt:new Date().toISOString()}:x));setToast(`${room.title} ended.`)}
 function signOut(){setRole(null);setPage('entry');setName('');setPassword('');setCurrentRoom(null);setAdminView(null)}
 return <div className="app">
  <header className="topbar"><button className="brand" onClick={()=>{setPage(role?'dashboard':'entry');setAdminView(null)}}><img src={logo}/><span>WebInternDev</span></button>{role&&<div className="top-actions"><span className="role-pill">{role==='admin'?'Admin':role==='host'?'Host':'User'}</span><button className="ghost" onClick={signOut}>Sign out</button></div>}</header>
  <main>
   {page==='entry'&&<Entry onSelect={enterRole}/>}
   {page==='login'&&<Login role={role} name={name} setName={setName} password={password} setPassword={setPassword} onSubmit={login} onBack={()=>setPage('entry')}/>} 
   {page==='dashboard'&&<Dashboard role={role} name={name} rooms={activeRooms} onCreate={createRoom} onJoin={joinRoom} onEnd={adminEnd} onOpenAdmin={setAdminView} adminView={adminView} credentials={credentials} setCredentials={setCredentials} attendance={attendance} users={knownUsers} setUsers={setKnownUsers} toast={setToast}/>} 
   {page==='meeting'&&<Meeting role={role} name={name} room={currentRoom} avatar={avatar} camera={camera} mic={mic} sharing={sharing} pinned={pinned} setCamera={setCamera} setMic={setMic} setSharing={setSharing} setPinned={setPinned} onLeave={leaveMeeting} onEnd={endRoom}/>} 
  </main>{toast&&<div className="toast">{toast}</div>}<footer>WebInternDev • Responsive meeting platform</footer>
 </div>
}
function Entry({onSelect}){return <section className="hero"><div className="hero-card entry-card"><div className="hero-brand-wrap"><img className="hero-logo" src={logo}/></div><div className="entry-intro"><span className="entry-kicker">SECURE • SIMPLE • CONNECTED</span><h1>How do you want to enter?</h1><p>Select your role to continue to WebInternDev.</p></div><div className="role-grid"><RoleCard title="Admin" desc="Monitor meetings and manage the platform" onClick={()=>onSelect('admin')} icon="admin"/><RoleCard title="Host" desc="Create meetings and share your screen" onClick={()=>onSelect('host')} icon="host"/><RoleCard title="User" desc="Join an active meeting and collaborate" onClick={()=>onSelect('user')} icon="user"/></div><div className="entry-footer"><span>WebInternDev</span><span>Professional meeting workspace</span></div></div></section>}
function RoleCard({title,desc,onClick,icon}){const paths={admin:<><path d="M4 19.5V9.8L12 5l8 4.8v9.7"/><path d="M8 19.5v-6h8v6M3 19.5h18M9 9.5h6"/></>,host:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 9 5 3-5 3V9ZM16 9h2M16 12h2M16 15h2"/></>,user:<><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"/></>};return <button className="role-card" onClick={onClick}><span className="role-icon"><svg viewBox="0 0 24 24">{paths[icon]}</svg></span><span>{title}</span><small>{desc}</small><strong>Continue <i>→</i></strong></button>}
function Login({role,name,setName,password,setPassword,onSubmit,onBack}){return <section className="center"><div className="panel login-panel"><div className="login-mark">{role==='admin'?'A':role==='host'?'H':'U'}</div><h1>{role==='admin'?'Admin Login':role==='host'?'Host Login':'User Login'}</h1><p className="muted">{role==='admin'?'Use the administrator account.':'Enter your name and shared role password.'}</p><form onSubmit={onSubmit}><label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder={role==='admin'?'Bastaoang Jayson A':'Enter your name'} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/></label><button className="primary wide">Continue</button></form><button className="link-btn" onClick={onBack}>← Back</button></div></section>}
function Dashboard({role,name,rooms,onCreate,onJoin,onEnd,onOpenAdmin,adminView,credentials,setCredentials,attendance,users,setUsers,toast}){
 const [selectedRoom,setSelectedRoom]=useState(null);
 return <section className="dashboard"><div className="welcome"><div><span className="eyebrow">Welcome to WebInternDev!</span><h1>{name||role}</h1><p className="muted">{role==='admin'?'Monitor and manage your meeting platform.':role==='host'?'Create a room and present to up to 50 participants.':'Choose an active meeting to join.'}</p></div>{role==='host'&&<button className="primary" onClick={onCreate}>＋ Create Meeting</button>}</div>
 {role==='admin'&&<div className="stats"><Stat n={rooms.length} t="Active Meetings"/><Stat n={rooms.reduce((a,r)=>a+r.participants,0)} t="Participants"/><Stat n="50" t="Capacity / Room"/><Stat n="2" t="Room Limit"/></div>}
 <div className="section-head"><h2>{role==='admin'?'Active Meetings':'Available Meetings'}</h2><span>{rooms.length}/2 active</span></div><div className="room-grid">{rooms.length?rooms.map(r=><RoomCard key={r.id} room={r} role={role} onJoin={()=>{setSelectedRoom(r);onJoin(r)}} onEnd={()=>onEnd(r)}/>):<div className="empty"><b>No active meetings</b><p>{role==='host'?'Create your first meeting to get started.':'Wait for a Host to create a meeting.'}</p></div>}</div>
 {role==='admin'&&<><div className="section-head"><h2>Admin controls</h2></div><div className="control-grid"><AdminControl title="User Management" icon="users" desc="View users who have entered WebInternDev and manage their access." onClick={()=>onOpenAdmin('users')}/><AdminControl title="Password Management" icon="lock" desc="Change the Host and User shared passwords." onClick={()=>onOpenAdmin('passwords')}/><AdminControl title="Attendance" icon="calendar" desc="View join time, leave time, duration, room and participant history." onClick={()=>onOpenAdmin('attendance')}/></div>{adminView&&<AdminPanel view={adminView} close={()=>onOpenAdmin(null)} credentials={credentials} setCredentials={setCredentials} attendance={attendance} users={users} setUsers={setUsers} toast={toast}/>}</>}
 </section>
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
function Meeting({role,name,room,avatar,camera,mic,sharing,pinned,setCamera,setMic,setSharing,setPinned,onLeave,onEnd}){return <section className="meeting"><div className="meeting-head"><div><b>{room.title}</b><span className="muted"> • {room.participants}/50</span></div><span className="live">● LIVE</span></div><div className={`stage ${pinned?'pinned':''}`}><div className="main-tile">{sharing?<div className="share-preview"><div className="fake-slide"><span>WebInternDev Presentation</span><b>Screen sharing preview</b><small>LiveKit screen sharing will appear here in production.</small></div><span className="share-label">🖥️ {name} is sharing screen</span></div>:camera?<div className="camera-preview">Camera preview</div>:<div className="avatar-view"><img src={avatar}/><span>{name}</span></div>}</div><div className="thumbs"><div className="thumb"><img src={avatar}/><span>{name} • {role}</span></div>{[1,2,3,4].map(i=><div className="thumb" key={i}><img src={avatar}/><span>Participant {i}</span></div>)}</div></div><div className="meeting-controls"><button className={mic?'control active':'control'} onClick={()=>setMic(!mic)}>{mic?'🎤':'🔇'}</button><button className={camera?'control active':'control'} onClick={()=>setCamera(!camera)}>{camera?'📹':'📷'}</button>{role==='host'&&<><button className={sharing?'control active':'control'} onClick={()=>{setSharing(!sharing);if(sharing)setPinned(false)}}>🖥️</button><button disabled={!sharing} className={pinned?'control active':'control'} onClick={()=>setPinned(!pinned)}>📌</button></>}<button className="control">💬</button><button className="control">👥</button>{role==='host'?<button className="danger control" onClick={onEnd}>End</button>:<button className="danger control" onClick={onLeave}>Leave</button>}</div>{role==='host'&&<div className="host-note">Host controls: screen share + pin/unpin. Pinning is responsive across desktop, tablet, and mobile.</div>}</section>}
createRoot(document.getElementById('root')).render(<App/>);
