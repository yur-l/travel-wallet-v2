import { supabase } from './supabase.js'


const currencies = [
  {code:'MYR',flag:'🇲🇾',name:'Malaysian Ringgit',dec:2},
  {code:'THB',flag:'🇹🇭',name:'Thai Baht',dec:2},
  {code:'SGD',flag:'🇸🇬',name:'Singapore Dollar',dec:2},
  {code:'TWD',flag:'🇹🇼',name:'New Taiwan Dollar',dec:0},
  {code:'JPY',flag:'🇯🇵',name:'Japanese Yen',dec:0},
  {code:'KRW',flag:'🇰🇷',name:'South Korean Won',dec:0},
  {code:'USD',flag:'🇺🇸',name:'US Dollar',dec:2},
  {code:'CNY',flag:'🇨🇳',name:'Chinese Yuan',dec:2},
  {code:'EUR',flag:'🇪🇺',name:'Euro',dec:2},
  {code:'GBP',flag:'🇬🇧',name:'British Pound',dec:2},
  {code:'AUD',flag:'🇦🇺',name:'Australian Dollar',dec:2},
  {code:'CAD',flag:'🇨🇦',name:'Canadian Dollar',dec:2},
  {code:'HKD',flag:'🇭🇰',name:'Hong Kong Dollar',dec:2},
  {code:'IDR',flag:'🇮🇩',name:'Indonesian Rupiah',dec:0},
  {code:'PHP',flag:'🇵🇭',name:'Philippine Peso',dec:2}
];

let appState={user:null,wallets:{}};
let wallets=appState.wallets;
let currentWalletKey=null;
let isRefreshing=false;
let realtimeChannel=null;
let realtimeRefreshTimer=null;

function activeScreenId(){
  return document.querySelector('.screen.active')?.id || '';
}

function scheduleRealtimeRefresh(){
  if(!currentUser()) return;
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(()=>loadRemoteData({silent:true}),120);
}

async function stopRealtime(){
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=null;
  if(realtimeChannel){
    const channel=realtimeChannel;
    realtimeChannel=null;
    try{ await supabase.removeChannel(channel); }
    catch(error){ console.warn('Realtime cleanup failed',error); }
  }
}

async function startRealtime(){
  const user=currentUser();
  if(!user) return;
  await stopRealtime();
  const channel=supabase.channel(`travel-wallet-${user.id}`);
  ['wallets','wallet_members','wallet_join_requests','transactions','profiles'].forEach(table=>{
    channel.on('postgres_changes',{event:'*',schema:'public',table},scheduleRealtimeRefresh);
  });
  channel.subscribe(status=>{
    if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') console.warn('Realtime status:',status);
  });
  realtimeChannel=channel;
}

function currentUser(){ return appState.user; }
function isOwner(w){ return !!(w && currentUser() && w.ownerId===currentUser().id); }
function isMember(w){
  if(!w || !currentUser()) return false;
  return (w.members||[]).some(m=>m.id===currentUser().id);
}
function canAccessWallet(w){ return isOwner(w) || isMember(w); }
function accessibleWalletEntries(){ return Object.entries(wallets).filter(([_,w])=>canAccessWallet(w)); }
function canManageRecord(r,w){ return !!(r && w && currentUser() && (r.userId===currentUser().id || isOwner(w))); }

function formatDate(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function formatTime(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

async function ensureProfile(userId, displayName=''){
  if(!userId) return;
  const { error }=await supabase.from('profiles').upsert({id:userId,display_name:displayName},{onConflict:'id'});
  if(error) console.warn('Profile sync failed',error);
}

async function loadRemoteData({silent=false}={}){
  if(isRefreshing || !currentUser()) return;
  isRefreshing=true;
  try{
    const { data: walletRows, error: walletError }=await supabase
      .from('wallets')
      .select('*')
      .order('created_at',{ascending:false});
    if(walletError) throw walletError;

    const ids=(walletRows||[]).map(w=>w.id);
    if(!ids.length){
      wallets={}; appState.wallets=wallets;
      renderWalletList();
      return;
    }

    const [{data:memberRows,error:memberError},{data:requestRows,error:requestError},{data:transactionRows,error:txError}]=await Promise.all([
      supabase.from('wallet_members').select('*').in('wallet_id',ids),
      supabase.from('wallet_join_requests').select('*').in('wallet_id',ids).eq('status','pending'),
      supabase.from('transactions').select('*').in('wallet_id',ids).order('created_at',{ascending:false}),
    ]);
    if(memberError) throw memberError;
    if(requestError) throw requestError;
    if(txError) throw txError;

    const userIds=[...new Set([
      ...(memberRows||[]).map(x=>x.user_id),
      ...(requestRows||[]).map(x=>x.user_id),
      ...(transactionRows||[]).map(x=>x.user_id),
    ])];
    let profiles=[];
    if(userIds.length){
      const {data,error}=await supabase.from('profiles').select('id,display_name').in('id',userIds);
      if(error) throw error;
      profiles=data||[];
    }
    const names=Object.fromEntries(profiles.map(p=>[p.id,p.display_name||'Guest']));

    const next={};
    for(const row of walletRows||[]){
      const members=(memberRows||[])
        .filter(m=>m.wallet_id===row.id)
        .sort((a,b)=>(a.role==='owner'?-1:1)-(b.role==='owner'?-1:1))
        .map(m=>({id:m.user_id,name:names[m.user_id]||'Guest',role:m.role}));
      const joinRequests=(requestRows||[])
        .filter(r=>r.wallet_id===row.id)
        .map(r=>({requestId:r.id,id:r.user_id,name:names[r.user_id]||'Guest'}));
      const txs=(transactionRows||[]).filter(t=>t.wallet_id===row.id);
      const records=txs.map(t=>({
        id:t.id,type:t.type,note:t.note||'',foreign:Number(t.foreign_amount),my:Number(t.home_amount),
        userId:t.user_id,name:names[t.user_id]||'Guest',date:formatDate(t.created_at),time:formatTime(t.created_at),createdAt:t.created_at
      }));
      const topups=records.filter(r=>r.type==='topup');
      const expenses=records.filter(r=>r.type==='expense');
      const homeSpent=topups.reduce((sum,r)=>sum+r.my,0);
      const foreignTotal=topups.reduce((sum,r)=>sum+r.foreign,0);
      const spent=expenses.reduce((sum,r)=>sum+r.foreign,0);
      next[row.id]={
        id:row.id,name:row.name,remark:row.remark||'',home:row.home_currency,foreign:row.travel_currency,
        inviteCode:row.invite_code,ownerId:row.owner_id,theme:row.theme,icon:row.icon,
        members,joinRequests,records,homeSpent,foreignTotal,remaining:foreignTotal-spent
      };
    }
    wallets=next; appState.wallets=wallets;
    const lostWallet=currentWalletKey && !wallets[currentWalletKey];
    if(lostWallet) currentWalletKey=null;
    renderWalletList();
    if(currentWalletKey) renderWallet();
    if(lostWallet && ['wallet','history','membersScreen','editWalletScreen','topup'].includes(activeScreenId())){
      go('wallets');
      toast(currentLang==='CN'?'你已无法访问这个钱包':'You no longer have access to this wallet');
    }
  }catch(error){
    console.error(error);
    if(!silent) toast(currentLang==='CN'?'无法同步钱包资料':'Could not sync wallet data');
  }finally{
    isRefreshing=false;
  }
}

async function initSession(){
  try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.user){
      renderWalletList();
      return;
    }
    const {data:profile,error}=await supabase.from('profiles').select('display_name').eq('id',session.user.id).maybeSingle();
    if(error) throw error;
    const name=profile?.display_name||session.user.user_metadata?.display_name||'';
    appState.user={id:session.user.id,name,guest:session.user.is_anonymous!==false};
    userName=name;
    document.getElementById('profileName').textContent=userName||'Guest';
    document.getElementById('settingsNameInput').value=userName||'';
    if(name) go('wallets');
    await loadRemoteData({silent:true});
    await startRealtime();
  }catch(error){
    console.error('Session init failed',error);
  }
}


let showAllWallets=false;

function walletEntries(){
  return accessibleWalletEntries();
}

function renderWalletList(){
  const list=document.getElementById('walletList');
  const count=document.getElementById('walletCount');
  const showBtn=document.getElementById('showAllWalletsBtn');
  if(!list) return;
  const entries=walletEntries();
  if(count) count.textContent=entries.length;
  if(entries.length===0){
    list.innerHTML=`<div class="empty-wallets"><strong>${i18n[currentLang].noWalletsYet}</strong><span>${i18n[currentLang].createFirstWallet}</span></div>`;
    if(showBtn) showBtn.style.display='none';
    return;
  }
  const visible=showAllWallets ? entries : entries.slice(0,3);
  list.innerHTML=visible.map(([key,w])=>{
    const homePerForeign=w.foreignTotal ? w.homeSpent/w.foreignTotal : 0;
    const homeValue=w.remaining*homePerForeign;
    const members=w.members||[];
    const sharedMeta=members.length>1 ? `<span>•</span><span>${members.length} ${i18n[currentLang].membersLower}</span>` : '';
    return `<div class="wallet-card" onclick="loadWallet('${key}')">
      ${isOwner(w)?`<button class="wallet-delete" onclick="event.stopPropagation();askDeleteWallet('${key}')">✕</button>`:''}
      <div class="wallet-symbol" style="background:${w.theme||'#0F7775'}">${w.icon||'🧳'}</div>
      <div>
        <div class="wallet-name">${escapeHtml(w.name)}</div>
        ${w.remark ? `<div class="wallet-remark">${escapeHtml(w.remark)}</div>` : ''}
        <div class="wallet-meta"><span>${w.foreign}</span><span>•</span><span>${isOwner(w)?(currentLang==='CN'?'我的钱包':'Owned'):(currentLang==='CN'?'已加入':'Joined')}</span>${sharedMeta}</div>
        <div class="money">${fmt(w.foreign,w.remaining)}</div>
        <div class="muted">≈ ${w.home} ${fmt(w.home,homeValue)}</div>
      </div>
      <div style="padding-right:4px">›</div>
    </div>`;
  }).join('');
  if(showBtn){
    if(entries.length>3){
      showBtn.style.display='block';
      showBtn.textContent=showAllWallets ? (currentLang==='CN'?'收起':'Collapse') : (currentLang==='CN'?'查看全部':'Show all');
    } else showBtn.style.display='none';
  }
}

function toggleShowAllWallets(){
  showAllWallets=!showAllWallets;
  renderWalletList();
}


let selectedCreateTheme='#7C5CFC';
let selectedCreateIcon='🧋';

function selectCreateTheme(btn){
  selectedCreateTheme=btn.dataset.color;
  document.querySelectorAll('#createThemePicker .theme-dot').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}
function selectCreateIcon(btn){
  selectedCreateIcon=btn.dataset.icon;
  document.querySelectorAll('#createIconPicker .icon-choice').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}


let currentLang='EN';
const i18n={
  EN:{
    settings:'Settings',darkMode:'Dark Mode',darkModeDesc:'Switch between light and dark appearance.',
    language:'Language',languageDesc:'Choose the app language.',
    changeName:'Change Name',changeNameDesc:'This name appears on expenses and shared wallet activity.',
    save:'Save',account:'Account',
    accountDesc:'You can use Travel Wallet without registering. Registering is recommended if you want to restore your wallets on another device or avoid losing access when browser data is cleared.',
    register:'Register Account',login:'Log In',topUp:'Top Up',confirmTopUp:'Confirm Top Up',
    walletSettings:'Wallet Settings',inviteCode:'🔀 Invite Code',members:'Members',owner:'Owner',member:'Member',
    deleteWallet:'🗑 Delete Wallet',expenseRecords:'Expense Records',
    myWallets:'My Wallets',walletsSubtitle:"Let's manage your travel wallets.",createWallet:'Create Wallet',
    joinWithCode:'Join with Code',yourWallets:'Your Wallets',backupSync:'☁ Backup & Sync',
    guestDesc:'Using as Guest. Register only if you want to restore your wallets on another device.',
    registerShort:'Register',walletName:'Wallet Name',yourCurrency:'Your Currency',travelCurrency:'Travel Currency',
    amountYourCurrency:'Amount (Your Currency)',foreignAmount:'Foreign Amount',actualExchangeRate:'Actual exchange rate',
    walletCreated:'Wallet Created!',shareCodeDesc:'Share this code with your travel buddies to join this wallet.',
    copyCode:'Copy Code',startUsingWallet:'Start Using Wallet',joinWallet:'Join Wallet',
    enterInviteCode:'Enter Invite Code',askInviteCode:'Ask the wallet owner for the 6-character code.',
    currentBalance:'Current Balance',spent:'SPENT',total:'TOTAL',actualExchangeRateCaps:'ACTUAL EXCHANGE RATE',
    sharedWith:'Shared with',membersLower:'members',recordExpense:'Record Expense',amount:'Amount',note:'Note',
    addExpense:'Add Expense',latestRecords:'Latest Records',viewAll:'View all',manageWallet:'Manage this wallet',
    expenses:'Expenses',topUps:'Top Ups',tapToCopy:'Tap to copy and share with your travel buddies.',inviteCode:'Invite Code'
    ,cancel:'Cancel',delete:'Delete',editExpense:'Edit Expense',editTopUp:'Edit Top Up',
    deleteExpense:'Delete expense?',deleteTopUp:'Delete top up?',deleteWalletQ:'Delete wallet?',
    cannotUndo:'This action cannot be undone.',recordUpdated:'Record updated',
    walletColor:'Wallet Color',walletIcon:'Wallet Icon',private:'Private',requestToJoin:'request to join',requestsToJoin:'requests to join',approve:'Approve',reject:'Reject',removeMember:'Remove member',remark:'Remark',editWallet:'Edit Wallet',
    loginPrompt:'Already have an account?',continue:'Continue',enterYourName:'Enter your name',heroSubtitle:'Keep track of your travel expenses together, anywhere in the world.',onboardingTitle:"What's your name?",onboardingSubtitle:'This name will be shown when you add expenses or top up.',noWalletsYet:'No wallets yet',createFirstWallet:'Create your first travel wallet to get started.'
  },
  CN:{
    settings:'设置',darkMode:'深色模式',darkModeDesc:'切换浅色与深色显示。',
    language:'语言',languageDesc:'选择 App 使用的语言。',
    changeName:'更换名字',changeNameDesc:'这个名字会显示在消费记录和共享钱包活动中。',
    save:'保存',account:'账号',
    accountDesc:'不注册也可以使用 Travel Wallet。建议注册账号，以便在其他设备恢复钱包，或避免清除浏览器资料后失去钱包访问权限。',
    register:'注册账号',login:'登入',topUp:'充值',confirmTopUp:'确认充值',
    walletSettings:'钱包设置',inviteCode:'🔀 邀请代码',members:'成员',owner:'创建者',member:'成员',
    deleteWallet:'🗑 删除钱包',expenseRecords:'消费记录',
    myWallets:'我的钱包',walletsSubtitle:'管理你的旅行钱包。',createWallet:'创建钱包',
    joinWithCode:'使用代码加入',yourWallets:'你的钱包',backupSync:'☁ 备份与同步',
    guestDesc:'目前以访客身份使用。只有在你想跨设备恢复钱包时才需要注册。',
    registerShort:'注册',walletName:'钱包名称',yourCurrency:'你的货币',travelCurrency:'旅行货币',
    amountYourCurrency:'金额（你的货币）',foreignAmount:'外币金额',actualExchangeRate:'实际兑换汇率',
    walletCreated:'钱包已创建！',shareCodeDesc:'把这个代码分享给旅伴，让他们加入这个钱包。',
    copyCode:'复制代码',startUsingWallet:'开始使用钱包',joinWallet:'加入钱包',
    enterInviteCode:'输入邀请码',askInviteCode:'向钱包创建者获取 6 位代码。',
    currentBalance:'当前余额',spent:'已消费',total:'总额',actualExchangeRateCaps:'实际兑换汇率',
    sharedWith:'与',membersLower:'位成员共享',recordExpense:'记录消费',amount:'金额',note:'备注',
    addExpense:'添加消费',latestRecords:'最新记录',viewAll:'查看全部',manageWallet:'管理这个钱包',
    expenses:'消费',topUps:'充值',tapToCopy:'点击即可复制并分享给旅伴。',inviteCode:'邀请码'
    ,cancel:'取消',delete:'删除',editExpense:'编辑消费',editTopUp:'编辑充值',
    deleteExpense:'删除这笔消费？',deleteTopUp:'删除这笔充值？',deleteWalletQ:'删除钱包？',
    cannotUndo:'此操作无法撤销。',recordUpdated:'记录已更新',
    walletColor:'钱包颜色',walletIcon:'钱包图标',private:'私人',requestToJoin:'个加入申请',requestsToJoin:'个加入申请',approve:'批准',reject:'拒绝',removeMember:'移除成员',remark:'备注',editWallet:'编辑钱包',
    loginPrompt:'已有账号？',continue:'继续',enterYourName:'输入你的名字',heroSubtitle:'随时随地与旅伴一起记录旅行开销。',onboardingTitle:'你叫什么名字？',onboardingSubtitle:'这个名字会显示在你添加消费或充值时。',noWalletsYet:'还没有钱包',createFirstWallet:'创建你的第一个旅行钱包，马上开始。'
  }
};

let userName='';

function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target=document.getElementById(id);
  if(!target) return;
  target.classList.add('active');
  if(id==='appSettings'){
    const nameInput=document.getElementById('settingsNameInput');
    if(nameInput) nameInput.value=userName;
  }
  if(id==='wallets' && currentUser()) loadRemoteData({silent:true});
  window.scrollTo(0,0);
}

async function startApp(){
  const v=document.getElementById('nameInput').value.trim();
  if(!v){toast(currentLang==='CN'?'请输入名字':'Enter your name');return;}
  try{
    const {data:{session}}=await supabase.auth.getSession();
    let user=session?.user;
    if(!user){
      const {data,error}=await supabase.auth.signInAnonymously({options:{data:{display_name:v}}});
      if(error) throw error;
      user=data.user;
    }else{
      const {error}=await supabase.auth.updateUser({data:{display_name:v}});
      if(error) console.warn(error);
    }
    await ensureProfile(user.id,v);
    appState.user={id:user.id,name:v,guest:true};
    userName=v;
    document.getElementById('profileName').textContent=userName;
    document.getElementById('settingsNameInput').value=userName;
    await loadRemoteData({silent:true});
    await startRealtime();
    go('wallets');
  }catch(error){
    console.error(error);
    toast(currentLang==='CN'?'无法开始使用，请再试一次':'Could not start. Please try again.');
  }
}

function populateCurrencies(){
  const home=document.getElementById('homeCurrency');
  const travel=document.getElementById('travelCurrency');
  currencies.forEach(c=>{
    home.insertAdjacentHTML('beforeend',`<option value="${c.code}">${c.flag} ${c.code}</option>`);
    travel.insertAdjacentHTML('beforeend',`<option value="${c.code}">${c.flag} ${c.code}</option>`);
  });
  home.value='MYR'; travel.value='MYR';
}



function generateInviteCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
let selectedEditTheme='#7C5CFC';
let selectedEditIcon='🧋';

function openEditWallet(){
  const w=wallets[currentWalletKey]; if(!w) return;
  if(!isOwner(w)){toast(currentLang==='CN'?'只有创建者可以编辑钱包':'Only the owner can edit this wallet');return;}
  document.getElementById('editWalletName').value=w.name||'';
  document.getElementById('editWalletRemark').value=w.remark||'';
  selectedEditTheme=w.theme||'#7C5CFC';
  selectedEditIcon=w.icon||'🧳';
  document.querySelectorAll('#editThemePicker .theme-dot').forEach(btn=>btn.classList.toggle('active',btn.dataset.color===selectedEditTheme));
  document.querySelectorAll('#editIconPicker .icon-choice').forEach(btn=>btn.classList.toggle('active',btn.dataset.icon===selectedEditIcon));
  go('editWalletScreen');
}
function selectEditTheme(btn){
  selectedEditTheme=btn.dataset.color;
  document.querySelectorAll('#editThemePicker .theme-dot').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}
function selectEditIcon(btn){
  selectedEditIcon=btn.dataset.icon;
  document.querySelectorAll('#editIconPicker .icon-choice').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
}
async function saveWalletDetails(){
  const w=wallets[currentWalletKey]; if(!w) return;
  if(!isOwner(w)){toast(currentLang==='CN'?'只有创建者可以编辑钱包':'Only the owner can edit this wallet');return;}
  const name=document.getElementById('editWalletName').value.trim();
  if(!name){toast(currentLang==='CN'?'请输入钱包名称':'Enter a wallet name');return;}
  const remark=document.getElementById('editWalletRemark').value.trim();
  const {error}=await supabase.from('wallets').update({name,remark,theme:selectedEditTheme,icon:selectedEditIcon}).eq('id',w.id);
  if(error){console.error(error);toast('Could not update wallet');return;}
  await loadRemoteData({silent:true});
  go('wallet');
  toast(currentLang==='CN'?'钱包已更新':'Wallet updated');
}

function shadeColor(hex,percent){
  const f=parseInt(hex.slice(1),16),t=percent<0?0:255,p=Math.abs(percent)/100;
  const R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
  return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

function getCurrency(code){return currencies.find(c=>c.code===code)||currencies[0]}
function fmt(code,n){
  const c=getCurrency(code); return Number(n).toLocaleString('en-MY',{minimumFractionDigits:c.dec,maximumFractionDigits:c.dec});
}
function rateUnit(code){
  return ['TWD','JPY','KRW','IDR'].includes(code)?100:1;
}

function updateCreateRate(){
  const h=document.getElementById('homeCurrency').value;
  const f=document.getElementById('travelCurrency').value;
  const ha=parseFloat(document.getElementById('homeAmount').value);
  const fa=parseFloat(document.getElementById('foreignAmount').value);
  const box=document.getElementById('createRatePreview');
  if(ha>0 && fa>0){
    const unit=rateUnit(f);
    const r=ha/fa*unit;
    document.getElementById('createRateText').textContent=`${unit} ${f} = ${h} ${r.toFixed(4)}`;
    box.style.display='block';
  }else box.style.display='none';
}

async function createWallet(){
  const name=document.getElementById('walletName').value.trim();
  if(!name){toast(currentLang==='CN'?'请输入钱包名称':'Enter a wallet name');return;}
  const home=document.getElementById('homeCurrency').value;
  const foreign=document.getElementById('travelCurrency').value;
  const homeAmt=parseFloat(document.getElementById('homeAmount').value)||0;
  const foreignAmt=parseFloat(document.getElementById('foreignAmount').value)||0;
  if(!homeAmt || !foreignAmt){toast(currentLang==='CN'?'请输入两个金额':'Enter both currency amounts'); return;}
  const remark=(document.getElementById('walletRemark')?.value||'').trim();
  const me=currentUser();
  if(!me){toast('Please start the app first');return;}
  try{
    const {data:w,error}=await supabase.from('wallets').insert({
      name,remark:remark||null,home_currency:home,travel_currency:foreign,owner_id:me.id,
      theme:selectedCreateTheme,icon:selectedCreateIcon
    }).select().single();
    if(error) throw error;
    const {error:txError}=await supabase.from('transactions').insert({
      wallet_id:w.id,user_id:me.id,type:'topup',note:'Initial Balance',foreign_amount:foreignAmt,home_amount:homeAmt
    });
    if(txError) throw txError;
    currentWalletKey=w.id;
    await loadRemoteData({silent:true});
    document.getElementById('inviteCode').textContent=wallets[w.id]?.inviteCode||w.invite_code||'';
    renderWallet();
    go('created');
  }catch(error){
    console.error(error);
    toast(currentLang==='CN'?'创建钱包失败':'Could not create wallet');
  }
}

function loadWallet(key){const w=wallets[key];if(!canAccessWallet(w)) return;currentWalletKey=key;renderWallet();go('wallet')}

function renderWallet(){
  const w=wallets[currentWalletKey];
  if(!w) return;
  const fc=getCurrency(w.foreign);
  document.documentElement.style.setProperty('--wallet-theme',w.theme||'#0F7775');
  const balanceCard=document.getElementById('walletBalanceCard');
  if(balanceCard) balanceCard.style.background=`linear-gradient(135deg, ${w.theme||'#0F7775'}, ${shadeColor(w.theme||'#0F7775',-22)})`;
  document.getElementById('walletTitle').textContent=w.name;
  const editBtn=document.getElementById('walletEditBtn'); if(editBtn) editBtn.style.display=isOwner(w)?'grid':'none';
  const inviteCard=document.getElementById('walletInviteCard'); if(inviteCard) inviteCard.style.display=isOwner(w)?'flex':'none';
  const inviteEl=document.getElementById('walletInviteCode'); if(inviteEl) inviteEl.textContent=w.inviteCode||'';
  document.getElementById('walletFlag').textContent=fc.flag;
  document.getElementById('travelCode').textContent=w.foreign;
  document.querySelectorAll('.travelCode2').forEach(x=>x.textContent=w.foreign);
  document.getElementById('homeCode').textContent=w.home;
  document.getElementById('remainingAmount').textContent=fmt(w.foreign,w.remaining);
  document.getElementById('totalForeign').textContent=fmt(w.foreign,w.foreignTotal);
  const spent=w.foreignTotal-w.remaining;
  document.getElementById('spentAmount').textContent=fmt(w.foreign,spent);
  const homePerForeign=w.homeSpent/w.foreignTotal;
  document.getElementById('remainingHome').textContent=fmt(w.home,w.remaining*homePerForeign);
  document.getElementById('spentBar').style.width=Math.min(100,(spent/w.foreignTotal)*100)+'%';
  const unit=rateUnit(w.foreign);
  const rate=homePerForeign*unit;
  const rateText=`${unit} ${w.foreign} = ${w.home} ${rate.toFixed(4)}`;
  document.getElementById('actualRate').textContent=rateText;
  document.getElementById('expenseCurrLabel').textContent=w.foreign;
  updateExpensePreview();
  renderShareStatus();
  renderRecords();
  renderShareStatus();
  renderMembers();
  renderWalletList();
}

function updateExpensePreview(){
  const w=wallets[currentWalletKey];
  const el=document.getElementById('expenseMyrPreview');
  if(!w){ if(el) el.textContent=''; return; }
  const amt=parseFloat(document.getElementById('expenseAmount').value);
  if(amt>0){
    const my=amt*(w.homeSpent/w.foreignTotal);
    el.textContent=`≈ ${w.home} ${fmt(w.home,my)}`;
  }else el.textContent='';
}

function addAmount(n){
  const el=document.getElementById('expenseAmount');
  el.value=(parseFloat(el.value)||0)+n;
  updateExpensePreview();
}

async function saveExpense(){
  const w=wallets[currentWalletKey];
  if(!w) return;
  const amount=parseFloat(document.getElementById('expenseAmount').value);
  const note=document.getElementById('expenseNote').value.trim()||'Expense';
  if(!amount){toast(currentLang==='CN'?'请输入金额':'Enter an amount');return;}
  const rate=w.foreignTotal>0 ? w.homeSpent/w.foreignTotal : 0;
  const my=amount*rate;
  const {error}=await supabase.from('transactions').insert({
    wallet_id:w.id,user_id:currentUser().id,type:'expense',note,foreign_amount:amount,home_amount:my
  });
  if(error){console.error(error);toast('Could not add expense');return;}
  document.getElementById('expenseAmount').value='';
  document.getElementById('expenseNote').value='';
  await loadRemoteData({silent:true});
  renderWallet();
  toast(currentLang==='CN'?'消费已加入':'Expense added');
}

let historyTab='expenses';

function setHistoryTab(tab){
  historyTab=tab;
  document.getElementById('expenseTab').classList.toggle('active',tab==='expenses');
  document.getElementById('topupTab').classList.toggle('active',tab==='topups');
  renderRecords();
}

function renderRecords(){
  const w=wallets[currentWalletKey];
  const latest=document.getElementById('latestRecords');
  const historyGroups=document.getElementById('historyGroups');

  const renderExpense=(r, idx)=>{
    return `<div class="tx no-icon">
      <div class="tx-main">
        <div style="font-weight:850">${escapeHtml(r.note)}</div>
        <div class="tiny">${escapeHtml(r.name)}${r.editedBy ? ` · ${currentLang==='CN'?'由':'Edited by'} ${escapeHtml(r.editedBy)}`:''}</div>
      </div>
      <div class="record-value">
        <div class="amount-stack">
          <div class="amount-line neg">-${fmt(w.foreign,r.foreign)} <span style="font-size:10px">${w.foreign}</span></div>
          <div class="myr-direct">≈ ${w.home} ${fmt(w.home,r.my)}</div>
        </div>
        ${canManageRecord(r,w)?`<div class="record-icons">
          <button class="mini-action" title="Edit" onclick="editRecord(${idx})">✎</button>
          <button class="mini-action danger" title="Delete" onclick="askDeleteRecord(${idx})">✕</button>
        </div>`:''}
      </div>
    </div>`;
  };

  const renderTopup=(r, idx)=>{
    const unit=rateUnit(w.foreign);
    const rate=(r.my/r.foreign)*unit;
    return `<div class="tx no-icon">
      <div class="tx-main">
        <div style="font-weight:850">${escapeHtml(r.note)}</div>
        <div class="tiny">${escapeHtml(r.name)} · ${escapeHtml(r.date||'')}${r.editedBy ? ` · ${currentLang==='CN'?'由':'Edited by'} ${escapeHtml(r.editedBy)}`:''}</div>
        <div class="tiny" style="margin-top:3px">${unit} ${w.foreign} = ${w.home} ${rate.toFixed(4)}</div>
      </div>
      <div class="record-value">
        <div class="amount-stack">
          <div class="amount-line pos">+${fmt(w.foreign,r.foreign)} <span style="font-size:10px">${w.foreign}</span></div>
          <div class="myr-direct">${w.home} ${fmt(w.home,r.my)}</div>
        </div>
        ${canManageRecord(r,w)?`<div class="record-icons">
          <button class="mini-action" title="Edit" onclick="editRecord(${idx})">✎</button>
          <button class="mini-action danger" title="Delete" onclick="askDeleteRecord(${idx})">✕</button>
        </div>`:''}
      </div>
    </div>`;
  };

  const expenseRecords=w.records.map((r,i)=>({...r,_idx:i})).filter(r=>r.type==='expense');
  const dates=[...new Set(expenseRecords.map(r=>r.date))];
  const latestDate=dates[0];
  const latestDay=expenseRecords.filter(r=>r.date===latestDate);
  latest.innerHTML=latestDay.slice(0,5).map(r=>renderExpense(r,r._idx)).join('') || '<div class="muted" style="padding:16px 0;text-align:center">No expenses yet</div>';

  if(!historyGroups) return;

  if(historyTab==='expenses'){
    historyGroups.innerHTML=dates.map(date=>{
      const day=expenseRecords.filter(r=>r.date===date);
      const totalForeign=day.reduce((s,r)=>s+r.foreign,0);
      const totalHome=day.reduce((s,r)=>s+r.my,0);
      return `<div style="margin-bottom:22px">
        <div class="history-day">
          <div class="history-date">${date}</div>
          <div class="history-total">
            <span class="tiny">${currentLang==='CN'?'当日总消费':'Daily total'}</span>
            <strong>${fmt(w.foreign,totalForeign)} ${w.foreign}</strong>
            <div class="tiny">≈ ${w.home} ${fmt(w.home,totalHome)}</div>
          </div>
        </div>
        <div class="panel" style="margin-top:0">${day.map(r=>renderExpense(r,r._idx)).join('')}</div>
      </div>`;
    }).join('');
  } else {
    const topups=w.records.map((r,i)=>({...r,_idx:i})).filter(r=>r.type==='topup');
    historyGroups.innerHTML=topups.length
      ? `<div class="panel" style="margin-top:0">${topups.map(r=>renderTopup(r,r._idx)).join('')}</div>`
      : '<div class="muted" style="padding:24px 0;text-align:center">No top ups yet</div>';
  }
}

async function joinWallet(){
  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  if(!code){toast(currentLang==='CN'?'请输入邀请码':'Enter an invite code');return;}
  try{
    const {data,error}=await supabase.rpc('request_join_wallet',{p_invite_code:code});
    if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(result?.request_status==='already_member'){
      toast(currentLang==='CN'?'你已经在这个钱包里':'You already have access to this wallet');
      await loadRemoteData({silent:true});
    }else{
      toast(currentLang==='CN'?'加入申请已发送，等待钱包创建者批准':'Join request sent. Waiting for owner approval.');
    }
    document.getElementById('joinCode').value='';
    go('wallets');
  }catch(error){
    console.error(error);
    const invalid=(error.message||'').toLowerCase().includes('invalid invite code');
    toast(invalid?(currentLang==='CN'?'无效邀请码':'Invalid invite code'):(currentLang==='CN'?'无法发送加入申请':'Could not send join request'));
  }
}

async function copyCode(){
  const code=document.getElementById('inviteCode').textContent;
  try{await navigator.clipboard.writeText(code);toast('Invite code copied')}
  catch{toast('Code: '+code)}
}


function toggleDark(on){
  document.body.classList.toggle('dark',on);
}
function setLang(lang){
  currentLang=lang;
  document.getElementById('langEN')?.classList.toggle('active',lang==='EN');
  document.getElementById('langCN')?.classList.toggle('active',lang==='CN');
  const onboardingLang=document.getElementById('onboardingLang');
  if(onboardingLang) onboardingLang.value=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.getAttribute('data-i18n');
    if(i18n[lang][key]!==undefined) el.textContent=i18n[lang][key];
  });
  const profileName=document.getElementById('profileName');
  if(profileName){
    const parent=profileName.parentElement;
    if(parent){
      parent.innerHTML=(lang==='CN'?'你好，':'Hi, ') + '<span id="profileName">'+escapeHtml(userName)+'</span>!';
    }
  }
  const loginPrompt=document.getElementById('loginPromptText');
  if(loginPrompt) loginPrompt.textContent=i18n[lang].loginPrompt;
  const loginCta=document.getElementById('loginCta');
  if(loginCta) loginCta.textContent=i18n[lang].login;
  const nameInput=document.getElementById('nameInput');
  if(nameInput) nameInput.placeholder=i18n[lang].enterYourName;
  const heroSubtitle=document.querySelector('.hero-copy p');
  if(heroSubtitle) heroSubtitle.textContent=i18n[lang].heroSubtitle;
  const onboardingTitle=document.getElementById('onboardingTitle');
  if(onboardingTitle) onboardingTitle.textContent=i18n[lang].onboardingTitle;
  const onboardingSubtitle=document.getElementById('onboardingSubtitle');
  if(onboardingSubtitle) onboardingSubtitle.textContent=i18n[lang].onboardingSubtitle;
  const onboardingContinueBtn=document.getElementById('onboardingContinueBtn');
  if(onboardingContinueBtn) onboardingContinueBtn.textContent=i18n[lang].continue;
  renderWalletList();
  if(currentWalletKey && wallets[currentWalletKey]){
    renderRecords();
  }
}




function renderShareStatus(){
  const w=wallets[currentWalletKey], el=document.getElementById('shareStatus');
  if(!w || !el) return;
  const members=w.members||[], requests=w.joinRequests||[];
  el.className='share-status';
  if(isOwner(w) && requests.length){
    el.classList.add('request');
    el.innerHTML=`<span>⚠ ${requests.length} ${currentLang==='CN'?'个加入申请':(requests.length===1?'request to join':'requests to join')}</span><span>›</span>`;
  } else if(members.length<=1){
    el.classList.add('private');
    el.innerHTML=`<span>🔒 ${i18n[currentLang].private}</span>`;
  } else {
    el.classList.add('shared');
    el.innerHTML=`<span>👥 ${i18n[currentLang].sharedWith} ${members.length} ${i18n[currentLang].membersLower}</span><span>›</span>`;
  }
}
function handleShareStatusClick(){
  const w=wallets[currentWalletKey]; if(!w) return;
  if((w.members||[]).length<=1 && (!isOwner(w) || (w.joinRequests||[]).length===0)) return;
  showMembers();
}
function renderMembers(){
  const w=wallets[currentWalletKey], list=document.getElementById('memberList'), requestArea=document.getElementById('joinRequestArea');
  if(!w || !list || !requestArea) return;
  const members=w.members||[];
  list.innerHTML=members.map((member,index)=>{ const name=typeof member==='string'?member:member.name; const owner=(typeof member==='object'&&member.role==='owner') || member.id===w.ownerId || index===0; return `<div class="member-row">
    <div class="member-avatar ${index===0?'m1':index===1?'m2':'m3'}">${(name||'?').charAt(0).toUpperCase()}</div>
    <div class="member-info"><div class="member-name">${escapeHtml(name)}</div><div class="member-role">${owner?i18n[currentLang].owner:i18n[currentLang].member}</div></div>
    ${owner || !isOwner(w)?'':`<button class="member-remove" onclick="removeMember(${index})">✕</button>`}
  </div>`; }).join('');
  const requests=w.joinRequests||[];
  requestArea.innerHTML=isOwner(w)?requests.map((request,index)=>{ const name=typeof request==='string'?request:request.name; return `<div class="request-card">
    <div style="font-weight:900">${escapeHtml(name)}</div>
    <div class="muted" style="margin-top:3px">${currentLang==='CN'?'请求加入这个钱包':'Wants to join this wallet'}</div>
    <div class="request-actions">
      <button class="approve-btn" onclick="approveJoinRequest(${index})">${i18n[currentLang].approve}</button>
      <button class="reject-btn" onclick="rejectJoinRequest(${index})">${i18n[currentLang].reject}</button>
    </div>
  </div>`; }).join(''):'';
}
async function approveJoinRequest(index){
  const w=wallets[currentWalletKey]; if(!w || !isOwner(w)) return;
  const request=(w.joinRequests||[])[index]; if(!request) return;
  const {error}=await supabase.rpc('approve_join_request',{p_request_id:request.requestId});
  if(error){console.error(error);toast('Could not approve request');return;}
  await loadRemoteData({silent:true});
  renderMembers(); renderShareStatus(); renderWalletList();
}
async function rejectJoinRequest(index){
  const w=wallets[currentWalletKey]; if(!w || !isOwner(w)) return;
  const request=(w.joinRequests||[])[index]; if(!request) return;
  const {error}=await supabase.rpc('reject_join_request',{p_request_id:request.requestId});
  if(error){console.error(error);toast('Could not reject request');return;}
  await loadRemoteData({silent:true});
  renderMembers(); renderShareStatus(); renderWalletList();
}
async function removeMember(index){
  const w=wallets[currentWalletKey]; if(!w || !isOwner(w)) return;
  const member=(w.members||[])[index];
  if(!member || member.role==='owner') return;
  const {error}=await supabase.from('wallet_members').delete().eq('wallet_id',w.id).eq('user_id',member.id);
  if(error){console.error(error);toast('Could not remove member');return;}
  await loadRemoteData({silent:true});
  renderMembers(); renderShareStatus(); renderWalletList();
}

function showMembers(){
  renderMembers();
  go('membersScreen');
}

async function copyWalletInvite(){
  const w=wallets[currentWalletKey];
  if(!isOwner(w)) return;
  const code=w?.inviteCode||'';
  try{ await navigator.clipboard.writeText(code); toast(currentLang==='CN'?'邀请码已复制':'Invite code copied'); }
  catch{ toast(code); }
}

let pendingDeleteWalletKey=null;
function askDeleteWallet(key){
  const w=wallets[key];
  if(!isOwner(w)){toast(currentLang==='CN'?'只有创建者可以删除钱包':'Only the owner can delete this wallet');return;}
  pendingDeleteWalletKey=key;
  document.getElementById('confirmTitle').textContent=i18n[currentLang].deleteWalletQ;
  document.getElementById('confirmMessage').textContent=currentLang==='CN'
    ? `确定要删除 ${w?.name||''} 吗？${i18n[currentLang].cannotUndo}`
    : `Delete ${w?.name||''}? ${i18n[currentLang].cannotUndo}`;
  document.getElementById('confirmActionBtn').onclick=confirmDeleteWallet;
  document.getElementById('confirmModal').classList.add('show');
  setLang(currentLang);
}

async function confirmDeleteWallet(){
  if(!pendingDeleteWalletKey) return;
  const key=pendingDeleteWalletKey;
  const w=wallets[key];
  if(!isOwner(w)) return;
  const {error}=await supabase.from('wallets').delete().eq('id',key);
  if(error){console.error(error);toast('Could not delete wallet');return;}
  document.getElementById('confirmModal').classList.remove('show');
  pendingDeleteWalletKey=null;
  if(currentWalletKey===key) currentWalletKey=null;
  await loadRemoteData({silent:true});
  go('wallets');
  toast(currentLang==='CN'?'钱包已删除':'Wallet deleted');
}

let pendingDeleteIndex=null;

let editingIndex=null;

function editRecord(index){
  const w=wallets[currentWalletKey];
  const r=w.records[index];
  if(!r || !canManageRecord(r,w)) return;
  editingIndex=index;

  document.getElementById('editTitle').textContent=r.type==='expense'
    ? i18n[currentLang].editExpense
    : i18n[currentLang].editTopUp;

  document.getElementById('editForeignLabel').textContent=w.foreign;

  const noteWrap=document.getElementById('editNoteWrap');
  if(r.type==='expense'){
    noteWrap.style.display='block';
    document.getElementById('editNote').value=r.note||'';
  }else{
    noteWrap.style.display='none';
  }

  document.getElementById('editForeignAmount').value=Number(r.foreign)||'';
  document.getElementById('editModal').classList.add('show');
  setLang(currentLang);
}

function closeEdit(){
  document.getElementById('editModal').classList.remove('show');
  editingIndex=null;
}

async function saveEdit(){
  if(editingIndex===null) return;
  const w=wallets[currentWalletKey];
  const r=w?.records?.[editingIndex];
  if(!r || !canManageRecord(r,w)) return;
  const newForeign=parseFloat(document.getElementById('editForeignAmount').value);
  if(!newForeign) return;
  let note=r.note;
  let newHome=r.my;
  if(r.type==='expense'){
    note=document.getElementById('editNote').value.trim()||r.note;
    const rate=w.foreignTotal>0?w.homeSpent/w.foreignTotal:0;
    newHome=newForeign*rate;
  }else{
    const rate=r.foreign>0?r.my/r.foreign:0;
    newHome=newForeign*rate;
  }
  const {error}=await supabase.from('transactions').update({note,foreign_amount:newForeign,home_amount:newHome}).eq('id',r.id);
  if(error){console.error(error);toast('Could not update record');return;}
  closeEdit();
  await loadRemoteData({silent:true});
  renderWallet();
  toast(i18n[currentLang].recordUpdated);
}

function askDeleteRecord(index){
  pendingDeleteIndex=index;
  const w=wallets[currentWalletKey];
  const r=w.records[index];
  if(!r || !canManageRecord(r,w)) return;
  document.getElementById('confirmTitle').textContent=r?.type==='topup'
    ? i18n[currentLang].deleteTopUp
    : i18n[currentLang].deleteExpense;
  document.getElementById('confirmMessage').textContent=i18n[currentLang].cannotUndo;
  document.getElementById('confirmActionBtn').onclick=confirmDeleteRecord;
  document.getElementById('confirmModal').classList.add('show');
  setLang(currentLang);
}

function closeConfirm(){
  document.getElementById('confirmModal').classList.remove('show');
  pendingDeleteIndex=null;
  pendingDeleteWalletKey=null;
}

async function confirmDeleteRecord(){
  if(pendingDeleteIndex===null) return;
  const w=wallets[currentWalletKey];
  const r=w?.records?.[pendingDeleteIndex];
  if(!r || !canManageRecord(r,w)){closeConfirm();return;}
  const {error}=await supabase.from('transactions').delete().eq('id',r.id);
  if(error){console.error(error);toast('Could not delete record');return;}
  closeConfirm();
  await loadRemoteData({silent:true});
  renderWallet();
  toast(currentLang==='CN'?'记录已删除':'Record deleted');
}

async function changeName(){
  const input=document.getElementById('settingsNameInput');
  const name=input.value.trim();
  if(!name){toast(currentLang==='CN'?'请输入名字':'Enter a name');return;}
  const me=currentUser(); if(!me) return;
  const {error}=await supabase.from('profiles').update({display_name:name}).eq('id',me.id);
  if(error){console.error(error);toast('Could not update name');return;}
  await supabase.auth.updateUser({data:{display_name:name}});
  userName=name; appState.user.name=name;
  document.getElementById('profileName').textContent=userName;
  await loadRemoteData({silent:true});
  toast(currentLang==='CN'?'名字已更新':'Name updated');
}
function openTopUp(){
  const w=wallets[currentWalletKey];
  document.getElementById('topUpHomeLabel').textContent=w.home;
  document.getElementById('topUpForeignLabel').textContent=w.foreign;
  document.getElementById('topUpHome').value='';
  document.getElementById('topUpForeign').value='';
  document.getElementById('topUpRatePreview').textContent='';
  go('topup');
}
async function confirmTopUp(){
  const w=wallets[currentWalletKey]; if(!w) return;
  const home=parseFloat(document.getElementById('topUpHome').value);
  const foreign=parseFloat(document.getElementById('topUpForeign').value);
  if(!home || !foreign){toast(currentLang==='CN'?'请输入两个金额':'Enter both amounts');return;}
  const {error}=await supabase.from('transactions').insert({
    wallet_id:w.id,user_id:currentUser().id,type:'topup',note:'Top Up',foreign_amount:foreign,home_amount:home
  });
  if(error){console.error(error);toast('Could not add top up');return;}
  await loadRemoteData({silent:true});
  renderWallet();
  go('wallet');
  toast(currentLang==='CN'?'充值已加入':'Top up added');
}

function toast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

populateCurrencies();
document.getElementById('topUpHome').addEventListener('input', updateTopUpPreview);
document.getElementById('topUpForeign').addEventListener('input', updateTopUpPreview);
function updateTopUpPreview(){
  const w=wallets[currentWalletKey];
  const h=parseFloat(document.getElementById('topUpHome').value);
  const f=parseFloat(document.getElementById('topUpForeign').value);
  const el=document.getElementById('topUpRatePreview');
  if(w && h>0 && f>0){
    const unit=rateUnit(w.foreign);
    el.textContent=`${unit} ${w.foreign} = ${w.home} ${(h/f*unit).toFixed(4)}`;
  }else el.textContent='';
}
renderWalletList();
initSession();
window.addEventListener('focus',()=>{ if(currentUser()) scheduleRealtimeRefresh(); });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && currentUser()) scheduleRealtimeRefresh(); });

Object.assign(window, {
  walletEntries,
  loadRemoteData,
  startRealtime,
  stopRealtime,
  renderWalletList,
  toggleShowAllWallets,
  selectCreateTheme,
  selectCreateIcon,
  go,
  startApp,
  populateCurrencies,
  generateInviteCode,
  openEditWallet,
  selectEditTheme,
  selectEditIcon,
  saveWalletDetails,
  shadeColor,
  getCurrency,
  fmt,
  rateUnit,
  updateCreateRate,
  createWallet,
  loadWallet,
  renderWallet,
  updateExpensePreview,
  addAmount,
  saveExpense,
  setHistoryTab,
  renderRecords,
  joinWallet,
  copyCode,
  toggleDark,
  setLang,
  renderShareStatus,
  handleShareStatusClick,
  renderMembers,
  approveJoinRequest,
  rejectJoinRequest,
  removeMember,
  showMembers,
  copyWalletInvite,
  askDeleteWallet,
  confirmDeleteWallet,
  editRecord,
  closeEdit,
  saveEdit,
  askDeleteRecord,
  closeConfirm,
  confirmDeleteRecord,
  changeName,
  openTopUp,
  confirmTopUp,
  toast,
  escapeHtml,
  updateTopUpPreview
});
