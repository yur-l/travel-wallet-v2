
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

const wallets = {};
let currentWalletKey=null;

let showAllWallets=false;

function walletEntries(){
  return Object.entries(wallets);
}

function renderWalletList(){
  const list=document.getElementById('walletList');
  const count=document.getElementById('walletCount');
  const showBtn=document.getElementById('showAllWalletsBtn');
  if(!list) return;
  const entries=walletEntries();
  if(count) count.textContent=entries.length;
  if(entries.length===0){
    list.innerHTML=`<div class="empty-wallets"><strong>No wallets yet</strong><span>Create your first travel wallet to get started.</span></div>`;
    if(showBtn) showBtn.style.display='none';
    return;
  }
  const visible=showAllWallets ? entries : entries.slice(0,3);
  list.innerHTML=visible.map(([key,w])=>{
    const homePerForeign=w.foreignTotal ? w.homeSpent/w.foreignTotal : 0;
    const homeValue=w.remaining*homePerForeign;
    const members=w.members||[userName];
    const sharedMeta=members.length>1 ? `<span>•</span><span>${members.length} ${i18n[currentLang].membersLower}</span>` : '';
    return `<div class="wallet-card" onclick="loadWallet('${key}')">
      <button class="wallet-delete" onclick="event.stopPropagation();askDeleteWallet('${key}')">✕</button>
      <div class="wallet-symbol" style="background:${w.theme||'#0F7775'}">${w.icon||'🧳'}</div>
      <div>
        <div class="wallet-name">${escapeHtml(w.name)}</div>
        ${w.remark ? `<div class="wallet-remark">${escapeHtml(w.remark)}</div>` : ''}
        <div class="wallet-meta"><span>${w.foreign}</span>${sharedMeta}</div>
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
    walletColor:'Wallet Color',walletIcon:'Wallet Icon',private:'Private',requestToJoin:'request to join',requestsToJoin:'requests to join',approve:'Approve',reject:'Reject',removeMember:'Remove member',remark:'Remark',editWallet:'Edit Wallet'
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
    walletColor:'钱包颜色',walletIcon:'钱包图标',private:'私人',requestToJoin:'个加入申请',requestsToJoin:'个加入申请',approve:'批准',reject:'拒绝',removeMember:'移除成员',remark:'备注',editWallet:'编辑钱包'
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
  window.scrollTo(0,0);
}

function startApp(){
  const v=document.getElementById('nameInput').value.trim();
  if(!v){toast('Enter your name');return;}
  userName=v;
  document.getElementById('profileName').textContent=userName;
  go('wallets');
}

function populateCurrencies(){
  const home=document.getElementById('homeCurrency');
  const travel=document.getElementById('travelCurrency');
  currencies.forEach(c=>{
    home.insertAdjacentHTML('beforeend',`<option value="${c.code}">${c.flag} ${c.code}</option>`);
    travel.insertAdjacentHTML('beforeend',`<option value="${c.code}">${c.flag} ${c.code}</option>`);
  });
  home.value='MYR'; travel.value='TWD';
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
function saveWalletDetails(){
  const w=wallets[currentWalletKey]; if(!w) return;
  const name=document.getElementById('editWalletName').value.trim();
  if(name) w.name=name;
  w.remark=document.getElementById('editWalletRemark').value.trim();
  w.theme=selectedEditTheme;
  w.icon=selectedEditIcon;
  renderWallet(); renderWalletList(); go('wallet');
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

function createWallet(){
  const name=document.getElementById('walletName').value.trim()||'New Wallet';
  const home=document.getElementById('homeCurrency').value;
  const foreign=document.getElementById('travelCurrency').value;
  const homeAmt=parseFloat(document.getElementById('homeAmount').value)||0;
  const foreignAmt=parseFloat(document.getElementById('foreignAmount').value)||0;
  if(!homeAmt || !foreignAmt){toast('Enter both currency amounts'); return;}
  const remark=(document.getElementById('walletRemark')?.value||'').trim();
  const walletKey='wallet_'+Date.now();
  wallets[walletKey]={name,home,foreign,homeSpent:homeAmt,foreignTotal:foreignAmt,remaining:foreignAmt,theme:selectedCreateTheme,icon:selectedCreateIcon,remark,inviteCode:generateInviteCode(),members:[userName],joinRequests:[],records:[{type:'topup',note:'Initial Balance',foreign:foreignAmt,my:homeAmt,name:userName,date:'5 Oct 2026',time:'Now',initial:true}]};
  currentWalletKey=walletKey;
  renderWalletList();
  document.getElementById('inviteCode').textContent=wallets[walletKey].inviteCode;
  renderWallet();
  go('created');
}

function loadWallet(key){currentWalletKey=key;renderWallet();go('wallet')}

function renderWallet(){
  const w=wallets[currentWalletKey];
  if(!w) return;
  const fc=getCurrency(w.foreign);
  document.documentElement.style.setProperty('--wallet-theme',w.theme||'#0F7775');
  const balanceCard=document.getElementById('walletBalanceCard');
  if(balanceCard) balanceCard.style.background=`linear-gradient(135deg, ${w.theme||'#0F7775'}, ${shadeColor(w.theme||'#0F7775',-22)})`;
  document.getElementById('walletTitle').textContent=w.name;
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

function saveExpense(){
  const w=wallets[currentWalletKey];
  const amount=parseFloat(document.getElementById('expenseAmount').value);
  const note=document.getElementById('expenseNote').value.trim()||'Expense';
  if(!amount){toast('Enter an amount');return}
  const my=amount*(w.homeSpent/w.foreignTotal);
  w.remaining=w.remaining-amount;
  w.records.unshift({type:'expense',note,foreign:amount,my,name:userName,date:'5 Oct 2026',time:'Now'});
  document.getElementById('expenseAmount').value='';
  document.getElementById('expenseNote').value='';
  renderWallet();
  toast('Expense added');
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
        <div class="record-icons">
          <button class="mini-action" title="Edit" onclick="editRecord(${idx})">✎</button>
          <button class="mini-action danger" title="Delete" onclick="askDeleteRecord(${idx})">✕</button>
        </div>
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
        <div class="record-icons">
          <button class="mini-action" title="Edit" onclick="editRecord(${idx})">✎</button>
          <button class="mini-action danger" title="Delete" onclick="askDeleteRecord(${idx})">✕</button>
        </div>
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

function joinWallet(){
  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  const match=Object.entries(wallets).find(([_,w])=>(w.inviteCode||'').toUpperCase()===code);
  if(!match){ toast(currentLang==='CN'?'无效代码':'Invalid Code'); return; }
  const [key,target]=match;
  target.joinRequests=target.joinRequests||[];
  if(!target.joinRequests.includes(userName) && !(target.members||[]).includes(userName)) target.joinRequests.push(userName);
  currentWalletKey=key;
  renderWallet(); renderWalletList();
  toast(currentLang==='CN'?'已发送加入申请':'Join request sent');
  setTimeout(()=>go('wallet'),400);
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
  document.getElementById('langEN').classList.toggle('active',lang==='EN');
  document.getElementById('langCN').classList.toggle('active',lang==='CN');
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
  renderRecords();
}





function renderShareStatus(){
  const w=wallets[currentWalletKey], el=document.getElementById('shareStatus');
  if(!w || !el) return;
  const members=w.members||[userName], requests=w.joinRequests||[];
  el.className='share-status';
  if(requests.length){
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
  if((w.members||[]).length<=1 && (w.joinRequests||[]).length===0) return;
  showMembers();
}
function renderMembers(){
  const w=wallets[currentWalletKey], list=document.getElementById('memberList'), requestArea=document.getElementById('joinRequestArea');
  if(!w || !list || !requestArea) return;
  const members=w.members||[userName];
  list.innerHTML=members.map((name,index)=>`<div class="member-row">
    <div class="member-avatar ${index===0?'m1':index===1?'m2':'m3'}">${(name||'?').charAt(0).toUpperCase()}</div>
    <div class="member-info"><div class="member-name">${escapeHtml(name)}</div><div class="member-role">${index===0?i18n[currentLang].owner:i18n[currentLang].member}</div></div>
    ${index===0?'':`<button class="member-remove" onclick="removeMember(${index})">✕</button>`}
  </div>`).join('');
  const requests=w.joinRequests||[];
  requestArea.innerHTML=requests.map((name,index)=>`<div class="request-card">
    <div style="font-weight:900">${escapeHtml(name)}</div>
    <div class="muted" style="margin-top:3px">${currentLang==='CN'?'请求加入这个钱包':'Wants to join this wallet'}</div>
    <div class="request-actions">
      <button class="approve-btn" onclick="approveJoinRequest(${index})">${i18n[currentLang].approve}</button>
      <button class="reject-btn" onclick="rejectJoinRequest(${index})">${i18n[currentLang].reject}</button>
    </div>
  </div>`).join('');
}
function approveJoinRequest(index){
  const w=wallets[currentWalletKey]; if(!w) return;
  const name=(w.joinRequests||[])[index]; if(!name) return;
  w.members=w.members||[userName]; w.members.push(name); w.joinRequests.splice(index,1);
  renderMembers(); renderShareStatus(); renderWalletList();
}
function rejectJoinRequest(index){
  const w=wallets[currentWalletKey]; if(!w) return;
  w.joinRequests.splice(index,1); renderMembers(); renderShareStatus(); renderWalletList();
}
function removeMember(index){
  const w=wallets[currentWalletKey]; if(!w || index===0) return;
  w.members.splice(index,1); renderMembers(); renderShareStatus(); renderWalletList();
}

function showMembers(){
  renderMembers();
  go('membersScreen');
}

async function copyWalletInvite(){
  const w=wallets[currentWalletKey];
  const code=w?.inviteCode||'';
  try{ await navigator.clipboard.writeText(code); toast(currentLang==='CN'?'邀请码已复制':'Invite code copied'); }
  catch{ toast(code); }
}

let pendingDeleteWalletKey=null;
function askDeleteWallet(key){
  pendingDeleteWalletKey=key;
  const w=wallets[key];
  document.getElementById('confirmTitle').textContent=i18n[currentLang].deleteWalletQ;
  document.getElementById('confirmMessage').textContent=currentLang==='CN'
    ? `确定要删除 ${w?.name||''} 吗？${i18n[currentLang].cannotUndo}`
    : `Delete ${w?.name||''}? ${i18n[currentLang].cannotUndo}`;
  document.getElementById('confirmActionBtn').onclick=confirmDeleteWallet;
  document.getElementById('confirmModal').classList.add('show');
  setLang(currentLang);
}

function confirmDeleteWallet(){
  if(!pendingDeleteWalletKey) return;
  delete wallets[pendingDeleteWalletKey];
  renderWalletList();
  document.getElementById('confirmModal').classList.remove('show');
  pendingDeleteWalletKey=null;
  toast(currentLang==='CN'?'钱包已删除':'Wallet deleted');
}

let pendingDeleteIndex=null;

let editingIndex=null;

function editRecord(index){
  const w=wallets[currentWalletKey];
  const r=w.records[index];
  if(!r) return;
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

function saveEdit(){
  if(editingIndex===null) return;
  const w=wallets[currentWalletKey];
  const r=w.records[editingIndex];
  if(!r) return;

  const newForeign=parseFloat(document.getElementById('editForeignAmount').value);
  if(!newForeign) return;

  if(r.type==='expense'){
    const oldForeign=r.foreign;
    const homePerForeign=w.homeSpent/w.foreignTotal;
    r.note=document.getElementById('editNote').value.trim()||r.note;
    r.foreign=newForeign;
    r.my=newForeign*homePerForeign;
    r.editedBy=userName;
    w.remaining += oldForeign-newForeign;
  }else{
    const rate=r.my/r.foreign;
    const newHome=newForeign*rate;
    const dh=newHome-r.my, df=newForeign-r.foreign;
    r.my=newHome;
    r.foreign=newForeign;
    r.editedBy=userName;
    w.homeSpent+=dh;
    w.foreignTotal+=df;
    w.remaining+=df;
  }

  closeEdit();
  renderWallet();
  renderRecords();
  toast(i18n[currentLang].recordUpdated);
}

function askDeleteRecord(index){
  pendingDeleteIndex=index;
  const w=wallets[currentWalletKey];
  const r=w.records[index];
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

function confirmDeleteRecord(){
  if(pendingDeleteIndex===null) return;
  const w=wallets[currentWalletKey];
  const r=w.records[pendingDeleteIndex];
  if(!r){closeConfirm();return}
  if(r.type==='expense'){
    w.remaining+=r.foreign;
  }else{
    w.homeSpent-=r.my;
    w.foreignTotal-=r.foreign;
    w.remaining-=r.foreign;
  }
  w.records.splice(pendingDeleteIndex,1);
  closeConfirm();
  renderWallet();
  renderRecords();
  toast('Record deleted');
}

function changeName(){
  const input=document.getElementById('settingsNameInput');
  const name=input.value.trim();
  if(!name){toast(currentLang==='CN'?'请输入名字':'Enter a name');return}
  userName=name;
  document.getElementById('profileName').textContent=userName;
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
function confirmTopUp(){
  const w=wallets[currentWalletKey];
  const home=parseFloat(document.getElementById('topUpHome').value);
  const foreign=parseFloat(document.getElementById('topUpForeign').value);
  if(!home || !foreign){toast(currentLang==='CN'?'请输入两个金额':'Enter both amounts');return}
  w.homeSpent+=home;
  w.foreignTotal+=foreign;
  w.remaining+=foreign;
  w.records.unshift({type:'topup',note:'Top Up',foreign,my:home,name:userName,date:'5 Oct 2026',time:'Now'});
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
  if(h>0 && f>0){
    const unit=rateUnit(w.foreign);
    el.textContent=`${unit} ${w.foreign} = ${w.home} ${(h/f*unit).toFixed(4)}`;
  }else el.textContent='';
}
document.getElementById('settingsNameInput').value=userName||'';
renderWalletList();


Object.assign(window, {
  walletEntries,
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
