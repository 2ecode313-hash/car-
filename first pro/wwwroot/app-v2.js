const egp = n => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(Number(n || 0)) + ' ج.م';
let state = null;
const invoiceModal = document.getElementById('invoiceModal');
const simpleModal = document.getElementById('simpleModal');

async function loadData() {
  state = await fetch('/api/v2/overview').then(r => r.json());
  document.getElementById('invoiceCount').textContent = state.invoiceCount;
  document.getElementById('paidAmount').textContent = egp(state.paid);
  document.getElementById('pendingAmount').textContent = egp(state.outstanding);
  document.getElementById('customerCount').textContent = state.customerCount;
  renderInvoices(); renderCustomers(); renderCars(); renderServices(); renderTransactions(); renderSettings(); renderReports();
}

function renderInvoices() {
  const row = i => `<tr><td><strong>#${i.number || 'INV-' + i.id}</strong></td><td>${customerName(i.customerId)}</td><td>${carName(i.carId)}</td><td>${i.items?.map(x => x.name).join('، ') || '—'}</td><td><strong>${egp(i.total)}</strong></td><td><span class="status ${i.status === 'مدفوع' ? 'مدفوع' : 'معلق'}">${i.status}</span></td><td>${i.date}</td><td><button class="row-action" title="تعديل" onclick="editInvoice(${i.id})">✎</button> <button class="row-action" title="تسجيل دفع" onclick="addPayment(${i.id})">₪</button> <button class="row-action" title="طباعة" onclick="printInvoice(${i.id})">▣</button> <button class="row-action danger" title="حذف" onclick="deleteInvoice(${i.id})">×</button></td></tr>`;
  document.getElementById('recentInvoices').innerHTML = state.invoices.slice(0, 4).map(row).join('');
  document.getElementById('allInvoices').innerHTML = state.invoices.map(row).join('');
}

function customerName(id) { return state.customers.find(x => x.id === id)?.name || 'عميل غير مسجل'; }
function carName(id) { const car = state.cars.find(x => x.id === id); return car ? `${car.brand} ${car.model}` : 'سيارة غير مسجلة'; }

function renderCustomers() {
  document.getElementById('customerRows').innerHTML = state.customers.map(c => `<tr><td><strong>${c.name}</strong><small>${c.email || ''}</small></td><td>${c.phone}</td><td>${c.address}</td><td><button class="row-action" onclick="editCustomer(${c.id})">✎</button> <button class="row-action danger" onclick="deleteCustomer(${c.id})">×</button></td></tr>`).join('');
}

function renderCars() {
  document.getElementById('carRows').innerHTML = state.cars.map(c => `<tr><td>${customerName(c.customerId)}</td><td><strong>${c.brand} ${c.model} ${c.year}</strong><small>${c.vin || ''}</small></td><td>${c.plate}</td><td>${new Intl.NumberFormat('ar-EG').format(c.mileage)} كم</td><td><button class="row-action" onclick="editCar(${c.id})">✎</button> <button class="row-action danger" onclick="deleteCar(${c.id})">×</button></td></tr>`).join('');
}

function renderServices() {
  document.getElementById('serviceRows').innerHTML = state.services.map(s => {
    const profit = s.price - s.cost;
    return `<tr><td><strong>${s.name}</strong></td><td>${s.category}</td><td>${egp(s.price)}</td><td>${egp(s.cost)}</td><td class="profit">${egp(profit)}</td><td>${s.taxPercent}%</td><td><button class="row-action" onclick="editService(${s.id})">✎</button> <button class="row-action danger" onclick="deleteService(${s.id})">×</button></td></tr>`;
  }).join('');
}

function renderTransactions() {
  const income = state.transactions.filter(x => x.type === 'إيراد').reduce((sum, x) => sum + x.amount, 0);
  const expense = state.transactions.filter(x => x.type === 'مصروف').reduce((sum, x) => sum + x.amount, 0);
  document.getElementById('accountIncome').textContent = egp(income);
  document.getElementById('accountExpense').textContent = egp(expense);
  document.getElementById('accountNet').textContent = egp(income - expense);
  document.getElementById('accountOutstanding').textContent = egp(state.outstanding);
  document.getElementById('transactionRows').innerHTML = state.transactions.map(t => `<tr><td>${t.date}</td><td>${t.description}</td><td><span class="status ${t.type === 'إيراد' ? 'مدفوع' : 'معلق'}">${t.type}</span></td><td>${t.method}</td><td><strong>${egp(t.amount)}</strong></td><td>—</td></tr>`).join('');
}

function renderReports() {
  document.getElementById('financialReport').innerHTML = `<p><span>إجمالي الفواتير</span><strong>${state.invoiceCount}</strong></p><p><span>المحصل فعليًا</span><strong>${egp(state.paid)}</strong></p><p><span>المستحقات</span><strong>${egp(state.outstanding)}</strong></p>`;
  const usage = {};
  state.invoices.flatMap(i => i.items || []).forEach(item => usage[item.name] = (usage[item.name] || 0) + 1);
  document.getElementById('serviceReport').innerHTML = Object.entries(usage).sort((a,b) => b[1]-a[1]).map(([name,count]) => `<p><span>${name}</span><strong>${count} مرة</strong></p>`).join('') || '<p>لا توجد خدمات مسجلة بعد</p>';
}

function renderSettings() {
  const s = state.settings || {};
  const form = document.getElementById('settingsForm');
  if (!form) return;
  form.elements.workshopName.value = s.workshopName || '';
  form.elements.phone.value = s.phone || '';
  form.elements.address.value = s.address || '';
  form.elements.taxNumber.value = s.taxNumber || '';
  form.elements.taxPercent.value = s.taxPercent ?? 14;
  form.elements.invoicePrefix.value = s.invoicePrefix || 'INV';
  form.elements.email.value = s.email || '';
  form.elements.commercialRegister.value = s.commercialRegister || '';
  form.elements.defaultIssuedBy.value = s.defaultIssuedBy || 'عبدالله أحمد';
  form.elements.invoiceFooter.value = s.invoiceFooter || 'شكرًا لتعاملكم معنا';
  form.elements.lowStockAlert.value = String(s.lowStockAlert);
}

function showToast(message) {
  const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500);
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === name));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  const titles = { dashboard:'لوحة التحكم', invoices:'الفواتير', customers:'العملاء', cars:'السيارات', services:'خدمات الورشة', accounts:'الحسابات والمصروفات', reports:'التقارير', settings:'الإعدادات' };
  document.getElementById('pageTitle').textContent = titles[name];
}

document.querySelectorAll('.nav-item[data-page]').forEach(n => n.addEventListener('click', () => showPage(n.dataset.page)));
document.querySelectorAll('[data-page-link]').forEach(n => n.addEventListener('click', () => showPage(n.dataset.pageLink)));

document.getElementById('globalSearch').addEventListener('input', e => {
  const term = e.target.value.trim().toLowerCase();
  const rows = state.invoices.filter(i => [customerName(i.customerId), carName(i.carId), i.number, ...(i.items || []).map(x => x.name)].join(' ').toLowerCase().includes(term));
  document.getElementById('allInvoices').innerHTML = rows.map(i => `<tr><td><strong>#${i.number}</strong></td><td>${customerName(i.customerId)}</td><td>${carName(i.carId)}</td><td>${i.items?.map(x=>x.name).join('، ')}</td><td>${egp(i.total)}</td><td>${i.status}</td><td>${i.date}</td><td><button class="row-action" onclick="editInvoice(${i.id})">✎</button></td></tr>`).join('');
  if (term) showPage('invoices');
});

function populateInvoiceSelects(customerId = 0, carId = 0) {
  document.getElementById('invoiceCustomer').innerHTML = '<option value="">اختر عميلًا</option>' + state.customers.map(c => `<option value="${c.id}" ${c.id === customerId ? 'selected' : ''}>${c.name}</option>`).join('');
  filterInvoiceCars(carId);
}

function filterInvoiceCars(selectedId = 0) {
  const customerId = Number(document.getElementById('invoiceCustomer').value);
  const cars = state.cars.filter(c => !customerId || c.customerId === customerId);
  document.getElementById('invoiceCar').innerHTML = '<option value="">اختر سيارة</option>' + cars.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.brand} ${c.model} - ${c.plate}</option>`).join('');
}

document.getElementById('invoiceCustomer')?.addEventListener('change', () => filterInvoiceCars());

function openNewInvoice() {
  document.getElementById('invoiceForm').reset();
  document.querySelector('#invoiceForm [name="id"]').value = '0';
  document.querySelector('#invoiceForm [name="date"]').value = new Date().toISOString().slice(0, 10);
  document.querySelector('#invoiceForm [name="dueDate"]').value = new Date(Date.now()+7*86400000).toISOString().slice(0, 10);
  document.getElementById('discountPercent').value = '0'; document.getElementById('taxPercent').value = state.settings?.taxPercent ?? 14;
  const form = document.getElementById('invoiceForm'); if(form.elements.issuedBy) form.elements.issuedBy.value = state.settings?.defaultIssuedBy || 'عبدالله أحمد';
  document.getElementById('invoiceModalTitle').textContent = 'إصدار فاتورة جديدة'; populateInvoiceSelects();
  document.getElementById('invoiceLines').innerHTML = ''; addInvoiceLine(); invoiceModal.showModal(); calculateInvoice();
}

function addInvoiceLine(item = null) {
  const row = document.createElement('div'); row.className = 'invoice-line';
  const grouped = Object.groupBy ? state.services.reduce((groups,s) => { (groups[s.category] ||= []).push(s); return groups; }, {}) : {};
  const options = Object.entries(grouped).map(([category,services]) => `<optgroup label="${category}">${services.map(s => `<option value="${s.id}" ${item && s.id === item.serviceId ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>`).join('');
  row.innerHTML = `<select class="line-service">${options || state.services.map(s => `<option value="${s.id}" ${item && s.id === item.serviceId ? 'selected' : ''}>${s.name}</option>`).join('')}</select><input class="line-qty" type="number" min="1" value="${item?.quantity || 1}" aria-label="الكمية"><input class="line-price" type="number" min="0" value="${item?.unitPrice || ''}" aria-label="السعر"><strong class="line-total">0 ج.م</strong><button type="button" class="row-action danger remove-line">×</button>`;
  document.getElementById('invoiceLines').appendChild(row);
  row.querySelector('.line-service').addEventListener('change', () => setLinePrice(row));
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', calculateInvoice));
  row.querySelector('.remove-line').addEventListener('click', () => { row.remove(); calculateInvoice(); });
  if (item) setLinePrice(row, false); else setLinePrice(row);
}

function setLinePrice(row, update = true) {
  const service = state.services.find(s => s.id === Number(row.querySelector('.line-service').value));
  if (service && update) row.querySelector('.line-price').value = service.price;
  calculateInvoice();
}

function calculateInvoice() {
  let subtotal = 0;
  document.querySelectorAll('.invoice-line').forEach(row => {
    const qty = Number(row.querySelector('.line-qty').value || 0); const price = Number(row.querySelector('.line-price').value || 0); const line = qty * price; subtotal += line; row.querySelector('.line-total').textContent = egp(line);
  });
  const discount = subtotal * Number(document.getElementById('discountPercent').value || 0) / 100;
  const tax = (subtotal - discount) * Number(document.getElementById('taxPercent').value || 0) / 100;
  const total = subtotal - discount + tax;
  document.getElementById('subtotalValue').textContent = egp(subtotal); document.getElementById('discountValue').textContent = egp(discount); document.getElementById('taxValue').textContent = egp(tax); document.getElementById('totalValue').textContent = egp(total);
}

document.getElementById('addInvoiceLine').addEventListener('click', () => addInvoiceLine());
document.getElementById('discountPercent').addEventListener('input', calculateInvoice);
document.getElementById('taxPercent').addEventListener('input', calculateInvoice);

function editInvoice(id) {
  const i = state.invoices.find(x => x.id === id); if (!i) return;
  const form = document.getElementById('invoiceForm'); form.elements.id.value = i.id; form.elements.date.value = i.date; form.elements.dueDate.value = i.dueDate; form.elements.status.value = i.status; form.elements.paymentMethod.value = i.paymentMethod; form.elements.paid.value = i.paid; form.elements.notes.value = i.notes; form.elements.discountPercent.value = i.discountPercent; form.elements.taxPercent.value = i.taxPercent;
  if(form.elements.warrantyNotes) form.elements.warrantyNotes.value = i.warrantyNotes || '';
  if(form.elements.issuedBy) form.elements.issuedBy.value = i.issuedBy || state.settings?.defaultIssuedBy || 'عبدالله أحمد';
  populateInvoiceSelects(i.customerId, i.carId); const car = state.cars.find(c => c.id === i.carId); form.elements.mileage.value = i.mileageAtService || car?.mileage || 0;
  document.getElementById('invoiceLines').innerHTML = ''; i.items.forEach(x => addInvoiceLine(x)); document.getElementById('invoiceModalTitle').textContent = `تعديل فاتورة #${i.number}`; calculateInvoice(); invoiceModal.showModal();
}

async function deleteInvoice(id) { if (!confirm('هل تريد حذف الفاتورة نهائيًا؟')) return; const r = await fetch(`/api/v2/invoices/${id}`, { method:'DELETE' }); if(r.ok){await loadData();showToast('تم حذف الفاتورة');}}

async function addPayment(id) {
  const amountText = prompt('المبلغ المستحق المراد تحصيله:', ''); if (!amountText) return; const amount = Number(amountText); if(amount<=0)return;
  const method = prompt('طريقة الدفع: كاش، بطاقة بنكية، تحويل بنكي', 'كاش') || 'كاش';
  const r = await fetch(`/api/v2/invoices/${id}/payments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount,method}) });
  if(r.ok){await loadData();showToast('تم تسجيل التحصيل');}else showToast(await r.text());
}

function printInvoice(id) {
  const i = state.invoices.find(x=>x.id===id); if(!i)return;
  const car=state.cars.find(x=>x.id===i.carId); const customer=state.customers.find(x=>x.id===i.customerId); const s=state.settings;
  const items=i.items.map(x=>`<tr><td>${x.name}</td><td>${x.quantity}</td><td>${egp(x.unitPrice)}</td><td>${egp(x.quantity*x.unitPrice)}</td></tr>`).join('');
  const issueDate=new Date(i.date+'T12:00:00').toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});
  const dueDate=i.dueDate?new Date(i.dueDate+'T12:00:00').toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'}):'—';
  const w=window.open('', '_blank','width=900,height=760');
  w.document.write(`<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${i.number}</title><style>@page{size:A4;margin:12mm}body{font-family:Cairo,Arial;color:#1d2a3d;margin:0}.sheet{padding:22px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #315bdb;padding-bottom:16px}.brand h1{margin:0;font-size:23px}.brand p,.invoice-info p{margin:3px 0;font-size:11px}.invoice-info{text-align:left}.invoice-info h2{margin:0 0 5px}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:16px 0}.box{border:1px solid #dfe5ed;border-radius:7px;padding:10px 12px;font-size:11px}.box strong{display:block;margin-bottom:7px;color:#315bdb}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f3f6fb;color:#536174;padding:9px;border-bottom:1px solid #dfe5ed}td{padding:9px;border-bottom:1px solid #edf0f4}.bottom{display:grid;grid-template-columns:1fr 300px;gap:18px;margin-top:14px}.totals p{display:flex;justify-content:space-between;margin:7px 0;font-size:12px}.grand{border-top:2px solid #315bdb;padding-top:10px;font-size:16px!important}.notes{font-size:11px}.signatures{display:grid;grid-template-columns:1fr 1fr;margin-top:28px;font-size:11px}.signature{border-top:1px solid #8290a3;width:180px;padding-top:7px;text-align:center}.footer{text-align:center;border-top:1px solid #dfe5ed;margin-top:20px;padding-top:8px;font-size:10px;color:#6d7887}@media print{.sheet{padding:0}}</style></head><body><div class="sheet"><header class="head"><div class="brand"><h1>${s.workshopName}</h1><p>${s.address||''}</p><p>تليفون: ${s.phone||''} | بريد: ${s.email||''}</p><p>سجل تجاري: ${s.commercialRegister||'—'} | ر.ت: ${s.taxNumber||'—'}</p></div><div class="invoice-info"><h2>فاتورة صيانة</h2><p><strong>رقم الفاتورة:</strong> ${i.number}</p><p><strong>تاريخ الإصدار:</strong> ${issueDate}</p><p><strong>تاريخ الاستحقاق:</strong> ${dueDate}</p></div></header><div class="meta"><div class="box"><strong>بيانات العميل</strong>${customer?.name||''}<br>تليفون: ${customer?.phone||'—'}<br>العنوان: ${customer?.address||'—'}<br>الرقم الضريبي: ${customer?.taxNumber||'—'}</div><div class="box"><strong>بيانات المركبة</strong>${car?.brand||''} ${car?.model||''} ${car?.year||''}<br>لوحة: ${car?.plate||'—'}<br>الشاسيه: ${car?.vin||'—'}<br>قراءة العداد: ${new Intl.NumberFormat('ar-EG').format(i.mileageAtService||car?.mileage||0)} كم</div><div class="box"><strong>بيانات الدفع</strong>الحالة: ${i.status}<br>طريقة الدفع: ${i.paymentMethod}<br>المبلغ المدفوع: ${egp(i.paid)}<br>المتبقي: ${egp(i.total-i.paid)}</div></div><table><thead><tr><th>الخدمة / العمل المنفذ</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items}</tbody></table><div class="bottom"><div class="notes"><p><strong>ملاحظات:</strong> ${i.notes||'—'}</p><p><strong>الضمان:</strong> ${i.warrantyNotes||'—'}</p></div><div class="totals"><p><span>الإجمالي قبل الخصم</span><strong>${egp(i.subtotal)}</strong></p><p><span>الخصم (${i.discountPercent}%)</span><strong>${egp(i.discountAmount)}</strong></p><p><span>الضريبة المضافة (${i.taxPercent}%)</span><strong>${egp(i.taxAmount)}</strong></p><p class="grand"><span>الإجمالي النهائي</span><strong>${egp(i.total)}</strong></p></div></div><div class="signatures"><div class="signature">توقيع واستلام العميل</div><div class="signature">${i.issuedBy||s.defaultIssuedBy||''}<br>اسم محرر الفاتورة وتوقيعه</div></div><div class="footer">${s.invoiceFooter||'شكرًا لتعاملكم معنا'}<br>تم إصدار هذه الفاتورة إلكترونيًا بواسطة نظام إدارة مركز DRIVE</div></div></body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
}

['openInvoice','openInvoice2'].forEach(id => document.getElementById(id)?.addEventListener('click',openNewInvoice));
document.querySelectorAll('.close-modal').forEach(b=>b.addEventListener('click',()=>invoiceModal.close()));

document.getElementById('invoiceForm').addEventListener('submit',async e=>{
  e.preventDefault(); const f=new FormData(e.target); const id=Number(f.get('id')); const items=[...document.querySelectorAll('.invoice-line')].map(row=>{const service=state.services.find(s=>s.id===Number(row.querySelector('.line-service').value));return{serviceId:service.id,name:service.name,quantity:Number(row.querySelector('.line-qty').value),unitPrice:Number(row.querySelector('.line-price').value),cost:service.cost};});
  const invoice={id,number:'',customerId:Number(f.get('customerId')),carId:Number(f.get('carId')),date:f.get('date'),dueDate:f.get('dueDate'),status:f.get('status'),paymentMethod:f.get('paymentMethod'),paid:Number(f.get('paid')),discountPercent:Number(f.get('discountPercent')),taxPercent:Number(f.get('taxPercent')),subtotal:0,discountAmount:0,taxAmount:0,total:0,notes:f.get('notes'),warrantyNotes:f.get('warrantyNotes')||'',issuedBy:f.get('issuedBy')||state.settings?.defaultIssuedBy||'عبدالله أحمد',mileageAtService:Number(f.get('mileage')||0),items};
  if(!invoice.customerId||!invoice.carId||items.length===0)return showToast('اختر العميل والسيارة وأضف خدمة واحدة على الأقل');
  const r=await fetch(id?`/api/v2/invoices/${id}`:'/api/v2/invoices',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(invoice)});if(r.ok){invoiceModal.close();await loadData();showPage('invoices');showToast(id?'تم تعديل الفاتورة':'تم إصدار الفاتورة');}
});

const simpleModalEl=document.getElementById('simpleModal'); let simpleType='';
function openSimple(type,title,html){simpleType=type;document.getElementById('simpleTitle').textContent=title;document.getElementById('simpleFields').innerHTML=html;document.getElementById('simpleForm').reset();document.getElementById('simpleFields').innerHTML=html;simpleModalEl.showModal();}

document.getElementById('openCustomer').addEventListener('click',()=>openSimple('customer','عميل جديد','<label class="full">اسم العميل<input name="name" required></label><label>رقم الهاتف<input name="phone" required></label><label>البريد الإلكتروني<input name="email" type="email"></label><label class="full">العنوان<input name="address"></label><label>الرقم الضريبي<input name="taxNumber"></label>'));
document.getElementById('openCar').addEventListener('click',()=>{const brands=Object.keys(state.vehicleCatalog||{});openSimple('car','سيارة جديدة','<label class="full">العميل<select name="customerId" required>'+state.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')+'</select></label><label>الماركة<select name="brand" id="carBrand" required>'+brands.map(b=>`<option value="${b}">${b}</option>`).join('')+'</select></label><label>الموديل<select name="model" id="carModel" required></select></label><label>سنة الصنع<input name="year" type="number" min="1950" max="2035"></label><label>لوحة الترخيص<input name="plate" required></label><label class="full">رقم الشاسيه<input name="vin"></label><label>قراءة العداد<input name="mileage" type="number" min="0"></label>');const brand=document.getElementById('carBrand');const model=document.getElementById('carModel');const fill=()=>model.innerHTML=(state.vehicleCatalog?.[brand.value]||[]).map(m=>`<option>${m}</option>`).join('');brand.addEventListener('change',fill);fill();});
document.getElementById('openService').addEventListener('click',()=>{const categories=[...new Set(state.services.map(s=>s.category).filter(Boolean))];openSimple('service','خدمة جديدة','<label>التصنيف<select name="category" id="serviceCategory">'+categories.map(c=>`<option>${c}</option>`).join('')+'</select></label><label class="full">اسم الخدمة<select name="name" id="serviceName"></select></label><label>سعر البيع<input name="price" type="number" min="0" required></label><label>التكلفة<input name="cost" type="number" min="0" required></label><label>الضريبة %<input name="taxPercent" type="number" min="0" max="100" value="14"></label>');const category=document.getElementById('serviceCategory');const name=document.getElementById('serviceName');const fill=()=>name.innerHTML=(state.serviceCatalog?.[category.value]||state.services.filter(s=>s.category===category.value).map(s=>s.name)).map(n=>`<option>${n}</option>`).join('');category.addEventListener('change',fill);fill();});
document.getElementById('openTransaction').addEventListener('click',()=>openSimple('transaction','حركة حسابية جديدة','<label>النوع<select name="type"><option>إيراد</option><option>مصروف</option></select></label><label>المبلغ<input name="amount" type="number" min="1" required></label><label class="full">الوصف<input name="description" required></label><label>طريقة الدفع<select name="method"><option>كاش</option><option>بطاقة بنكية</option><option>تحويل بنكي</option></select></label><label>التاريخ<input name="date" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label>'));
document.querySelectorAll('.close-simple').forEach(b=>b.addEventListener('click',()=>simpleModalEl.close()));

function editCustomer(id){const c=state.customers.find(x=>x.id===id);openSimple('customerEdit','تعديل العميل',`<input type="hidden" name="id" value="${id}"><label class="full">اسم العميل<input name="name" required value="${c.name}"></label><label>رقم الهاتف<input name="phone" required value="${c.phone}"></label><label>البريد الإلكتروني<input name="email" value="${c.email||''}"></label><label class="full">العنوان<input name="address" value="${c.address||''}"></label><label>الرقم الضريبي<input name="taxNumber" value="${c.taxNumber||''}"></label>`);}
function editCar(id){const c=state.cars.find(x=>x.id===id);const brands=Object.keys(state.vehicleCatalog||{});openSimple('carEdit','تعديل السيارة',`<input type="hidden" name="id" value="${id}"><label class="full">العميل<select name="customerId">${state.customers.map(x=>`<option value="${x.id}" ${x.id===c.customerId?'selected':''}>${x.name}</option>`).join('')}</select></label><label>الماركة<select name="brand" id="editCarBrand">${brands.map(b=>`<option ${b===c.brand?'selected':''}>${b}</option>`).join('')}</select></label><label>الموديل<select name="model" id="editCarModel"></select></label><label>سنة الصنع<input name="year" type="number" value="${c.year}"></label><label>لوحة الترخيص<input name="plate" value="${c.plate}"></label><label class="full">رقم الشاسيه<input name="vin" value="${c.vin||''}"></label><label>قراءة العداد<input name="mileage" type="number" value="${c.mileage}"></label>`);const brand=document.getElementById('editCarBrand');const model=document.getElementById('editCarModel');const fill=()=>model.innerHTML=(state.vehicleCatalog?.[brand.value]||[c.model]).map(m=>`<option ${m===c.model?'selected':''}>${m}</option>`).join('');brand.addEventListener('change',fill);fill();}
function editService(id){const s=state.services.find(x=>x.id===id);openSimple('serviceEdit','تعديل الخدمة',`<input type="hidden" name="id" value="${id}"><label class="full">اسم الخدمة<input name="name" value="${s.name}" required></label><label>التصنيف<input name="category" value="${s.category}" required></label><label>سعر البيع<input name="price" type="number" value="${s.price}" required></label><label>التكلفة<input name="cost" type="number" value="${s.cost}" required></label><label>الضريبة %<input name="taxPercent" type="number" value="${s.taxPercent}"></label>`);}
async function deleteCustomer(id){if(confirm('حذف العميل؟')){await fetch(`/api/v2/customers/${id}`,{method:'DELETE'});await loadData();showToast('تم حذف العميل');}}
async function deleteCar(id){if(confirm('حذف السيارة؟')){await fetch(`/api/v2/cars/${id}`,{method:'DELETE'});await loadData();showToast('تم حذف السيارة');}}
async function deleteService(id){if(confirm('حذف الخدمة؟')){await fetch(`/api/v2/services/${id}`,{method:'DELETE'});await loadData();showToast('تم حذف الخدمة');}}

document.getElementById('simpleForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const id=Number(f.get('id')||0);let endpoint='',method=id?'PUT':'POST',body={};
if(simpleType.startsWith('customer')){endpoint=id?`/api/v2/customers/${id}`:'/api/v2/customers';body={id,name:f.get('name'),phone:f.get('phone'),email:f.get('email'),address:f.get('address'),taxNumber:f.get('taxNumber'),balance:0};}
else if(simpleType.startsWith('car')){endpoint=id?`/api/v2/cars/${id}`:'/api/v2/cars';body={id,customerId:Number(f.get('customerId')),plate:f.get('plate'),brand:f.get('brand'),model:f.get('model'),year:Number(f.get('year')),vin:f.get('vin'),mileage:Number(f.get('mileage'))};}
else if(simpleType.startsWith('service')){endpoint=id?`/api/v2/services/${id}`:'/api/v2/services';body={id,name:f.get('name'),category:f.get('category'),price:Number(f.get('price')),cost:Number(f.get('cost')),taxPercent:Number(f.get('taxPercent'))};}
else{endpoint='/api/v2/transactions';body={id:0,type:f.get('type'),description:f.get('description'),amount:Number(f.get('amount')),method:f.get('method'),date:f.get('date'),invoiceId:0};}
const r=await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){simpleModalEl.close();await loadData();showToast('تم حفظ البيانات بنجاح');}});

document.getElementById('settingsForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const body={workshopName:f.get('workshopName'),phone:f.get('phone'),address:f.get('address'),email:f.get('email'),commercialRegister:f.get('commercialRegister'),taxNumber:f.get('taxNumber'),defaultIssuedBy:f.get('defaultIssuedBy'),invoiceFooter:f.get('invoiceFooter'),taxPercent:Number(f.get('taxPercent')),invoicePrefix:f.get('invoicePrefix'),lowStockAlert:f.get('lowStockAlert')==='true'};const r=await fetch('/api/v2/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){await loadData();showToast('تم حفظ الإعدادات');}});

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
document.querySelector('.notification')?.addEventListener('click', () => showToast(state.outstanding > 0 ? `يوجد ${egp(state.outstanding)} مستحقات تحتاج متابعة` : 'لا توجد تنبيهات مستحقات حاليًا'));
document.querySelector('.profile')?.addEventListener('click', () => showPage('settings'));

const chartSelect = document.querySelector('.chart-panel select');
chartSelect?.addEventListener('change', () => showToast(`تم تغيير فترة التقرير إلى: ${chartSelect.value}`));

loadData();
