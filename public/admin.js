let csrf = "";
const $ = id => document.getElementById(id);
async function api(url, options={}) {
  const headers = {...(options.headers||{})};
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(url, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function showMessage(text, bad=false) {
  $("message").innerHTML = "";
  const p = document.createElement("p"); p.className = "msg" + (bad ? " danger" : ""); p.textContent = text; $("message").append(p);
}
async function load() {
  const list = await api("/api/admin/submissions");
  $("items").innerHTML = "";
  if (!list.length) { $("items").textContent = "No submissions yet."; return; }
  list.forEach(item => {
    const card = document.createElement("article"); card.className = "item";
    const title = document.createElement("h3"); title.textContent = item.groupName; card.append(title);
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${item.category} · ${new Date(item.createdAt).toLocaleString()} · ${item.status}`; card.append(meta);
    const link = document.createElement("p"); link.className = "link"; link.textContent = item.inviteLink; card.append(link);
    if (item.description) { const d=document.createElement("p"); d.textContent=item.description; card.append(d); }
    const controls = document.createElement("div"); controls.className="row";
    const copy=document.createElement("button"); copy.className="copy"; copy.textContent="Copy invite link"; copy.onclick=async()=>{await navigator.clipboard.writeText(item.inviteLink);showMessage("Invite link copied. You can paste it into your WhatsApp Channel.");}; controls.append(copy);
    const approve=document.createElement("button"); approve.className="primary"; approve.textContent="Approve"; approve.onclick=()=>setStatus(item.id,"approved"); controls.append(approve);
    const reject=document.createElement("button"); reject.className="reject"; reject.textContent="Reject"; reject.onclick=()=>setStatus(item.id,"rejected"); controls.append(reject);
    const del=document.createElement("button"); del.textContent="Delete"; del.onclick=()=>removeItem(item.id); controls.append(del);
    card.append(controls); $("items").append(card);
  });
}
async function setStatus(id,status){try{await api(`/api/admin/submissions/${id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});showMessage("Status updated.");await load();}catch(e){showMessage(e.message,true);}}
async function removeItem(id){if(!confirm("Delete this submission permanently?"))return;try{await api(`/api/admin/submissions/${id}`,{method:"DELETE"});await load();}catch(e){showMessage(e.message,true);}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginMsg").textContent="";try{const data=await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("password").value})});csrf=data.csrf;$("login").classList.add("hidden");$("dashboard").classList.remove("hidden");await load();}catch(err){$("loginMsg").textContent=err.message;}});
$("refresh").onclick=()=>load().catch(e=>showMessage(e.message,true));
$("logout").onclick=async()=>{try{await api("/api/admin/logout",{method:"POST"});}finally{csrf="";$("dashboard").classList.add("hidden");$("login").classList.remove("hidden");}};
(async()=>{try{const data=await api("/api/admin/me");csrf=data.csrf;$("login").classList.add("hidden");$("dashboard").classList.remove("hidden");await load();}catch{}})();
