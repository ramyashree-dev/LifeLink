import './App.css';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowRight, Bell, Check, ChevronRight, Clock3, Droplets, Heart, Hospital, LogIn, LogOut, MapPin, Menu, Search, ShieldCheck, Siren, Stethoscope, UserRound, Users, X } from 'lucide-react';

type Profile = { user_id: string; role: 'donor'|'requester'|'hospital'|'admin'; full_name: string; email?: string|null; phone?: string|null; city?: string|null; state?: string|null };
type Donor = { id:string; user_id:string; blood_group:string; available:boolean; emergency_available:boolean; verified:boolean; last_active_at:string; full_name:string; city:string; state:string; pin_code?: string|null; organ_donation_interest?: boolean; last_donation_date?: string|null };
type BloodRequest = { id:string; blood_group:string; units_required:number; urgency:string; status:string; location:string; created_at:string; hospital_id:string|null; requester_id:string; patient_reference?: string|null; notes?: string|null };
type DonorMatch = { id:string; request_id:string; donor_id:string; status:string; match_score:number; created_at:string; blood_requests?: BloodRequest };
type OrganInterest = { user_id:string; interest_status:string; organ_preferences:string[]; consent:boolean; notes?: string|null };
type Hospital = { id:string; user_id:string; hospital_name:string; registration_number?:string|null; address?:string|null; city?:string|null; state?:string|null; pin_code?:string|null; phone?:string|null; verification_status:'pending'|'verified'|'rejected'; verified_at?:string|null; created_at:string };

const demoAccounts = [{ label:'Donor demo', email:'donor@lifelink.demo' }, { label:'Requester demo', email:'requester@lifelink.demo' }, { label:'Hospital demo', email:'hospital@lifelink.demo' }, { label:'Admin demo', email:'admin@lifelink.demo' }];
const bloodGroups = ['All blood groups','A+','A-','B+','B-','AB+','AB-','O+','O-'];
const bloodGroupList = bloodGroups.slice(1);
const compatibleDonorGroups:(needed:string)=>string[]=(needed:string)=>{const m:{[k:string]:string[]}={'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+']};return m[needed]||[needed];};

function Logo(): ReactNode { return <a className="logo" href="#/"><span className="logo-mark"><Droplets size={20} fill="currentColor" /></span>LifeLink</a>; }
function Header({ user, profile, onLogout }: { user:User|null; profile:Profile|null; onLogout:()=>void }): ReactNode {
  return <><header className="nav"><div className="container" style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}><Logo /><nav className="nav-links"><a href="#/find-donors">Find donors</a><a href="#/how-it-works">How it works</a><a href="#/organ-donation">Organ donation</a><a href="#/hospitals">Hospitals</a></nav><div className="nav-actions">{user ? <><a className="icon-btn" href="#/notifications" aria-label="Notifications"><Bell size={17}/><span className="dot" /></a><a className="btn btn-soft" href={profile?.role==='hospital'?'#/hospital/dashboard':profile?.role==='admin'?'#/admin/hospitals':'#/dashboard'}>{profile?.full_name?.split(' ')[0] || 'Dashboard'}</a><button className="btn btn-outline" onClick={onLogout} aria-label="Sign out"><LogOut size={16}/> Sign out</button></> : <><a className="btn btn-outline" href="#/login">Sign in</a><a className="btn btn-primary" href="#/register">Become a donor <ArrowRight size={15}/></a></>}</div></div></header><nav className="mobile-nav"><a href="#/requests"><Siren size={17}/><span>Emergency</span></a><a href="#/find-donors"><Search size={17}/><span>Find donor</span></a><a href="#/register"><Heart size={17}/><span>Donate</span></a><a href="#/notifications"><Bell size={17}/><span>Alerts</span></a></nav></>;
}
function Footer(): ReactNode { return <footer className="footer"><div className="container"><div className="footer-grid"><div><Logo/><p style={{fontSize:13,lineHeight:1.7,maxWidth:240}}>Making life-saving blood donation coordination simpler, safer, and more human.</p></div><div><h4>Explore</h4><a href="#/about">About LifeLink</a><a href="#/how-it-works">How it works</a><a href="#/blood-donation">Blood donation</a><a href="#/organ-donation">Organ donation</a></div><div><h4>Get involved</h4><a href="#/find-donors">Find donors</a><a href="#/register">Become a donor</a><a href="#/hospitals">For hospitals</a><a href="#/contact">Contact us</a></div><div><h4>Important</h4><a href="#/faq">Frequently asked questions</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/disclaimer">Medical disclaimer</a></div></div><div className="footer-bottom"><span>© 2026 LifeLink. Built for communities.</span><span>LifeLink is not a replacement for medical care.</span></div></div></footer>; }
function Layout({ children, user, profile, onLogout }: { children:ReactNode; user:User|null; profile:Profile|null; onLogout:()=>void }): ReactNode { return <div className="app-shell"><Header user={user} profile={profile} onLogout={onLogout}/>{children}<Footer/></div>; }

function Home(): ReactNode { return <><main><section className="hero"><div className="container hero-grid"><div><div className="eyebrow">A network built around care</div><h1>Every second matters. Every donor can save a life.</h1><p className="lead">Find blood donors, connect with hospitals, and help make life-saving donations easier — one meaningful connection at a time.</p><div className="hero-actions"><a className="btn btn-primary" href="#/find-donors">Find blood donors <ArrowRight size={16}/></a><a className="btn btn-outline" href="#/register">Become a donor</a></div><a className="emergency-link" href="#/requests"><Siren size={16}/> Need blood urgently? Start an emergency request</a></div><div className="hero-art"><div className="hero-circle"/><div className="hero-card"><div className="heart-shape"><Heart size={36} fill="currentColor"/></div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><strong style={{fontFamily:'Manrope'}}>Your request is moving</strong><div className="muted" style={{fontSize:12,marginTop:5}}>3 compatible donors found nearby</div></div><span className="status status-green">Matching</span></div><div className="progress-line"><span/></div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#687386',marginTop:9}}><span>Request created</span><span>72% connected</span></div></div></div></div></section><section className="stats-strip"><div className="container stats"><div className="stat"><strong>2,480+</strong><span>Registered donors</span></div><div className="stat"><strong>84</strong><span>Verified hospitals</span></div><div className="stat"><strong>1,230</strong><span>Requests supported</span></div><div className="stat"><strong>96%</strong><span>Response rate</span></div></div></section><section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">Simple when it matters most</div><h2 style={{marginTop:12}}>How LifeLink works</h2></div><p className="muted">A clear path from an urgent need to a coordinated donation, with hospitals and people kept in the loop.</p></div><div className="workflow">{['Create a request','Find compatible donors','Donors respond','Hospital confirms','Donation completed'].map((x,i)=><div className="step" key={x}><div className="step-num">0{i+1}</div><h3>{x}</h3><p>{['Share only what is needed so the right people can help quickly.','We surface suitable, available donors by blood group and location.','Donors choose whether they can help — no pressure, no public contact details.','Qualified hospital teams guide the next safe step.','Update the request and celebrate a connection that made a difference.'][i]}</p></div>)}</div></div></section><section className="section" style={{background:'white'}}><div className="container"><div className="center"><div className="eyebrow" style={{justifyContent:'center'}}>More ways to help</div><h2 style={{marginTop:12}}>Care has more than one shape</h2><p className="lead">Whether you give blood today or learn about organ donation for tomorrow, small actions create stronger communities.</p></div><div className="info-grid" style={{marginTop:34}}><InfoCard icon={<Droplets/>} cls="red-bg" title="Why donate blood?" text="A single blood donation can support multiple patients. Learn about eligibility, preparation, and what to expect." link="#/blood-donation"/><InfoCard icon={<Heart/>} cls="green-bg" title="Organ donation awareness" text="Understand the process, explore common myths, and record your interest — without confusing it with legal registration." link="#/organ-donation"/><InfoCard icon={<Hospital/>} cls="blue-bg" title="For hospitals" text="Coordinate requests, confirm matches, and keep your care team connected with the people who want to help." link="#/hospitals"/></div></div></section><section className="section"><div className="container"><div className="disclaimer"><strong>Medical disclaimer:</strong> LifeLink is a coordination and awareness platform. It does not provide medical diagnosis, treatment, or medical eligibility decisions. Blood compatibility, donation eligibility, transfusion decisions, and organ donation procedures must always be confirmed by qualified healthcare professionals and authorized organizations.</div></div></section></main></> }
function InfoCard({icon,cls,title,text,link}:{icon:ReactNode;cls:string;title:string;text:string;link:string}):ReactNode { return <div className="info-card"><div className={`info-icon ${cls}`}>{icon}</div><h3>{title}</h3><p className="muted" style={{fontSize:14}}>{text}</p><a href={link} style={{color:'var(--red)',fontSize:13,fontWeight:800,display:'inline-flex',gap:5,alignItems:'center'}}>Learn more <ChevronRight size={14}/></a></div> }

function friendlyAuthError(msg: string): string { const m = (msg||'').toLowerCase(); if (m.includes('database error querying schema')) return 'We could not reach your account. Please try again — if the problem continues, contact support.'; if (m.includes('invalid login credentials')) return 'That email and password combination does not match an account.'; if (m.includes('user already registered')) return 'An account with this email already exists. Try signing in instead.'; if (m.includes('email rate limit')) return 'Too many attempts. Please wait a moment and try again.'; if (m.includes('weak_password') || m.includes('password is known') || m.includes('easy to guess')) return 'That password is too common or easy to guess. Please choose a stronger password.'; if (m.includes('password should be at least')) return 'Password must be at least 6 characters long.'; if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Please enter a valid email address.'; if (m.trim()) return msg; return 'Something went wrong. Please check your details and try again.'; }

function Auth({ mode, onAuth }: { mode:'login'|'register'; onAuth:(user:User)=>void }):ReactNode {
  const [email,setEmail]=useState(mode==='login'?'donor@lifelink.demo':'');
  const [password,setPassword]=useState(mode==='login'?'Demo1234!':'');
  const [name,setName]=useState('');
  const [role,setRole]=useState<'donor'|'requester'|'hospital'>('donor');
  const [phone,setPhone]=useState('');
  const [bloodGroup,setBloodGroup]=useState('O+');
  const [city,setCity]=useState('');
  const [stateVal,setStateVal]=useState('');
  const [donationType,setDonationType]=useState<'blood'|'organ'>('blood');
  const [available,setAvailable]=useState(true);
  const [emergencyAvailable,setEmergencyAvailable]=useState(false);
  const [lastDonationDate,setLastDonationDate]=useState('');
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [busy,setBusy]=useState(false);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setInfo('');
    try {
      if(mode==='register'){
        const signUpResult=await supabase.auth.signUp({
          email,
          password,
          options:{
            data:{
              full_name:name,
              role,
              phone:phone||null,
              city:city||null,
              state:stateVal||null,
              blood_group:bloodGroup,
              donation_type:donationType,
              available,
              emergency_available:emergencyAvailable,
              last_donation_date:lastDonationDate||null
            }
          }
        });
        if(signUpResult.error){setError(friendlyAuthError(signUpResult.error.message));return;}
        if(signUpResult.data.user){
          onAuth(signUpResult.data.user);
        }
      } else {
        const signInResult=await supabase.auth.signInWithPassword({email,password});
        if(signInResult.error){setError(friendlyAuthError(signInResult.error.message));return;}
        if(signInResult.data.user){ onAuth(signInResult.data.user); }
      }
    } catch(err){
      setError(friendlyAuthError(err instanceof Error ? err.message : ''));
    } finally { setBusy(false); }
  };

  const resetPassword=async()=>{if(!email){setError('Enter your email address first.');return}setBusy(true);setError('');try{const {error:re}=await supabase.auth.resetPasswordForEmail(email);setInfo(re?friendlyAuthError(re.message):'If that email is registered, a reset link has been sent.');}catch(err){setError(friendlyAuthError(err instanceof Error?err.message:''));}finally{setBusy(false);}};

  const demoLogin=async(demoEmail:string)=>{
    setBusy(true);setError('');
    try{
      const signInResult=await supabase.auth.signInWithPassword({email:demoEmail,password:'Demo1234!'});
      if(signInResult.error){setError(friendlyAuthError(signInResult.error.message));return;}
      if(signInResult.data.user){onAuth(signInResult.data.user);}
    }catch(err){
      setError(friendlyAuthError(err instanceof Error?err.message:''));
    }finally{setBusy(false);}
  };

  return <div className="auth-wrap"><div className="auth-card" style={{width:min(mode==='register'&&role==='donor'?520:430,'calc(100% - 30px)')}}><div className="eyebrow">{mode==='login'?'Welcome back':'Join the network'}</div><h1>{mode==='login'?'Sign in to LifeLink':'Create your account'}</h1><p className="muted">{mode==='login'?'Continue coordinating care with your community.':'Choose how you would like to take part.'}</p>{error&&<div className="alert error">{error}</div>}{info&&<div className="alert success">{info}</div>}<form onSubmit={submit}>{mode==='register'&&<><div className="field" style={{marginTop:20}}><label>Full name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></div><div className="field" style={{marginTop:15}}><label>I am joining as</label><select className="select" value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="donor">A blood donor</option><option value="requester">Someone looking for blood</option><option value="hospital">A hospital or care team</option></select></div>{role==='donor'&&<div className="form-grid" style={{marginTop:15}}><div className="field"><label>Phone number</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></div><div className="field"><label>Blood group</label><select className="select" value={bloodGroup} onChange={e=>setBloodGroup(e.target.value)}>{bloodGroupList.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>City</label><input className="input" value={city} onChange={e=>setCity(e.target.value)} placeholder="Bengaluru"/></div><div className="field"><label>State</label><input className="input" value={stateVal} onChange={e=>setStateVal(e.target.value)} placeholder="Karnataka"/></div><div className="field"><label>Donation type</label><select className="select" value={donationType} onChange={e=>setDonationType(e.target.value as 'blood'|'organ')}><option value="blood">Blood donation</option><option value="organ">Organ donation interest</option></select></div><div className="field"><label>Available to donate?</label><select className="select" value={available?'yes':'no'} onChange={e=>setAvailable(e.target.value==='yes')}><option value="yes">Yes, I am available</option><option value="no">Not right now</option></select></div><div className="field"><label>Emergency available?</label><select className="select" value={emergencyAvailable?'yes':'no'} onChange={e=>setEmergencyAvailable(e.target.value==='yes')}><option value="yes">Yes, for emergencies</option><option value="no">Not for emergencies</option></select></div><div className="field"><label>Last donation date <span className="muted" style={{fontWeight:400}}>(optional)</span></label><input className="input" type="date" value={lastDonationDate} onChange={e=>setLastDonationDate(e.target.value)}/></div></div>}</>}<div className="field" style={{marginTop:15}}><label>Email address</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></div><div className="field" style={{marginTop:15}}><label>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/></div><button className="btn btn-primary" disabled={busy} style={{width:'100%'}}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'} <ArrowRight size={15}/></button></form>{mode==='login'&&<div style={{marginTop:18}}><div className="muted" style={{fontSize:11,fontWeight:700,marginBottom:8}}>Try a fictional demo account</div><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{demoAccounts.map(a=><button className="tag" key={a.email} disabled={busy} onClick={()=>void demoLogin(a.email)}>{a.label}</button>)}</div></div>}<div className="auth-foot">{mode==='login'?<>New to LifeLink? <a href="#/register">Create an account</a></>:<>Already have an account? <a href="#/login">Sign in</a></>}</div></div></div>;
}

function Dashboard({ profile, user }: {profile:Profile|null;user:User}):ReactNode {
  const [requests,setRequests]=useState<BloodRequest[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [activeRequestsCount,setActiveRequestsCount]=useState(0);
  const [matchedDonorsCount,setMatchedDonorsCount]=useState(0);
  const [incomingCount,setIncomingCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const donor=profile?.role==='donor';

  useEffect(()=>{
    void (async()=>{
      setLoading(true);
      try {
        if(donor){
          const matches=await supabase.from('donor_matches').select('id,request_id,status,blood_requests!inner(id,blood_group,units_required,urgency,status,location,created_at,patient_reference,notes,requester_id)').eq('donor_id',user.id).order('created_at',{ascending:false}).limit(5);
          if(matches.data){
            const reqs:BloodRequest[]=(matches.data as any[]).map((m:any)=>m.blood_requests).filter(Boolean);
            setRequests(reqs);
            setIncomingCount((matches.data as any[]).filter((m:any)=>m.status==='pending').length);
          }
          const allMatches=await supabase.from('donor_matches').select('id,status',{count:'exact',head:true}).eq('donor_id',user.id);
          setMatchedDonorsCount(allMatches.count||0);
        } else {
          const r=await supabase.from('blood_requests').select('id,blood_group,units_required,urgency,status,location,created_at,hospital_id,patient_reference,notes,requester_id').eq('requester_id',user.id).order('created_at',{ascending:false}).limit(5);
          if(r.data)setRequests(r.data as BloodRequest[]);
          const active=await supabase.from('blood_requests').select('id',{count:'exact',head:true}).eq('requester_id',user.id).in('status',['pending','matching','donors_contacted','donor_accepted','hospital_confirmation']);
          setActiveRequestsCount(active.count||0);
          const matched=await supabase.from('donor_matches').select('id',{count:'exact',head:true}).eq('blood_requests.requester_id',user.id);
          setMatchedDonorsCount(matched.count||0);
        }
        const n=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('read',false);
        setUnreadCount(n.count||0);
      } finally { setLoading(false); }
    })();
  },[user.id,donor]);

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Your LifeLink</div><h1 style={{fontSize:38,marginTop:10}}>Good to see you, {profile?.full_name?.split(' ')[0]||'there'}.</h1><p>Here is what needs your attention today.</p></div><div className="dashboard-grid">{donor?<>
    <Metric icon={<Droplets/>} value={loading?'…':String(incomingCount)} label="Incoming requests"/>
    <Metric icon={<Activity/>} value={loading?'…':String(matchedDonorsCount)} label="Total matches"/>
    <Metric icon={<Bell/>} value={String(unreadCount)} label="Unread notifications"/>
    <Metric icon={<ShieldCheck/>} value={profile?.city||'—'} label="Your city"/>
  </>:<>
    <Metric icon={<Droplets/>} value={loading?'…':String(activeRequestsCount)} label="Active requests"/>
    <Metric icon={<Activity/>} value={loading?'…':String(matchedDonorsCount)} label="Matched donors"/>
    <Metric icon={<Bell/>} value={String(unreadCount)} label="Unread notifications"/>
    <Metric icon={<ShieldCheck/>} value={loading?'…':'96%'} label="Response rate"/>
  </>}</div><div className="panel-grid"><div className="panel"><div className="panel-header"><h3>{donor?'Incoming requests':'Recent blood requests'}</h3><a href={donor?'#/donor/requests':'#/my-requests'} style={{fontSize:12,color:'var(--red)',fontWeight:800}}>View all</a></div>{loading?<Empty text="Loading…"/>:requests.length?requests.map(r=><RequestRow key={r.id} request={r}/>):<Empty text={donor?"No incoming requests yet.":"No active requests yet."}/>}</div><div className="panel"><div className="panel-header"><h3>Quick actions</h3></div><div style={{display:'grid',gap:9}}><a className="btn btn-primary" href={donor?'#/donor/requests':'#/requests/create'}>{donor?'View requests':'Create blood request'} <ArrowRight size={15}/></a><a className="btn btn-outline" href="#/profile"><UserRound size={15}/> Update profile</a><a className="btn btn-outline" href="#/organ-donation"><Heart size={15}/> Organ donation interest</a>{!donor&&<a className="btn btn-outline" href="#/find-donors"><Search size={15}/> Find donors</a>}</div></div></div><div className="disclaimer" style={{marginTop:20}}><strong>Remember:</strong> LifeLink helps coordinate connections. Your hospital or qualified medical team always makes the final eligibility and treatment decisions.</div></div></main>;
}
function Metric({icon,value,label}:{icon:ReactNode;value:string;label:string}):ReactNode{return <div className="metric-card"><div><span>{label}</span><strong>{value}</strong></div><div className="metric-icon">{icon}</div></div>}
function RequestRow({request:r}:{request:BloodRequest}):ReactNode{return <div className="request-row"><div className="request-meta"><div className="blood-badge">{r.blood_group}</div><div><strong>{r.units_required} unit{r.units_required!==1?'s':''} needed</strong><small>{r.location||'Location shared privately'} · {r.urgency}</small></div></div><span className={`status ${r.urgency==='emergency'?'status-red':r.status==='fulfilled'?'status-green':'status-blue'}`}>{r.status.replace(/_/g,' ')}</span></div>}
function Empty({text}:{text:string}):ReactNode{return <div style={{padding:'30px 0',textAlign:'center'}} className="muted">{text}</div>}

function FindDonors({ user, profile }: {user:User|null; profile:Profile|null}):ReactNode {
  const [donors,setDonors]=useState<Donor[]>([]);
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState('All blood groups');
  const [availFilter,setAvailFilter]=useState('Available now');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState<string|null>(null);
  const [sendResult,setSendResult]=useState<{donorId:string;msg:string;ok:boolean}|null>(null);
  const [activeRequests,setActiveRequests]=useState<BloodRequest[]>([]);
  const [showPicker,setShowPicker]=useState<string|null>(null);
  const [compatOnly,setCompatOnly]=useState(false);

  useEffect(()=>{void (async()=>{
    const result=await supabase.from('donor_public').select('*').order('last_active_at',{ascending:false});
    if(result.data)setDonors(result.data as Donor[]);
    setLoading(false);
  })();},[]);

  useEffect(()=>{void (async()=>{
    if(user){
      const r=await supabase.from('blood_requests').select('id,blood_group,units_required,urgency,status,location,created_at,hospital_id,patient_reference,notes,requester_id').eq('requester_id',user.id).in('status',['pending','matching','donors_contacted','donor_accepted','hospital_confirmation']).order('created_at',{ascending:false});
      if(r.error){
        console.error('Failed to load active blood requests:',r.error.message);
        setSendResult({donorId:'',msg:'Could not load your blood requests. Please reload the page.',ok:false});
      } else {
        setActiveRequests(r.data as BloodRequest[]);
      }
    }
  })();},[user]);

  const compatGroups=useMemo(()=>{const s=new Set<string>();activeRequests.forEach(r=>compatibleDonorGroups(r.blood_group).forEach(g=>s.add(g)));return s;},[activeRequests]);

  const filtered=useMemo(()=>donors.filter(d=>{
    if(compatOnly&&compatGroups.size>0&&!compatGroups.has(d.blood_group))return false;
    if(group!=='All blood groups'&&d.blood_group!==group)return false;
    if(!query||!`${d.full_name} ${d.city} ${d.state}`.toLowerCase().includes(query.toLowerCase())){
      if(query)return false;
    }
    if(availFilter==='Available now'&&!d.available)return false;
    if(availFilter==='Emergency available'&&!d.emergency_available)return false;
    return true;
  }),[donors,group,query,availFilter,compatOnly,compatGroups]);

  const sendRequest=async(donorId:string,requestId:string)=>{
    setSending(donorId);setShowPicker(null);
    try{
      const{data:existing}=await supabase.from('donor_matches').select('id').eq('request_id',requestId).eq('donor_id',donorId).maybeSingle();
      if(existing){setSendResult({donorId,msg:'A request has already been sent to this donor for that blood request.',ok:false});return;}
      const{error}=await supabase.from('donor_matches').insert({request_id:requestId,donor_id:donorId,status:'pending',match_score:0});
      if(error){setSendResult({donorId,msg:error.message,ok:false});return;}
      const{data:reqData}=await supabase.from('blood_requests').select('blood_group,units_required,urgency,location').eq('id',requestId).maybeSingle();
      const reqInfo=reqData as BloodRequest|null;
      await supabase.from('notifications').insert({user_id:donorId,title:'New donation request',message:`${reqInfo?.blood_group||''} blood needed — ${reqInfo?.units_required||1} unit(s) at ${reqInfo?.location||'a location'}. Urgency: ${reqInfo?.urgency||'normal'}.`,type:'request'});
      await supabase.from('blood_requests').update({status:'donors_contacted'}).eq('id',requestId);
      setSendResult({donorId,msg:'Your request has been sent to the donor. They will see it in their dashboard.',ok:true});
    }catch(err){setSendResult({donorId,msg:err instanceof Error?err.message:'Failed to send request',ok:false});}
    finally{setSending(null);}
  };

  const onRequestClick=(donorId:string)=>{
    if(!user){window.location.hash='/login';return;}
    if(activeRequests.length===0){setSendResult({donorId,msg:'You need to create a blood request first before sending it to a donor.',ok:false});return;}
    if(activeRequests.length===1){void sendRequest(donorId,activeRequests[0].id);}
    else{setShowPicker(donorId);}
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Find help, safely</div><h1 style={{fontSize:40,marginTop:10}}>Find a blood donor</h1><p>Search available donors by blood group and approximate location. Contact details are shared only through consent-based interactions.</p></div><div className="search-bar"><div style={{position:'relative',flex:1}}><Search size={17} style={{position:'absolute',left:13,top:13,color:'#97a2b2'}}/><input className="input" style={{paddingLeft:40}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, city, or state"/></div><div className="filters"><select className="select" value={group} onChange={e=>setGroup(e.target.value)}>{bloodGroups.map(g=><option key={g}>{g}</option>)}</select><select className="select" value={availFilter} onChange={e=>setAvailFilter(e.target.value)}><option>Available now</option><option>Emergency available</option><option>All donors</option></select>{user&&activeRequests.length>0&&<button type="button" className={`tag ${compatOnly?'status-green':''}`} style={{cursor:'pointer',border:compatOnly?'1px solid var(--green)':'1px solid var(--line)',whiteSpace:'nowrap'}} onClick={()=>setCompatOnly(!compatOnly)}>{compatOnly&&<Check size={12} style={{display:'inline',marginRight:3}}/>}Compatible only</button>}</div></div>{!user&&<div className="alert success"><strong>Want to request a donor?</strong> <a href="#/login" style={{textDecoration:'underline'}}>Sign in</a> to coordinate a private request.</div>}{sendResult&&sendResult.donorId&&<div className={`alert ${sendResult.ok?'success':'error'}`}>{sendResult.msg}</div>}{showPicker&&<div style={{background:'white',border:'1px solid var(--line)',borderRadius:14,padding:20,marginBottom:18}}><h3 style={{fontSize:17,marginBottom:12}}>Select a blood request to send</h3>{activeRequests.map(r=><div key={r.id} className="request-row" style={{cursor:'pointer'}} onClick={()=>void sendRequest(showPicker,r.id)}><div className="request-meta"><div className="blood-badge">{r.blood_group}</div><div><strong>{r.units_required} unit(s) needed</strong><small>{r.location||'Location shared'} · {r.urgency}</small></div></div><ArrowRight size={16} style={{color:'var(--red)'}}/></div>)}<button className="btn btn-outline" style={{marginTop:10}} onClick={()=>setShowPicker(null)}>Cancel</button></div>}{loading?<div className="panel"><Empty text="Loading available donors…"/></div>:filtered.length?<div className="donor-grid">{filtered.map(d=><DonorCard key={d.id} donor={d} user={user} sending={sending===d.user_id} compatible={compatGroups.has(d.blood_group)} hasRequests={activeRequests.length>0} onRequest={()=>onRequestClick(d.user_id)}/>)}</div>:<div className="panel"><Empty text="No compatible donors found nearby. Try expanding your search or checking another location."/></div>}<div className="disclaimer" style={{marginTop:22}}>Donor matching is for coordination only and is not a medical decision. Blood compatibility and donation eligibility must always be confirmed by qualified healthcare professionals.</div></div></main>;
}
function DonorCard({donor:d,user,sending,onRequest,compatible,hasRequests}:{donor:Donor;user:User|null;sending:boolean;compatible:boolean;hasRequests:boolean;onRequest:()=>void}):ReactNode{return <div className="donor-card"><div className="donor-top"><div className="avatar">{d.full_name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div>{d.verified&&<span className="verified"><ShieldCheck size={14}/> Verified</span>}</div><h3>{d.full_name.split(' ')[0]}</h3><div className="donor-location"><MapPin size={13} style={{verticalAlign:'-2px'}}/> {d.city}, {d.state}</div><div className="donor-tags"><span className="tag blood">{d.blood_group}</span><span className={`tag ${d.available?'status-green':'status-gray'}`}>{d.available?'Available':'Unavailable'}</span>{d.emergency_available&&<span className="tag">Emergency ready</span>}{d.organ_donation_interest&&<span className="tag">Organ interest</span>}{hasRequests&&compatible&&<span className="tag status-green">Compatible</span>}{hasRequests&&!compatible&&<span className="tag status-gray">Not compatible</span>}</div>{d.last_donation_date&&<small style={{color:'var(--muted)',fontSize:11,display:'block',marginTop:4}}>Last donated: {new Date(d.last_donation_date).toLocaleDateString()}</small>}<button className="btn btn-primary" disabled={sending} onClick={onRequest}>{sending?'Sending…':<>Request donation <ArrowRight size={14}/></>}</button></div>}

function CreateRequest({user,hospitalId}:{user:User;hospitalId?:string|null}):ReactNode {
  const [form,setForm]=useState({blood_group:'O+',units_required:1,urgency:'normal',location:'Bengaluru',required_date:'',required_time:'',patient_reference:'',notes:''});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const update=(key:string,value:string|number)=>setForm({...form,[key]:value});
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage('');
    const{error}=await supabase.from('blood_requests').insert({...form,requester_id:user.id,hospital_id:hospitalId||null,status:'matching'});
    if(error){setMessage(error.message);}
    else{setMessage('Request created. Matching donors will be notified. Go to Find donors to send it to specific donors.');}
    setBusy(false);
  };
  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Start a request</div><h1 style={{fontSize:40,marginTop:10}}>Tell us what is needed</h1><p>Share the essentials. Your hospital or care team should confirm all medical details.</p></div>{message&&<div className={`alert ${message.startsWith('Request')?'success':'error'}`}>{message}</div>}<form className="form-card" onSubmit={submit}><div className="form-grid"><div className="field"><label>Required blood group</label><select className="select" value={form.blood_group} onChange={e=>update('blood_group',e.target.value)}>{bloodGroupList.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>Units required</label><input className="input" type="number" min={1} max={20} value={form.units_required} onChange={e=>update('units_required',Number(e.target.value))}/></div><div className="field full"><label>How urgent is this?</label><div className="radio-grid">{[['normal','Normal'],['urgent','Urgent'],['emergency','Emergency']].map(([v,l])=><div key={v} className={`radio-card ${form.urgency===v?'active':''}`} onClick={()=>update('urgency',v)}>{v==='emergency'&&<Siren size={14} style={{verticalAlign:'-2px',marginRight:5}}/>}{l}<div className="muted" style={{fontSize:11,fontWeight:400,marginTop:4}}>{v==='emergency'?'Needs immediate attention':'Plan ahead with support'}</div></div>)}</div></div><div className="field"><label>Hospital or care location</label><input className="input" value={form.location} onChange={e=>update('location',e.target.value)} required/></div><div className="field"><label>Patient reference</label><input className="input" value={form.patient_reference} onChange={e=>update('patient_reference',e.target.value)} placeholder="First name or reference code" required/></div><div className="field"><label>Required date</label><input className="input" type="date" value={form.required_date} onChange={e=>update('required_date',e.target.value)}/></div><div className="field"><label>Required time</label><input className="input" type="time" value={form.required_time} onChange={e=>update('required_time',e.target.value)}/></div><div className="field full"><label>Additional notes <span className="muted" style={{fontWeight:400}}>(optional)</span></label><textarea className="textarea" rows={4} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Anything donors or the hospital should know?"/></div></div>{form.urgency==='emergency'&&<div className="alert error" style={{marginTop:20}}><strong>For life-threatening emergencies, contact local emergency medical services and the treating hospital immediately.</strong> LifeLink is not a replacement for emergency medical care.</div>}<div className="form-actions"><a className="btn btn-outline" href="#/dashboard">Cancel</a><button className="btn btn-primary" disabled={busy}>{busy?'Creating…':'Create blood request'} <ArrowRight size={15}/></button></div></form></div></main>;
}

function HospitalRegister({user}:{user:User}):ReactNode {
  const [form,setForm]=useState({hospital_name:'',registration_number:'',address:'',city:'',state:'',pin_code:'',phone:''});
  const [existing,setExisting]=useState<Hospital|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const update=(key:string,value:string)=>setForm({...form,[key]:value});
  useEffect(()=>{void (async()=>{
    const{data}=await supabase.from('hospitals').select('*').eq('user_id',user.id).maybeSingle();
    if(data){setExisting(data as Hospital);setForm({hospital_name:(data as any).hospital_name||'',registration_number:(data as any).registration_number||'',address:(data as any).address||'',city:(data as any).city||'',state:(data as any).state||'',pin_code:(data as any).pin_code||'',phone:(data as any).phone||''});}
  })();},[user.id]);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage('');
    const{error}=await supabase.from('hospitals').upsert({user_id:user.id,hospital_name:form.hospital_name,registration_number:form.registration_number||null,address:form.address||null,city:form.city||null,state:form.state||null,pin_code:form.pin_code||null,phone:form.phone||null},{onConflict:'user_id'});
    if(error){setMessage(error.message);}
    else{setMessage('Hospital details saved. Your verification status will be reviewed by our team.');const{data}=await supabase.from('hospitals').select('*').eq('user_id',user.id).maybeSingle();if(data)setExisting(data as Hospital);}
    setBusy(false);
  };
  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Hospital verification</div><h1 style={{fontSize:40,marginTop:10}}>Register your hospital</h1><p>Submit your hospital details for verification. Verified hospitals can create and manage blood requests on LifeLink.</p></div>{message&&<div className={`alert ${message.startsWith('Hospital')?'success':'error'}`}>{message}</div>}{existing&&<div className="panel" style={{marginBottom:20}}><div className="request-row" style={{borderTop:0}}><div className="request-meta"><div className="metric-icon"><Hospital size={17}/></div><div><strong>{existing.hospital_name}</strong><small>Verification: <span className={`status ${existing.verification_status==='verified'?'status-green':existing.verification_status==='rejected'?'status-gray':'status-blue'}`}>{existing.verification_status}</span></small></div></div></div></div>}<form className="form-card" onSubmit={submit}><div className="form-grid"><div className="field full"><label>Hospital name</label><input className="input" value={form.hospital_name} onChange={e=>update('hospital_name',e.target.value)} required/></div><div className="field"><label>Registration number <span className="muted" style={{fontWeight:400}}>(optional)</span></label><input className="input" value={form.registration_number} onChange={e=>update('registration_number',e.target.value)} placeholder="Official registration ID"/></div><div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="+91 98765 43210"/></div><div className="field full"><label>Address</label><input className="input" value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Street address"/></div><div className="field"><label>City</label><input className="input" value={form.city} onChange={e=>update('city',e.target.value)} placeholder="Bengaluru"/></div><div className="field"><label>State</label><input className="input" value={form.state} onChange={e=>update('state',e.target.value)} placeholder="Karnataka"/></div><div className="field"><label>PIN code</label><input className="input" value={form.pin_code} onChange={e=>update('pin_code',e.target.value)} placeholder="560001"/></div></div><div className="form-actions"><a className="btn btn-outline" href="#/dashboard">Cancel</a><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':existing?'Update details':'Submit for verification'} <ArrowRight size={15}/></button></div></form></div></main>;
}

function HospitalDashboard({user,profile}:{user:User;profile:Profile|null}):ReactNode {
  const [hospital,setHospital]=useState<Hospital|null>(null);
  const [requests,setRequests]=useState<(BloodRequest&{donor_matches?:any[]})[]>([]);
  const [loading,setLoading]=useState(true);
  const [unreadCount,setUnreadCount]=useState(0);

  useEffect(()=>{void (async()=>{
    const{data:hData}=await supabase.from('hospitals').select('*').eq('user_id',user.id).maybeSingle();
    if(hData)setHospital(hData as Hospital);
    const{data:rData}=await supabase.from('blood_requests').select('id,blood_group,units_required,urgency,status,location,created_at,hospital_id,patient_reference,notes,requester_id,donor_matches(id,donor_id,status,match_score)').eq('requester_id',user.id).order('created_at',{ascending:false});
    if(rData)setRequests(rData as any[]);
    const n=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('read',false);
    setUnreadCount(n.count||0);
    setLoading(false);
  })();},[user.id]);

  const verified=hospital?.verification_status==='verified';
  const activeCount=requests.filter(r=>!['fulfilled','cancelled','expired'].includes(r.status)).length;
  const matchedCount=requests.reduce((sum,r)=>sum+((r as any).donor_matches||[]).length,0);

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Hospital dashboard</div><h1 style={{fontSize:38,marginTop:10}}>{hospital?.hospital_name||profile?.full_name?.split(' ')[0]||'Hospital'}</h1><p>{hospital?`Verification status: ${hospital.verification_status}`:'Complete your hospital registration to get started.'}</p></div>{!hospital&&<div className="alert error" style={{marginBottom:18}}><strong>You have not registered your hospital yet.</strong> <a href="#/hospital/register" style={{textDecoration:'underline'}}>Register now</a> to submit for verification.</div>}{hospital&&!verified&&<div className="alert" style={{marginBottom:18,background:'var(--blue-bg,var(--faint))'}}><strong>Your hospital is {hospital.verification_status==='rejected'?'rejected':'pending verification'}.</strong> {hospital.verification_status==='rejected'?'Please update your details and resubmit.':'Once verified, you can create and manage blood requests.'}</div>}<div className="dashboard-grid"><Metric icon={<Hospital/>} value={hospital?hospital.verification_status:'—'} label="Verification"/><Metric icon={<Droplets/>} value={loading?'…':String(activeCount)} label="Active requests"/><Metric icon={<Activity/>} value={loading?'…':String(matchedCount)} label="Donor responses"/><Metric icon={<Bell/>} value={String(unreadCount)} label="Unread notifications"/></div><div className="panel-grid"><div className="panel"><div className="panel-header"><h3>Recent blood requests</h3><a href="#/my-requests" style={{fontSize:12,color:'var(--red)',fontWeight:800}}>View all</a></div>{loading?<Empty text="Loading…"/>:requests.length?requests.slice(0,5).map(r=><RequestRow key={r.id} request={r}/>):<Empty text={verified?"No requests yet. Create one to get started.":"Verification required before creating requests."}/>}</div><div className="panel"><div className="panel-header"><h3>Quick actions</h3></div><div style={{display:'grid',gap:9}}>{verified?<a className="btn btn-primary" href={`#/requests/create?h=${hospital?.id||''}`}>Create blood request <ArrowRight size={15}/></a>:<a className="btn btn-primary" href="#/hospital/register">Register hospital <ArrowRight size={15}/></a>}<a className="btn btn-outline" href="#/find-donors"><Search size={15}/> Find donors</a><a className="btn btn-outline" href="#/hospital/register"><Hospital size={15}/> Hospital details</a><a className="btn btn-outline" href="#/profile"><UserRound size={15}/> Update profile</a></div></div></div><div className="disclaimer" style={{marginTop:20}}><strong>Remember:</strong> LifeLink helps coordinate connections. Your hospital team always makes the final eligibility and treatment decisions.</div></div></main>;
}

function AdminHospitals({user}:{user:User}):ReactNode {
  const [hospitals,setHospitals]=useState<Hospital[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [msg,setMsg]=useState('');

  const load=async()=>{
    setLoading(true);
    const{data}=await supabase.from('hospitals').select('*').order('created_at',{ascending:false});
    if(data)setHospitals(data as Hospital[]);
    setLoading(false);
  };
  useEffect(()=>{void load();},[]);

  const setVerification=async(h:Hospital,status:'verified'|'rejected')=>{
    setBusy(h.id);setMsg('');
    const{error}=await supabase.from('hospitals').update({verification_status:status,verified_at:status==='verified'?new Date().toISOString():null}).eq('id',h.id);
    if(error){setMsg(error.message);setBusy(null);return;}
    await supabase.from('notifications').insert({user_id:h.user_id,title:`Hospital verification ${status}`,message:`Your hospital "${h.hospital_name}" has been ${status==='verified'?'verified and can now create blood requests':'rejected'}.`,type:'verification'});
    setMsg(`${h.hospital_name} ${status}.`);
    setBusy(null);
    void load();
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Administration</div><h1 style={{fontSize:40,marginTop:10}}>Hospital verification</h1><p>Review and verify hospital registrations.</p></div>{msg&&<div className="alert success">{msg}</div>}{loading?<Empty text="Loading…"/>:hospitals.length?<div className="panel">{hospitals.map(h=><div key={h.id} className="request-row" style={{flexDirection:'column',alignItems:'stretch',gap:10}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div className="request-meta"><div className="metric-icon"><Hospital size={17}/></div><div><strong>{h.hospital_name}</strong><small>{[h.city,h.state].filter(Boolean).join(', ')||'Location not set'} · Reg: {h.registration_number||'N/A'}</small></div></div><span className={`status ${h.verification_status==='verified'?'status-green':h.verification_status==='rejected'?'status-gray':'status-blue'}`}>{h.verification_status}</span></div>{h.address&&<small style={{color:'var(--muted)'}}>Address: {h.address} · PIN: {h.pin_code||'N/A'} · Phone: {h.phone||'N/A'}</small>}{h.verification_status==='pending'&&<div style={{display:'flex',gap:8}}><button className="btn btn-primary" style={{flex:1,fontSize:13,padding:'10px'}} disabled={busy===h.id} onClick={()=>void setVerification(h,'verified')}><Check size={14}/> Verify</button><button className="btn btn-outline" style={{flex:1,fontSize:13,padding:'10px'}} disabled={busy===h.id} onClick={()=>void setVerification(h,'rejected')}><X size={14}/> Reject</button></div>}</div>)}</div>:<div className="panel"><Empty text="No hospitals registered yet."/></div>}</div></main>;
}

function DonorRequests({user}:{user:User}):ReactNode {
  const [matches,setMatches]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [msg,setMsg]=useState('');

  const load=async()=>{
    setLoading(true);
    const{data,error}=await supabase.from('donor_matches').select('id,request_id,donor_id,status,match_score,created_at,blood_requests!inner(id,blood_group,units_required,urgency,status,location,created_at,patient_reference,notes,requester_id)').eq('donor_id',user.id).order('created_at',{ascending:false});
    if(data)setMatches(data as any[]);
    if(error)setMsg(error.message);
    setLoading(false);
  };

  useEffect(()=>{void load();},[user.id]);

  const respond=async(matchId:string,reqId:string,newStatus:'accepted'|'declined')=>{
    setBusy(matchId);setMsg('');
    const{error}=await supabase.from('donor_matches').update({status:newStatus}).eq('id',matchId);
    if(error){setMsg(error.message);setBusy(null);return;}
    const{data:reqData}=await supabase.from('blood_requests').select('requester_id,blood_group,units_required,location').eq('id',reqId).maybeSingle();
    const reqInfo=reqData as BloodRequest|null;
    if(reqInfo){
      await supabase.from('notifications').insert({user_id:reqInfo.requester_id,title:`Donor ${newStatus==='accepted'?'accepted':'declined'} your request`,message:`A donor has ${newStatus==='accepted'?'accepted':'declined'} your ${reqInfo.blood_group} blood request for ${reqInfo.units_required} unit(s) at ${reqInfo.location||'your location'}.`,type:'donor_response'});
    }
    if(newStatus==='accepted'){
      await supabase.from('blood_requests').update({status:'donor_accepted'}).eq('id',reqId);
    }
    setMsg(`Request ${newStatus}.`);
    setBusy(null);
    void load();
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Donor dashboard</div><h1 style={{fontSize:40,marginTop:10}}>Incoming donation requests</h1><p>Review requests sent to you and accept or decline them.</p></div>{msg&&<div className="alert success">{msg}</div>}{loading?<Empty text="Loading…"/>:matches.length?<div className="panel">{matches.map((m:any)=>{
    const req=m.blood_requests as BloodRequest;
    return <div key={m.id} className="request-row" style={{flexDirection:'column',alignItems:'stretch',gap:10}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div className="request-meta"><div className="blood-badge">{req.blood_group}</div><div><strong>{req.units_required} unit{req.units_required!==1?'s':''} needed</strong><small>{req.location||'Location shared'} · {req.urgency}</small></div></div>
        <span className={`status ${m.status==='accepted'?'status-green':m.status==='declined'?'status-gray':'status-blue'}`}>{m.status}</span>
      </div>
      {req.patient_reference&&<small style={{color:'var(--muted)'}}>Patient reference: {req.patient_reference}</small>}
      {req.notes&&<small style={{color:'var(--muted)'}}>Notes: {req.notes}</small>}
      {m.status==='pending'&&<div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" style={{flex:1,fontSize:13,padding:'10px'}} disabled={busy===m.id} onClick={()=>void respond(m.id,req.id,'accepted')}><Check size={14}/> Accept</button>
        <button className="btn btn-outline" style={{flex:1,fontSize:13,padding:'10px'}} disabled={busy===m.id} onClick={()=>void respond(m.id,req.id,'declined')}><X size={14}/> Decline</button>
      </div>}
    </div>;
  })}</div>:<div className="panel"><Empty text="No incoming requests yet. When someone sends you a donation request, it will appear here."/></div>}</div></main>;
}

function MyRequests({user}:{user:User}):ReactNode {
  const [requests,setRequests]=useState<(BloodRequest&{donor_matches?:any[]})[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [msg,setMsg]=useState('');

  useEffect(()=>{void (async()=>{
    const{data,error}=await supabase.from('blood_requests').select('id,blood_group,units_required,urgency,status,location,created_at,hospital_id,patient_reference,notes,requester_id,donor_matches(id,donor_id,status,match_score)').eq('requester_id',user.id).order('created_at',{ascending:false});
    if(data)setRequests(data as any[]);
    if(error)console.error(error);
    setLoading(false);
  })();},[user.id]);

  const fulfill=async(reqId:string)=>{
    setBusy(reqId);setMsg('');
    const{error}=await supabase.from('blood_requests').update({status:'fulfilled'}).eq('id',reqId);
    if(error){setMsg(error.message);setBusy(null);return;}
    await supabase.from('notifications').insert({user_id:user.id,title:'Request fulfilled',message:'Your blood request has been marked as fulfilled.',type:'status_update'});
    setMsg('Request marked as fulfilled.');
    setBusy(null);
    const{data}=await supabase.from('blood_requests').select('id,blood_group,units_required,urgency,status,location,created_at,hospital_id,patient_reference,notes,requester_id,donor_matches(id,donor_id,status,match_score)').eq('requester_id',user.id).order('created_at',{ascending:false});
    if(data)setRequests(data as any[]);
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Your requests</div><h1 style={{fontSize:40,marginTop:10}}>Blood requests you have created</h1><p>Track the status of your requests and donor responses.</p></div>{msg&&<div className="alert success">{msg}</div>}{loading?<Empty text="Loading…"/>:requests.length?<div className="panel">{requests.map(r=><div key={r.id} className="request-row" style={{flexDirection:'column',alignItems:'stretch',gap:10}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div className="request-meta"><div className="blood-badge">{r.blood_group}</div><div><strong>{r.units_required} unit{r.units_required!==1?'s':''} needed</strong><small>{r.location||'Location shared'} · {r.urgency} · {new Date(r.created_at).toLocaleDateString()}</small></div></div>
      <span className={`status ${r.urgency==='emergency'?'status-red':r.status==='fulfilled'?'status-green':'status-blue'}`}>{r.status.replace(/_/g,' ')}</span>
    </div>
    {r.patient_reference&&<small style={{color:'var(--muted)'}}>Patient reference: {r.patient_reference}</small>}
    {(r as any).donor_matches&&((r as any).donor_matches as any[]).length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <small style={{fontWeight:700,color:'var(--navy)'}}>Donor responses:</small>
      {((r as any).donor_matches as any[]).map((dm:any,i:number)=><span key={dm.id} className={`tag ${dm.status==='accepted'?'status-green':dm.status==='declined'?'status-gray':'status-blue'}`}>{dm.status==='accepted'?'Accepted':dm.status==='declined'?'Declined':'Pending'}</span>)}
    </div>}
    {r.status==='donor_accepted'&&<button className="btn btn-primary" style={{fontSize:12,padding:'8px 12px',width:'fit-content'}} disabled={busy===r.id} onClick={()=>void fulfill(r.id)}><Check size={13}/> Mark as fulfilled</button>}{r.status!=='fulfilled'&&r.status!=='cancelled'&&<a className="btn btn-outline" style={{fontSize:12,padding:'8px 12px',width:'fit-content'}} href="#/find-donors">Find more donors <ArrowRight size={13}/></a>}
  </div>)}</div>:<div className="panel"><Empty text="You have not created any blood requests yet."/><a className="btn btn-primary" href="#/requests/create" style={{marginTop:12}}>Create a blood request <ArrowRight size={15}/></a></div>}</div></main>;
}

function Profile({user,profile,onUpdated}:{user:User;profile:Profile|null;onUpdated:()=>void}):ReactNode {
  const [form,setForm]=useState({full_name:profile?.full_name||'',phone:profile?.phone||'',city:profile?.city||'',state:profile?.state||''});
  const [donorProfile,setDonorProfile]=useState<{blood_group:string;available:boolean;emergency_available:boolean;organ_donation_interest:boolean;last_donation_date?:string|null}|null>(null);
  const [organInterest,setOrganInterest]=useState<OrganInterest|null>(null);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const isDonor=profile?.role==='donor';

  useEffect(()=>{void (async()=>{
    if(isDonor){
      const{data}=await supabase.from('donor_profiles').select('blood_group,available,emergency_available,organ_donation_interest,last_donation_date').eq('user_id',user.id).maybeSingle();
      if(data)setDonorProfile(data as any);
    }
    const{data:od}=await supabase.from('organ_donation_interest').select('user_id,interest_status,organ_preferences,consent,notes').eq('user_id',user.id).maybeSingle();
    if(od)setOrganInterest(od as OrganInterest);
  })();},[user.id,isDonor]);

  const save=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setMsg('');
    const{error}=await supabase.from('profiles').update({full_name:form.full_name,phone:form.phone||null,city:form.city||null,state:form.state||null}).eq('user_id',user.id);
    if(error){setMsg(error.message);}
    else{setMsg('Profile updated.');onUpdated();}
    setBusy(false);
  };

  const toggleAvailability=async()=>{
    if(!donorProfile)return;
    setBusy(true);
    const newVal=!donorProfile.available;
    const{error}=await supabase.from('donor_profiles').update({available:newVal}).eq('user_id',user.id);
    if(error){setMsg(error.message);}
    else{setDonorProfile({...donorProfile,available:newVal});setMsg(newVal?'You are now available to donate.':'You are now marked unavailable.');}
    setBusy(false);
  };
  const toggleEmergency=async()=>{
    if(!donorProfile)return;
    setBusy(true);
    const newVal=!donorProfile.emergency_available;
    const{error}=await supabase.from('donor_profiles').update({emergency_available:newVal}).eq('user_id',user.id);
    if(error){setMsg(error.message);}
    else{setDonorProfile({...donorProfile,emergency_available:newVal});setMsg(newVal?'You are now available for emergencies.':'Emergency availability turned off.');}
    setBusy(false);
  };
  const saveLastDonation=async(date:string)=>{
    if(!donorProfile)return;
    setBusy(true);
    const{error}=await supabase.from('donor_profiles').update({last_donation_date:date||null}).eq('user_id',user.id);
    if(error){setMsg(error.message);}
    else{setDonorProfile({...donorProfile,last_donation_date:date||null});setMsg('Last donation date updated.');}
    setBusy(false);
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Your profile</div><h1 style={{fontSize:40,marginTop:10}}>Update your information</h1><p>Keep your details current so the right connections can reach you.</p></div>{msg&&<div className="alert success">{msg}</div>}<form className="form-card" onSubmit={save} style={{maxWidth:560}}><div className="form-grid"><div className="field full"><label>Full name</label><input className="input" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/></div><div className="field"><label>Phone number</label><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 98765 43210"/></div><div className="field"><label>Email</label><input className="input" value={profile?.email||''} disabled style={{opacity:.6}}/></div><div className="field"><label>City</label><input className="input" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Bengaluru"/></div><div className="field"><label>State</label><input className="input" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} placeholder="Karnataka"/></div></div><div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save changes'} <ArrowRight size={15}/></button></div></form>{isDonor&&donorProfile&&<div className="panel" style={{marginTop:20,maxWidth:560}}><div className="panel-header"><h3>Donor settings</h3></div><div className="request-row" style={{borderTop:0}}><div className="request-meta"><div className="blood-badge">{donorProfile.blood_group}</div><div><strong>Blood group</strong><small>Available: {donorProfile.available?'Yes':'No'}</small></div></div><button className="btn btn-outline" style={{fontSize:12,padding:'8px 12px'}} disabled={busy} onClick={()=>void toggleAvailability()}>{donorProfile.available?'Mark unavailable':'Mark available'}</button></div><div className="request-row"><div className="request-meta"><div className="metric-icon"><Siren size={17}/></div><div><strong>Emergency availability</strong><small>{donorProfile.emergency_available?'Available for emergencies':'Not available for emergencies'}</small></div></div><button className="btn btn-outline" style={{fontSize:12,padding:'8px 12px'}} disabled={busy} onClick={()=>void toggleEmergency()}>{donorProfile.emergency_available?'Turn off':'Turn on'}</button></div><div className="request-row"><div className="request-meta"><div className="metric-icon"><Clock3 size={17}/></div><div><strong>Last donation date</strong><small>{donorProfile.last_donation_date?new Date(donorProfile.last_donation_date).toLocaleDateString():'Not recorded'}</small></div></div><input type="date" className="input" style={{width:'auto',fontSize:13,padding:'8px'}} value={donorProfile.last_donation_date||''} disabled={busy} onChange={e=>void saveLastDonation(e.target.value)}/></div>{donorProfile.organ_donation_interest&&<div className="request-row"><div className="request-meta"><div className="metric-icon"><Heart size={17}/></div><div><strong>Organ donation interest</strong><small>You have expressed interest in organ donation</small></div></div><a className="btn btn-outline" style={{fontSize:12,padding:'8px 12px'}} href="#/organ-donation">Manage</a></div>}</div>}{organInterest&&<div className="panel" style={{marginTop:20,maxWidth:560}}><div className="panel-header"><h3>Organ donation preference</h3></div><div className="request-row" style={{borderTop:0}}><div className="request-meta"><div className="metric-icon"><Heart size={17}/></div><div><strong>Interest: {organInterest.interest_status}</strong><small>Consent: {organInterest.consent?'Yes':'No'} · Organs: {organInterest.organ_preferences.join(', ')||'none specified'}</small></div></div><a className="btn btn-outline" style={{fontSize:12,padding:'8px 12px'}} href="#/organ-donation">Update</a></div></div>}</div></main>;
}

function OrganDonation({user}:{user:User|null}):ReactNode {
  const [saved,setSaved]=useState(false);
  const [existing,setExisting]=useState<OrganInterest|null>(null);
  const [status,setStatus]=useState<'interested'|'not_sure'|'not_interested'>('interested');
  const [organs,setOrgans]=useState<string[]>(['kidney','liver','cornea']);
  const [consent,setConsent]=useState(false);
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  useEffect(()=>{void (async()=>{
    if(user){
      const{data}=await supabase.from('organ_donation_interest').select('user_id,interest_status,organ_preferences,consent,notes').eq('user_id',user.id).maybeSingle();
      if(data){setExisting(data as OrganInterest);setStatus((data as any).interest_status);setOrgans((data as any).organ_preferences||[]);setConsent((data as any).consent);setNotes((data as any).notes||'');setSaved(true);}
    }
  })();},[user]);

  const organOptions=['kidney','liver','heart','lungs','cornea','pancreas','tissue'];
  const toggleOrgan=(o:string)=>setOrgans(prev=>prev.includes(o)?prev.filter(x=>x!==o):[...prev,o]);

  const register=async()=>{
    if(!user){window.location.hash='/login';return;}
    setBusy(true);setMsg('');
    const{error}=await supabase.from('organ_donation_interest').upsert({user_id:user.id,interest_status:status,organ_preferences:organs,consent,notes:notes||null},{onConflict:'user_id'});
    if(error){setMsg(error.message);}
    else{setSaved(true);setExisting({user_id:user.id,interest_status:status,organ_preferences:organs,consent,notes});setMsg('Your organ donation interest has been saved.');}
    setBusy(false);
  };

  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Awareness & interest</div><h1 style={{fontSize:40,marginTop:10}}>Organ donation starts with a conversation</h1><p>Learn the basics, question the myths, and decide what feels right for you.</p></div><div className="info-grid"><InfoCard icon={<Heart/>} cls="red-bg" title="Why it matters" text="One donor can help multiple people through organ and tissue donation. It is a deeply personal choice, and learning is the first step." link="#/organ-donation"/><InfoCard icon={<Users/>} cls="green-bg" title="Common myths" text="Donation does not affect the quality of care someone receives. Medical teams focus first on saving the patient's life." link="#/faq"/><InfoCard icon={<Stethoscope/>} cls="blue-bg" title="The process" text="Authorized healthcare and government organizations manage legal registration, consent, and clinical decisions." link="#/how-it-works"/></div><div className="panel" style={{marginTop:20}}>{msg&&<div className={`alert ${msg.includes('saved')?'success':'error'}`}>{msg}</div>}{saved&&existing&&<div className="request-row" style={{borderTop:0}}><div className="request-meta"><div className="metric-icon"><Heart size={17}/></div><div><strong>Current preference: {existing.interest_status.replace(/_/g,' ')}</strong><small>Consent: {existing.consent?'Yes':'No'} · Organs: {existing.organ_preferences.join(', ')||'none'}</small></div></div><span className="status status-green">Saved</span></div>}<h3 style={{marginBottom:16}}>{saved?'Update your interest':'Record your interest with LifeLink'}</h3><div className="form-grid"><div className="field full"><label>Your interest level</label><div className="radio-grid">{[['interested','Interested'],['not_sure','Not sure yet'],['not_interested','Not interested']].map(([v,l])=><div key={v} className={`radio-card ${status===v?'active':''}`} onClick={()=>setStatus(v as typeof status)}>{l}</div>)}</div></div><div className="field full"><label>Organ preferences</label><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{organOptions.map(o=><button type="button" key={o} className={`tag ${organs.includes(o)?'status-green':''}`} style={{cursor:'pointer',border:organs.includes(o)?'1px solid var(--green)':'1px solid var(--line)'}} onClick={()=>toggleOrgan(o)}>{organs.includes(o)&&<Check size={12} style={{display:'inline',marginRight:3}}/>}{o}</button>)}</div></div><div className="field full"><label><button type="button" style={{background:'none',border:'none',cursor:'pointer',fontWeight:800,color:consent?'var(--green)':'var(--navy)',display:'inline-flex',alignItems:'center',gap:6}} onClick={()=>setConsent(!consent)}><span style={{width:18,height:18,borderRadius:4,border:`2px solid ${consent?'var(--green)':'var(--line)'}`,display:'inline-grid',placeItems:'center',background:consent?'var(--green)':'white'}}>{consent&&<Check size={12} color="white"/>}</span> I consent to being contacted about organ donation opportunities</button></label></div><div className="field full"><label>Notes <span className="muted" style={{fontWeight:400}}>(optional)</span></label><textarea className="textarea" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional information about your interest"/></div></div><div className="disclaimer" style={{marginTop:14}}>This registration records your interest in organ donation. Legal donor registration must be completed through the appropriate authorized government registry, hospital, or official organization.</div><div className="form-actions" style={{marginTop:16}}><button className="btn btn-primary" disabled={busy} onClick={()=>void register()}>{busy?'Saving…':saved?'Update interest':'Register interest'} <ArrowRight size={15}/></button></div></div></div></main>;
}

function HospitalsPage({user,profile}:{user:User|null;profile:Profile|null}):ReactNode {
  const [hospital,setHospital]=useState<Hospital|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{void (async()=>{
    if(user&&profile?.role==='hospital'){const{data}=await supabase.from('hospitals').select('*').eq('user_id',user.id).maybeSingle();if(data)setHospital(data as Hospital);}
    setLoading(false);
  })();},[user,profile?.role]);
  const verified=hospital?.verification_status==='verified';
  const cards=[{icon:<Hospital/>,cls:'blue-bg',title:'Submit hospital verification',text:'Register your hospital details and submit for verification by our team.'},{icon:<Droplets/>,cls:'red-bg',title:'Create and manage requests',text:'Once verified, create blood requests and track donor responses in one place.'},{icon:<ShieldCheck/>,cls:'green-bg',title:'Confirm donations with your team',text:'Coordinate with donors and your care team to guide the next safe step.'}];
  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">For care teams</div><h1 style={{fontSize:42,marginTop:10,maxWidth:720}}>A trusted bridge to willing donors.</h1><p style={{maxWidth:620}}>Verified hospitals can coordinate blood requests, review suitable donors, and keep updates in one shared workflow.</p></div>{!user?<div className="alert" style={{background:'var(--faint)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:24}}><div><strong>Join LifeLink as a hospital.</strong> Sign in or register to coordinate blood requests with willing donors.</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a className="btn btn-outline" href="#/login">Sign in</a><a className="btn btn-primary" href="#/register">Register as hospital <ArrowRight size={15}/></a></div></div>:profile?.role==='hospital'?(loading?<div style={{marginBottom:24}}><Empty text="Loading…"/></div>:hospital?<div className="panel" style={{marginBottom:24}}><div className="request-row" style={{borderTop:0}}><div className="request-meta"><div className="metric-icon"><Hospital size={17}/></div><div><strong>{hospital.hospital_name}</strong><small>Verification: <span className={`status ${hospital.verification_status==='verified'?'status-green':hospital.verification_status==='rejected'?'status-gray':'status-blue'}`}>{hospital.verification_status}</span></small></div></div></div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><a className="btn btn-primary" href="#/hospital/dashboard">Go to dashboard <ArrowRight size={15}/></a>{verified&&<a className="btn btn-outline" href={`#/requests/create?h=${hospital.id}`}>Create blood request <Droplets size={15}/></a>}<a className="btn btn-outline" href="#/hospital/register">Update details <UserRound size={15}/></a></div></div>:<div className="alert" style={{background:'var(--faint)',marginBottom:24}}><strong>You have not registered your hospital yet.</strong> Submit your details for verification to get started.<div style={{marginTop:10}}><a className="btn btn-primary" href="#/hospital/register">Register your hospital <ArrowRight size={15}/></a></div></div>):profile?.role==='admin'?<div className="alert" style={{background:'var(--faint)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:24}}><div><strong>Admin tools.</strong> Review and verify hospital registrations.</div><a className="btn btn-primary" href="#/admin/hospitals">Review hospitals <ShieldCheck size={15}/></a></div>:null}<div className="info-grid">{cards.map(c=><div className="info-card" key={c.title}><div className={`info-icon ${c.cls}`}>{c.icon}</div><h3>{c.title}</h3><p className="muted" style={{fontSize:14}}>{c.text}</p></div>)}</div><div style={{marginTop:30}} className="disclaimer"><strong>Medical disclaimer:</strong> LifeLink is a coordination and awareness platform and does not provide medical diagnosis, treatment, or eligibility decisions.</div></div></main>;
}
function StaticPage({kind}:{kind:string}):ReactNode { const content:{[key:string]:{eyebrow:string;title:string;intro:string;cards:string[]}}={about:{eyebrow:'Our purpose',title:'Technology that makes showing up easier.',intro:'LifeLink brings donors, families, and hospitals into one calmer place when time and trust matter.',cards:['Built around consent and privacy','Designed for real human coordination','Always guided by qualified professionals']},'how-it-works':{eyebrow:'A clearer path',title:'From need to connection.',intro:'LifeLink keeps the journey understandable for everyone involved, from the first request to hospital confirmation.',cards:['Create a request with the essentials','Receive ranked, compatible connections','Let your care team confirm the next step']},'blood-donation':{eyebrow:'Blood donation',title:'A little time can mean a lot.',intro:'Blood cannot be manufactured. Healthy donors make it possible for hospitals to care for people during surgery, illness, and emergencies.',cards:['Check eligibility with a qualified professional','Hydrate and bring a valid ID','Rest, eat well, and follow after-care advice']},faq:{eyebrow:'Questions, answered',title:'Common questions about LifeLink.',intro:'LifeLink is built to support conversations — not replace the advice of your doctor or hospital.',cards:['Is LifeLink a blood bank? No. It coordinates people and hospitals.','Are donor contact details public? No. Private information is protected.','Does a match score guarantee medical compatibility? No. Professionals always confirm.']},hospitals:{eyebrow:'For care teams',title:'A trusted bridge to willing donors.',intro:'Verified hospitals can coordinate blood requests, review suitable donors, and keep updates in one shared workflow.',cards:['Submit hospital verification','Create and manage requests','Confirm donations with your team']},privacy: {eyebrow: 'Legal', title: 'Privacy Policy', intro: 'Your data is handled securely and only shared with your explicit consent.', cards: ['Data is encrypted', 'No unauthorized sharing', 'You control your data']},terms: {eyebrow: 'Legal', title: 'Terms of Service', intro: 'By using LifeLink, you agree to coordinate care responsibly.', cards: ['Respectful communication', 'Medical disclaimer applies', 'Community guidelines']},disclaimer: {eyebrow: 'Legal', title: 'Medical Disclaimer', intro: 'LifeLink is a coordination platform, not a medical provider.', cards: ['Consult professionals', 'No medical advice provided', 'Confirm eligibility with doctors']},contact: {eyebrow: 'Get in touch', title: 'Contact Us', intro: 'We are here to help you coordinate care.', cards: ['Email support@lifelink.demo', 'Call our helpline', 'Community forum']}}; const c=content[kind]||content.about;return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">{c.eyebrow}</div><h1 style={{fontSize:42,marginTop:10,maxWidth:720}}>{c.title}</h1><p style={{maxWidth:620}}>{c.intro}</p></div><div className="info-grid">{c.cards.map((x,i)=><div className="info-card" key={x}><div className={`info-icon ${['red-bg','blue-bg','green-bg'][i%3]}`}><Check/></div><h3>{x}</h3><p className="muted">Learn more about how LifeLink supports this part of the journey, with privacy, accessibility, and clear next steps at the center.</p></div>)}</div><div style={{marginTop:30}} className="disclaimer"><strong>Medical disclaimer:</strong> LifeLink is a coordination and awareness platform and does not provide medical diagnosis, treatment, or eligibility decisions.</div></div></main>}

function Notifications({user}:{user:User|null}):ReactNode {
  const [items,setItems]=useState<{id:string;title:string;message:string;read:boolean;created_at:string}[]>([]);
  useEffect(()=>{
    if(user)void (async()=>{
      const{data}=await supabase.from('notifications').select('id,title,message,read,created_at').eq('user_id',user.id).order('created_at',{ascending:false});
      if(data)setItems(data);
      const unreadIds=(data||[]).filter(n=>!n.read).map(n=>n.id);
      if(unreadIds.length){await supabase.from('notifications').update({read:true}).in('id',unreadIds);}
    })();
  },[user]);
  return <main className="page"><div className="container"><div className="page-header"><div className="eyebrow">Stay in the loop</div><h1 style={{fontSize:40,marginTop:10}}>Notifications</h1><p>Updates from your requests, profile, and community.</p></div><div className="panel">{items.length?items.map(n=><div className="request-row" key={n.id}><div className="request-meta"><div className="metric-icon"><Bell size={17}/></div><div><strong>{n.title}</strong><small>{n.message}</small></div></div>{!n.read&&<span className="status status-red">New</span>}</div>):<Empty text="You are all caught up."/>}</div></div></main>;
}

async function fetchProfile(userId: string): Promise<Profile|null> {
  try {
    const {data,error} = await supabase.from('profiles').select('user_id,role,full_name,email,phone,city,state').eq('user_id',userId).maybeSingle();
    if(error) return null;
    return (data as Profile|null) || null;
  } catch { return null; }
}

function min(a:number,b:string):string{return a<Number(b)?String(a):b;}

function App(): ReactNode {
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [ready,setReady]=useState(false);
  const [route,setRoute]=useState((window.location.hash.replace('#','')||'/').split('?')[0]);

  useEffect(()=>{
    const onHash=()=>setRoute((window.location.hash.replace('#','')||'/').split('?')[0]);
    window.addEventListener('hashchange',onHash);
    void (async()=>{
      try{
        const {data}=await supabase.auth.getSession();
        setUser(data.session?.user||null);
        if(data.session?.user){setProfile(await fetchProfile(data.session.user.id))}
      }finally{setReady(true)}
    })();
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
      setUser(session?.user||null);
      if(session?.user){void fetchProfile(session.user.id).then(p=>setProfile(p))}
      else{setProfile(null)}
    });
    return()=>{
      window.removeEventListener('hashchange',onHash);
      data.subscription.unsubscribe();
    };
  },[]);

  const logout=async()=>{await supabase.auth.signOut();setUser(null);setProfile(null);window.location.hash='/'};
  const onAuth=async(u:User)=>{
    setUser(u);
    let p=await fetchProfile(u.id);
    let retries=0;
    while(!p && retries<8) {
      await new Promise(r=>setTimeout(r,500));
      p=await fetchProfile(u.id);
      retries++;
    }
    if(!p) {
      alert("Profile creation is taking longer than expected. Please refresh the page in a moment.");
      return;
    }
    setProfile(p);
    window.location.hash=p.role==='hospital'?'#/hospital/dashboard':p.role==='admin'?'#/admin/hospitals':'#/dashboard';
  };
  const refreshProfile=async()=>{if(user){const p=await fetchProfile(user.id);setProfile(p);}};

  if(!ready)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center'}}><Droplets color="#c9363e"/></div>;

  let page:ReactNode;
  const protectedRoutes = ['/requests/create', '/requests', '/notifications', '/dashboard', '/donor/requests', '/my-requests', '/hospital/register', '/hospital/dashboard', '/admin/hospitals', '/profile'];
  
  if(route==='/')page=<Home/>;
  else if(route==='/login')page=<Auth mode="login" onAuth={onAuth}/>;
  else if(route==='/register')page=<Auth mode="register" onAuth={onAuth}/>;
  else if(route==='/find-donors')page=<FindDonors user={user} profile={profile}/>;
  else if(route==='/organ-donation')page=<OrganDonation user={user}/>;
  else if(route==='/hospitals')page=<HospitalsPage user={user} profile={profile}/>;
  else if(['about','how-it-works','blood-donation','faq','privacy','terms','disclaimer','contact'].some(x=>route===`/${x}`))page=<StaticPage kind={route.slice(1)}/>;
  else if(protectedRoutes.includes(route) && !user) {
    window.location.hash='/login';
    page=<Auth mode="login" onAuth={onAuth}/>;
  }
  else if(route==='/requests/create'&&user){const hid=new URLSearchParams((window.location.hash.replace('#','').split('?')[1])||'').get('h');page=<CreateRequest user={user} hospitalId={hid}/>}
  else if(route==='/notifications'&&user)page=<Notifications user={user}/>;
  else if(route==='/dashboard'&&user)page=<Dashboard profile={profile} user={user}/>;
  else if(route==='/donor/requests'&&user)page=<DonorRequests user={user}/>;
  else if(route==='/my-requests'&&user)page=<MyRequests user={user}/>;
  else if(route==='/hospital/register'&&user)page=<HospitalRegister user={user}/>;
  else if(route==='/hospital/dashboard'&&user)page=<HospitalDashboard user={user} profile={profile}/>;
  else if(route==='/admin/hospitals'&&user&&profile?.role==='admin')page=<AdminHospitals user={user}/>;
  else if(route==='/profile'&&user)page=<Profile user={user} profile={profile} onUpdated={refreshProfile}/>;
  else if(route==='/requests'&&user){const hid=new URLSearchParams((window.location.hash.replace('#','').split('?')[1])||'').get('h');page=<CreateRequest user={user} hospitalId={hid}/>}
  else page=<Home/>;

  return <Layout user={user} profile={profile} onLogout={logout}>{page}</Layout>;
}

export default App;
